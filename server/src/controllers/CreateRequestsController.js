// server/controllers/CreateRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

const VALID_TYPES = new Set(["DataRequest", "Confirmation"]);

function normalizeNeededFields(neededFields) {
  if (Array.isArray(neededFields)) {
    return neededFields.map(String).map(s=>s.trim()).filter(Boolean);
  }
  if (neededFields == null) return [];
  return String(neededFields).split(",").map(s=>s.trim()).filter(Boolean);
}

function normalizeStudentNames(studentNames) {
  if (Array.isArray(studentNames)) {
    return studentNames.map(String).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
  }
  if (studentNames == null) return [];
  return String(studentNames).split(/\r?\n|,/).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
}

function normalizeLevel(level){
  if (level === "" || level == null) return null;
  const n = Number(level);
  return Number.isFinite(n) ? n : null;
}

function handle500(res, label, err){
  console.error(label, err);
  return res.status(500).json({ error: "Server error", message: err?.message || null });
}

export const createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    let {
      title, type, level, neededFields, studentNames,
      description = null, committeeId = null, registrarId = null, createdBy = null,
    } = req.body || {};

    title = String(title || "").trim();
    type  = String(type  || "").trim();

    const cleanNeededArr = normalizeNeededFields(neededFields); // <-- keep as array
    const cleanStudents  = normalizeStudentNames(studentNames);
    const cleanLevel     = normalizeLevel(level);

    if (!title || !type || cleanNeededArr.length === 0 || cleanStudents.length === 0) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: `Invalid type. Allowed: ${[...VALID_TYPES].join(", ")}` });
    }

    await client.query("BEGIN");

    // NOTE: NeededFields is text[] in DB → use $4::text[]
    const insReq = `
      INSERT INTO public."CommitteeRequests"
        ("Title","RequestType","Level","NeededFields","Description",
         "Status","CreatedBy","CreatedAt","UpdatedAt","CommitteeID","RegistrarID")
      VALUES ($1,$2,$3,$4::text[],$5,'pending',$6,now(),now(),$7,$8)
      RETURNING "RequestID" AS id;
    `;
    const { rows } = await client.query(insReq, [
      title,
      type,
      cleanLevel,
      cleanNeededArr,          // <-- pass array, not string
      description ?? null,
      createdBy,
      committeeId ?? null,
      registrarId ?? null,
    ]);
    const requestId = rows[0].id;

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
    try { await pool.query("ROLLBACK"); } catch {}
    return handle500(res, "createRequest error", err);
  } finally {
    client.release();
  }
};

export const getRequests = async (req, res) => {
  try {
    const { status=null, committeeId=null, registrarId=null } = req.query;
    const where = []; const vals = [];
    if (status)      { vals.push(status);      where.push(`"Status" = $${vals.length}`); }
    if (committeeId) { vals.push(committeeId); where.push(`"CommitteeID" = $${vals.length}`); }
    if (registrarId) { vals.push(registrarId); where.push(`"RegistrarID" = $${vals.length}`); }

    const q = `
      SELECT
        "RequestID" AS id, "Title" AS title, "RequestType" AS type, "Level" AS level,
        "NeededFields" AS "neededFields",  -- this will be text[]
        "Description" AS description, "Status" AS status,
        "CommitteeID" AS "committeeId","RegistrarID" AS "registrarId",
        "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
        "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
      FROM public."CommitteeRequests"
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY "CreatedAt" DESC;
    `;
    const { rows } = await pool.query(q, vals);
    return res.json(rows);
  } catch (err) {
    return handle500(res, "getRequests error", err);
  }
};

export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const head = await pool.query(`
      SELECT
        "RequestID" AS id, "Title" AS title, "RequestType" AS type, "Level" AS level,
        "NeededFields" AS "neededFields",  -- text[]
        "Description" AS description, "Status" AS status,
        "CommitteeID" AS "committeeId","RegistrarID" AS "registrarId",
        "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
        "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
      FROM public."CommitteeRequests" WHERE "RequestID" = $1
    `,[id]);
    if (head.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const kids = await pool.query(`
      SELECT
        "CRStudentID" AS "crStudentId", "StudentID" AS "studentId",
        "StudentName" AS "studentName", "MatchStatus" AS "matchStatus",
        "Status" AS status, "ResponseData" AS "responseData", "RespondedAt" AS "respondedAt"
      FROM public."CommitteeRequestStudents"
      WHERE "RequestID" = $1
      ORDER BY "CRStudentID"
    `,[id]);

    return res.json({ ...head.rows[0], students: kids.rows });
  } catch (err) {
    return handle500(res, "getRequestById error", err);
  }
};
