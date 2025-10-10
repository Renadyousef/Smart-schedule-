// server/src/controllers/CreateRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

/* ---------- constants ---------- */
const INPUT_TYPES = new Set(["DataRequest"]);

/* ---------- utils ---------- */
function normCommaArray(v) {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (v == null) return [];
  return String(v).split(",").map(s => s.trim()).filter(Boolean);
}
function normNames(v) {
  if (Array.isArray(v)) return v.map(String).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (v == null) return [];
  return String(v).split(/\r?\n|,/g).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function normLevel(v){ if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

async function columnExists(client, table, col){
  const t = table.replace(/"/g,"");
  const c = col.replace(/"/g,"");
  const q = await client.query(
    `select 1 from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2 limit 1`, [t,c]
  );
  return q.rowCount>0;
}
async function tableExists(client, table){
  const t = table.replace(/"/g,"");
  const q = await client.query(
    `select 1 from information_schema.tables
      where table_schema='public' and table_name=$1 limit 1`, [t]
  );
  return q.rowCount>0;
}
async function columnDataType(client, table, col){
  const t = table.replace(/"/g,"");
  const c = col.replace(/"/g,"");
  const q = await client.query(
    `select data_type from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2 limit 1`, [t,c]
  );
  return q.rows[0]?.data_type || null;
}
function handle500(res, label, err){
  console.error(label, { message: err?.message, code: err?.code, detail: err?.detail, hint: err?.hint });
  return res.status(500).json({
    error: "Server error",
    message: err?.message ?? null,
    detail: err?.detail ?? null,
    code: err?.code ?? null,
    where: label
  });
}

/* ---------- notifications helper (safe/flexible) ---------- */
async function insertNotification(client, {
  message,
  type = "request",
  entity = "CommitteeRequest",
  entityId,
  receiverId = null,
  receiverRole = null,
  createdBy = null,
  data = null,
}) {
  const hasTable = await tableExists(client, 'Notifications');
  if (!hasTable) return; // silently skip if no table

  const hasMessage     = await columnExists(client, 'Notifications', 'Message').catch(()=>false);
  const hasIsRead      = await columnExists(client, 'Notifications', 'IsRead').catch(()=>false);
  const hasCreatedAt   = await columnExists(client, 'Notifications', 'CreatedAt').catch(()=>false);
  const hasSenderName  = await columnExists(client, 'Notifications', 'SenderName').catch(()=>false);
  const hasSenderEmail = await columnExists(client, 'Notifications', 'SenderEmail').catch(()=>false);
  const hasSenderRole  = await columnExists(client, 'Notifications', 'SenderRole').catch(()=>false);
  const hasReceiverID  = await columnExists(client, 'Notifications', 'ReceiverID').catch(()=>false);
  const hasReceiverRole= await columnExists(client, 'Notifications', 'ReceiverRole').catch(()=>false);
  const hasEntity      = await columnExists(client, 'Notifications', 'Entity').catch(()=>false);
  const hasEntityId    = await columnExists(client, 'Notifications', 'EntityId').catch(()=>false);
  const hasType        = await columnExists(client, 'Notifications', 'Type').catch(()=>false);
  const hasCreatedBy   = await columnExists(client, 'Notifications', 'CreatedBy').catch(()=>false);
  const hasData        = await columnExists(client, 'Notifications', 'Data').catch(()=>false);

  const dataType = hasData ? await columnDataType(client, 'Notifications', 'Data').catch(()=>null) : null;

  const cols = [];
  const vals = [];
  const pars = [];

  // minimal safe fields
  if (hasMessage){ cols.push('"Message"');     pars.push(message || 'Notification'); vals.push(`$${pars.length}`); }
  if (hasIsRead){  cols.push('"IsRead"');      vals.push('false'); }
  if (hasCreatedAt){ cols.push('"CreatedAt"'); vals.push('now()'); }
  if (hasType){    cols.push('"Type"');        pars.push(type);     vals.push(`$${pars.length}`); }
  if (hasEntity){  cols.push('"Entity"');      pars.push(entity);   vals.push(`$${pars.length}`); }
  if (hasEntityId){cols.push('"EntityId"');    pars.push(entityId); vals.push(`$${pars.length}`); }

  if (hasReceiverID && receiverId != null){ cols.push('"ReceiverID"'); pars.push(receiverId); vals.push(`$${pars.length}`); }
  if (hasReceiverRole && receiverRole){ cols.push('"ReceiverRole"'); pars.push(receiverRole); vals.push(`$${pars.length}`); }

  if (hasCreatedBy && createdBy != null){ cols.push('"CreatedBy"'); pars.push(createdBy); vals.push(`$${pars.length}`); }

  if (hasData && data != null){
    if (dataType && dataType.toLowerCase().includes('json')) {
      cols.push('"Data"'); pars.push(JSON.stringify(data)); vals.push(`$${pars.length}::jsonb`);
    } else {
      cols.push('"Data"'); pars.push(JSON.stringify(data)); vals.push(`$${pars.length}`);
    }
  }

  if (cols.length === 0) return; // nothing to insert safely

  const sql = `INSERT INTO public."Notifications" (${cols.join(",")}) VALUES (${vals.join(",")})`;
  await client.query(sql, pars);
}

/* ============================== CREATE ============================== */
export const createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    let {
      title,
      type,            // must be "DataRequest"
      level,
      neededFields,
      studentNames,
      description = null,
      createdBy = null,
      committeeId = null,
      registrarId = null
    } = req.body || {};

    title = String(title||"").trim();
    const rawType = String(type||"").trim();

    if (!title || !rawType) return res.status(400).json({ error: "Missing required fields." });
    if (!INPUT_TYPES.has(rawType)) return res.status(400).json({ error: `Invalid type: ${rawType}` });

    const cleanLevel  = normLevel(level);
    const cleanNeeded = normCommaArray(neededFields);
    const cleanNames  = normNames(studentNames);

    if (cleanNeeded.length === 0 || cleanNames.length === 0) {
      return res.status(400).json({ error: "Needed fields and student names are required." });
    }

    // optional columns on header table
    const hasNeededFields = await columnExists(client,'CommitteeRequests','NeededFields').catch(()=>false);
    const hasCreatedBy    = await columnExists(client,'CommitteeRequests','CreatedBy').catch(()=>false);
    const hasCommitteeID  = await columnExists(client,'CommitteeRequests','CommitteeID').catch(()=>false);
    const hasRegistrarID  = await columnExists(client,'CommitteeRequests','RegistrarID').catch(()=>false);
    const nfType          = hasNeededFields ? await columnDataType(client,'CommitteeRequests','NeededFields').catch(()=>null) : null;

    await client.query("BEGIN");

    /* -------- insert header -------- */
    const cols = ['"Title"','"RequestType"','"Level"','"Description"','"Status"','"CreatedAt"','"UpdatedAt"'];
    const vals = ['$1','$2','$3','$4','\'pending\'','now()','now()'];
    const pars = [title, "DataRequest", cleanLevel, description ?? null];

    if (hasNeededFields){
      cols.splice(3,0,'"NeededFields"');
      if (nfType === 'ARRAY'){
        vals.splice(3,0,`$${pars.length+1}::text[]`);  pars.push(cleanNeeded);
      } else if (nfType === 'jsonb'){
        vals.splice(3,0,`$${pars.length+1}::jsonb`);   pars.push(JSON.stringify(cleanNeeded));
      } else {
        vals.splice(3,0,`$${pars.length+1}`);          pars.push(cleanNeeded.join(','));
      }
    }
    if (hasCreatedBy){ cols.push('"CreatedBy"'); pars.push(createdBy); vals.push(`$${pars.length}`); }
    if (hasCommitteeID){ cols.push('"CommitteeID"'); pars.push(committeeId); vals.push(`$${pars.length}`); }
    if (hasRegistrarID){ cols.push('"RegistrarID"'); pars.push(registrarId); vals.push(`$${pars.length}`); }

    const insReq = `
      INSERT INTO public."CommitteeRequests" (${cols.join(",")})
      VALUES (${vals.join(",")})
      RETURNING "RequestID" AS id
    `;
    const { rows:r } = await client.query(insReq, pars);
    const requestId = r[0].id;

    /* -------- detail rows (students only) -------- */
    const hasCRStudents = await tableExists(client,'CommitteeRequestStudents').catch(()=>false);
    if (hasCRStudents && cleanNames.length){
      const insLine = `
        INSERT INTO public."CommitteeRequestStudents"
          ("RequestID","StudentID","StudentName","MatchStatus","Status","ResponseData","RespondedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `;
      for (const name of cleanNames){
        await client.query(insLine, [requestId, null, name, "unmatched", "pending", null, null]);
      }
    }

    /* -------- create notifications (scheduler will retrieve) -------- */
    const prettyNeeded = cleanNeeded.join(", ");
    const msg = `${title} — new data request${cleanLevel?` (level ${cleanLevel})`:''} (${cleanNames.length} students)`;
    const dataPayload = {
      action: "new_request",
      requestId,
      requestType: "DataRequest",
      level: cleanLevel,
      neededFields: cleanNeeded,
      studentCount: cleanNames.length,
      studentNamesPreview: cleanNames.slice(0,5), // short preview
      createdBy,
      committeeId,
      registrarId,
      status: "pending",
    };

    // notify registrar if provided
    if (registrarId != null){
      await insertNotification(client, {
        message: msg,
        type: "request",
        entity: "CommitteeRequest",
        entityId: requestId,
        receiverId: registrarId,
        receiverRole: "registrar",
        createdBy,
        data: dataPayload,
      });
    }

    // notify committee if provided
    if (committeeId != null){
      await insertNotification(client, {
        message: msg,
        type: "request",
        entity: "CommitteeRequest",
        entityId: requestId,
        receiverId: committeeId,
        receiverRole: "committee",
        createdBy,
        data: dataPayload,
      });
    }

    await client.query("COMMIT");
    return res.status(201).json({ id: requestId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    return handle500(res, "createRequest error", err);
  } finally {
    client.release();
  }
};

/* ============================== LIST ============================== */
export const getRequests = async (req, res) => {
  const client = await pool.connect();
  try {
    const hasNeededFields = await columnExists(client,'CommitteeRequests','NeededFields').catch(()=>false);
    const selNeeded = hasNeededFields ? `"NeededFields" AS "neededFields"` : `ARRAY[]::text[] AS "neededFields"`;

    const q = `
      SELECT
        "RequestID"   AS id,
        "Title"       AS title,
        "RequestType" AS type,
        "Level"       AS level,
        ${selNeeded},
        "Description" AS description,
        "Status"      AS status,
        "CreatedAt"   AS "createdAt",
        "UpdatedAt"   AS "updatedAt"
      FROM public."CommitteeRequests"
      WHERE "RequestType" = 'DataRequest'
      ORDER BY "CreatedAt" DESC
    `;
    const { rows } = await client.query(q);
    return res.json(rows);
  } catch (err){
    return handle500(res, "getRequests error", err);
  } finally {
    client.release();
  }
};

/* ============================ DETAILS ============================ */
export const getRequestById = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const hasNeededFields = await columnExists(client,'CommitteeRequests','NeededFields').catch(()=>false);
    const selNeeded = hasNeededFields ? `"NeededFields" AS "neededFields"` : `ARRAY[]::text[] AS "neededFields"`;

    const head = await client.query(
      `SELECT
         "RequestID"   AS id,
         "Title"       AS title,
         "RequestType" AS type,
         "Level"       AS level,
         ${selNeeded},
         "Description" AS description,
         "Status"      AS status,
         "CreatedAt"   AS "createdAt",
         "UpdatedAt"   AS "updatedAt"
       FROM public."CommitteeRequests"
       WHERE "RequestID" = $1`,
      [id]
    );
    if (head.rowCount === 0) return res.status(404).json({ error: "Not found" });

    // students (only if table exists)
    let students = [];
    const hasCRStudents = await tableExists(client,'CommitteeRequestStudents').catch(()=>false);
    if (hasCRStudents){
      const sQ = await client.query(
        `SELECT
           "CRStudentID" AS "crStudentId",
           "StudentID"   AS "studentId",
           "StudentName" AS "studentName",
           "MatchStatus" AS "matchStatus",
           "Status"      AS status,
           "ResponseData" AS "responseData",
           "RespondedAt"  AS "respondedAt"
         FROM public."CommitteeRequestStudents"
         WHERE "RequestID" = $1
         ORDER BY "CRStudentID"`,
        [id]
      );
      students = sQ.rows;
    }

    return res.json({ ...head.rows[0], students, electives: [] }); // no electives
  } catch (err){
    return handle500(res, "getRequestById error", err);
  } finally {
    client.release();
  }
};
