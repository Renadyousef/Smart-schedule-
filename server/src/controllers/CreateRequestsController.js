// server/src/controllers/CreateRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

const VALID_TYPES = new Set(["DataRequest", "Confirmation"]);

/* ---------------- helpers ---------------- */
function normalizeNeededFields(neededFields) {
  if (Array.isArray(neededFields)) return neededFields.map(String).map(s => s.trim()).filter(Boolean);
  if (neededFields == null) return [];
  return String(neededFields).split(",").map(s => s.trim()).filter(Boolean);
}
function normalizeStudentNames(studentNames) {
  if (Array.isArray(studentNames)) return studentNames.map(String).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (studentNames == null) return [];
  return String(studentNames).split(/\r?\n|,/).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function normalizeLevel(level) {
  if (level === "" || level == null) return null;
  const n = Number(level);
  return Number.isFinite(n) ? n : null;
}
function handle500(res, label, err) {
  console.error(label, err);
  return res.status(500).json({ error: "Server error", message: err?.message || null, detail: err?.detail ?? null });
}

// يتحقق إذا كان العمود موجود في الجدول
async function columnExists(client, table, column) {
  const t = table.replace(/"/g, "");
  const c = column.replace(/"/g, "");
  const q = await client.query(
    `select 1
       from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name=$2
      limit 1`,
    [t, c]
  );
  return q.rowCount > 0;
}

/* ---------------- controllers ---------------- */

export const createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    let {
      title,
      type,
      level,
      neededFields,
      studentNames,
      description = null,
      committeeId = null,
      registrarId = null,
      createdBy = null,
    } = req.body || {};

    title = String(title || "").trim();
    type = String(type || "").trim();

    const cleanNeededArr = normalizeNeededFields(neededFields);
    const cleanStudents = normalizeStudentNames(studentNames);
    const cleanLevel = normalizeLevel(level);

    // نعرف الأعمدة الموجودة فعلياً
    const hasNeededFields = await columnExists(client, 'CommitteeRequests', 'NeededFields');
    const hasCreatedBy    = await columnExists(client, 'CommitteeRequests', 'CreatedBy');
    const hasCommitteeID  = await columnExists(client, 'CommitteeRequests', 'CommitteeID');
    const hasRegistrarID  = await columnExists(client, 'CommitteeRequests', 'RegistrarID');

    // التحقق (لو NeededFields موجود فعلاً، نخليه إلزامي؛ لو محذوف، نتجاهله)
    if (!title || !type || (!hasNeededFields ? false : cleanNeededArr.length === 0) || cleanStudents.length === 0) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: `Invalid type. Allowed: ${[...VALID_TYPES].join(", ")}` });
    }

    await client.query("BEGIN");

    // نبني INSERT ديناميكياً حسب الأعمدة المتوفرة
    const cols = ['"Title"', '"RequestType"', '"Level"', '"Description"', '"Status"', '"CreatedAt"', '"UpdatedAt"'];
    const vals = ['$1', '$2', '$3', '$4', `'pending'`, 'now()', 'now()'];
    const params = [title, type, cleanLevel, description ?? null];

    if (hasNeededFields) {
      cols.splice(3, 0, '"NeededFields"');
      params.push(cleanNeededArr);
      vals.splice(3, 0, `$${params.length}::text[]`);
    }
    if (hasCreatedBy) {
      cols.push('"CreatedBy"');
      params.push(createdBy);
      vals.push(`$${params.length}`);
    }
    if (hasCommitteeID) {
      cols.push('"CommitteeID"');
      params.push(committeeId);
      vals.push(`$${params.length}`);
    }
    if (hasRegistrarID) {
      cols.push('"RegistrarID"');
      params.push(registrarId);
      vals.push(`$${params.length}`);
    }

    const insReq = `
      INSERT INTO public."CommitteeRequests" (${cols.join(",")})
      VALUES (${vals.join(",")})
      RETURNING "RequestID" AS id;
    `;
    const { rows } = await client.query(insReq, params);
    const requestId = rows[0].id;

    // أطفال الطلب (سجلات الطلاب)
    const insChild = `
      INSERT INTO public."CommitteeRequestStudents"
        ("RequestID","StudentID","StudentName","MatchStatus","Status","ResponseData","RespondedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `;
    for (const name of cleanStudents) {
      await client.query(insChild, [requestId, null, name, "unmatched", "pending", null, null]);
    }

    await client.query("COMMIT");
    return res.status(201).json({ id: requestId, committeeId, registrarId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    return handle500(res, "createRequest error", err);
  } finally {
    client.release();
  }
};

