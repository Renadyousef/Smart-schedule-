// server/src/controllers/CreateRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

const INPUT_TYPES = new Set(["DataRequest", "NewElective", "Offer Elective"]);

/* -------------------- utils -------------------- */
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

const tOrNull    = (v)=>{ const s=String(v??"").trim(); return s||null; };
const iOrNull    = (v)=>{ const n=Number(v); return Number.isFinite(n)?n:null; };
const timeOrNull = (v)=>{ const s=String(v??"").trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:null; };

async function tableExists(client, table){
  const t = table.replace(/"/g,"");
  const q = await client.query(
    `select 1 from information_schema.tables
     where table_schema='public' and table_name=$1 limit 1`, [t]
  );
  return q.rowCount>0;
}
async function columnExists(client, table, col){
  const t = table.replace(/"/g,"");
  const c = col.replace(/"/g,"");
  const q = await client.query(
    `select 1 from information_schema.columns
     where table_schema='public' and table_name=$1 and column_name=$2
     limit 1`, [t,c]
  );
  return q.rowCount>0;
}
async function columnDataType(client, table, col){
  const t = table.replace(/"/g,"");
  const c = col.replace(/"/g,"");
  const q = await client.query(
    `select data_type
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`, [t,c]
  );
  return q.rows[0]?.data_type || null;
}
function handle500(res, label, err){
  console.error(label, {
    message: err?.message, code: err?.code, detail: err?.detail, hint: err?.hint
  });
  return res.status(500).json({
    error: "Server error",
    message: err?.message ?? null,
    detail: err?.detail ?? null,
    code: err?.code ?? null,
    where: label
  });
}

/* ============================== CREATE ============================== */
export const createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log("[createRequest] hit", req.originalUrl);

    let {
      title,
      type,
      level,
      neededFields,
      studentNames,
      description = null,
      createdBy = null,
      committeeId = null,
      registrarId = null,
      electives = []
    } = req.body || {};

    title = String(title||"").trim();
    const rawType = String(type||"").trim();

    // Validate input type
    if (!title || !rawType) return res.status(400).json({ error: "Missing required fields." });
    if (!INPUT_TYPES.has(rawType)) return res.status(400).json({ error: `Invalid type: ${rawType}` });

    // Elective mode if client sends "NewElective" OR "Offer Elective"
    const isElectiveMode = rawType === "NewElective" || rawType === "Offer Elective";

    // IMPORTANT: store a value that your DB check constraint allows
    // Your CHECK rejects "NewElective", so we persist "Offer Elective" when in elective mode
    const dbType = isElectiveMode ? "Offer Elective" : "DataRequest";

    const cleanLevel  = normLevel(level);
    const cleanNeeded = normCommaArray(neededFields);
    const cleanNames  = normNames(studentNames);

    // detect optional columns on header table
    const hasNeededFields = await columnExists(client,'CommitteeRequests','NeededFields').catch(()=>false);
    const hasCreatedBy    = await columnExists(client,'CommitteeRequests','CreatedBy').catch(()=>false);
    const hasCommitteeID  = await columnExists(client,'CommitteeRequests','CommitteeID').catch(()=>false);
    const hasRegistrarID  = await columnExists(client,'CommitteeRequests','RegistrarID').catch(()=>false);
    const nfType          = hasNeededFields ? await columnDataType(client,'CommitteeRequests','NeededFields').catch(()=>null) : null;

    await client.query("BEGIN");

    /* -------- insert header -------- */
    const cols = ['"Title"','"RequestType"','"Level"','"Description"','"Status"','"CreatedAt"','"UpdatedAt"'];
    const vals = ['$1','$2','$3','$4','\'pending\'','now()','now()'];
    const pars = [title, dbType, cleanLevel, description ?? null];

    if (hasNeededFields){
      cols.splice(3,0,'"NeededFields"');
      if (nfType === 'ARRAY'){
        vals.splice(3,0,`$${pars.length+1}::text[]`);
        pars.push(isElectiveMode ? [] : cleanNeeded);
      } else if (nfType === 'jsonb'){
        vals.splice(3,0,`$${pars.length+1}::jsonb`);
        pars.push(isElectiveMode ? '[]' : JSON.stringify(cleanNeeded));
      } else { // plain text fallback
        vals.splice(3,0,`$${pars.length+1}`);
        pars.push(isElectiveMode ? '' : cleanNeeded.join(','));
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

    /* -------- detail rows -------- */
    if (isElectiveMode){
      const hasElectTbl = await tableExists(client,'CommitteeRequestElectives');
      if (!hasElectTbl) throw new Error('Table "CommitteeRequestElectives" not found');

      const insElect = `
        INSERT INTO public."CommitteeRequestElectives"
          ("RequestID","CRStudentID",
           "CourseID","CourseName","SeatCount",
           "LectureSection","LectureDays","LectureStart","LectureEnd",
           "TutorialSection","TutorialDays","TutorialStart","TutorialEnd",
           "LabSection","LabDays","LabStart","LabEnd","Status")
        VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'proposed')
      `;

      for (const e of electives || []){
        await client.query(insElect, [
          requestId,
          tOrNull(e?.CourseID),
          tOrNull(e?.name),
          iOrNull(e?.SeatCount),
          iOrNull(e?.lectureSection),
          tOrNull(e?.lectureDays),
          timeOrNull(e?.lectureStart),
          timeOrNull(e?.lectureEnd),
          iOrNull(e?.tutorialSection),
          tOrNull(e?.tutorialDays),
          timeOrNull(e?.tutorialStart),
          timeOrNull(e?.tutorialEnd),
          iOrNull(e?.labSection),
          tOrNull(e?.labDays),
          timeOrNull(e?.labStart),
          timeOrNull(e?.labEnd)
        ]);
      }
    } else {
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

    // students are optional; fetch only if table exists
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

    const eQ = await client.query(
      `SELECT
         "CRElectiveID"  AS "electiveId",
         "CRStudentID"   AS "crStudentId",
         "CourseID"      AS "courseId",
         "CourseName"    AS "courseName",
         "SeatCount"     AS "seatCount",
         "LectureSection","LectureDays","LectureStart","LectureEnd",
         "TutorialSection","TutorialDays","TutorialStart","TutorialEnd",
         "LabSection","LabDays","LabStart","LabEnd",
         "Status","CreatedAt","UpdatedAt"
       FROM public."CommitteeRequestElectives"
       WHERE "RequestID" = $1
       ORDER BY "CRElectiveID"`,
      [id]
    );

    return res.json({ ...head.rows[0], students, electives: eQ.rows });
  } catch (err){
    return handle500(res, "getRequestById error", err);
  } finally {
    client.release();
  }
};