export const getRequests = async (req, res) => {
  const client = await pool.connect();
  try {
    const { status = null, committeeId = null, registrarId = null } = req.query;

    const hasNeededFields = await columnExists(client, 'CommitteeRequests', 'NeededFields');
    const hasCommitteeID  = await columnExists(client, 'CommitteeRequests', 'CommitteeID');
    const hasRegistrarID  = await columnExists(client, 'CommitteeRequests', 'RegistrarID');

    const where = [];
    const vals = [];

    if (status)      { vals.push(status);      where.push(`"Status" = $${vals.length}`); }
    if (committeeId && hasCommitteeID) { vals.push(committeeId); where.push(`"CommitteeID" = $${vals.length}`); }
    if (registrarId && hasRegistrarID) { vals.push(registrarId); where.push(`"RegistrarID" = $${vals.length}`); }

    const selNeeded = hasNeededFields ? `"NeededFields" AS "neededFields"` : `ARRAY[]::text[] AS "neededFields"`;
    const selComm   = hasCommitteeID  ? `"CommitteeID"  AS "committeeId"` : `NULL::int AS "committeeId"`;
    const selReg    = hasRegistrarID  ? `"RegistrarID"  AS "registrarId"` : `NULL::int AS "registrarId"`;

    const q = `
      SELECT
        "RequestID" AS id,
        "Title" AS title,
        "RequestType" AS type,
        "Level" AS level,
        ${selNeeded},
        "Description" AS description,
        "Status" AS status,
        ${selComm},
        ${selReg},
        "CreatedAt" AS "createdAt",
        "UpdatedAt" AS "updatedAt",
        "AssignedAt" AS "assignedAt",
        "HandledAt" AS "handledAt"
      FROM public."CommitteeRequests"
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY "CreatedAt" DESC;
    `;
    const { rows } = await client.query(q, vals);
    return res.json(rows);
  } catch (err) {
    return handle500(res, "getRequests error", err);
  } finally {
    client.release();
  }
};

export const getRequestById = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const hasNeededFields = await columnExists(client, 'CommitteeRequests', 'NeededFields');
    const hasCommitteeID  = await columnExists(client, 'CommitteeRequests', 'CommitteeID');
    const hasRegistrarID  = await columnExists(client, 'CommitteeRequests', 'RegistrarID');

    const selNeeded = hasNeededFields ? `"NeededFields" AS "neededFields"` : `ARRAY[]::text[] AS "neededFields"`;
    const selComm   = hasCommitteeID  ? `"CommitteeID"  AS "committeeId"` : `NULL::int AS "committeeId"`;
    const selReg    = hasRegistrarID  ? `"RegistrarID"  AS "registrarId"` : `NULL::int AS "registrarId"`;

    const head = await client.query(
      `
      SELECT
        "RequestID" AS id,
        "Title" AS title,
        "RequestType" AS type,
        "Level" AS level,
        ${selNeeded},
        "Description" AS description,
        "Status" AS status,
        ${selComm},
        ${selReg},
        "CreatedAt" AS "createdAt",
        "UpdatedAt" AS "updatedAt",
        "AssignedAt" AS "assignedAt",
        "HandledAt" AS "handledAt"
      FROM public."CommitteeRequests"
      WHERE "RequestID" = $1
      `,
      [id]
    );
    if (head.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const kids = await client.query(
      `
      SELECT
        "CRStudentID" AS "crStudentId",
        "StudentID" AS "studentId",
        "StudentName" AS "studentName",
        "MatchStatus" AS "matchStatus",
        "Status" AS status,
        "ResponseData" AS "responseData",
        "RespondedAt" AS "respondedAt"
      FROM public."CommitteeRequestStudents"
      WHERE "RequestID" = $1
      ORDER BY "CRStudentID"
      `,
      [id]
    );

    return res.json({ ...head.rows[0], students: kids.rows });
  } catch (err) {
    return handle500(res, "getRequestById error", err);
  } finally {
    client.release();
  }
};
