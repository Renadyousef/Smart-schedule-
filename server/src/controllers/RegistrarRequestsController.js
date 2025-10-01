// server/controllers/RegistrarRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

function handle500(res, label, err) {
  console.error(label, err);
  return res.status(500).json({ error: "Server error", message: err?.message ?? null, detail: err?.detail ?? null });
}

const COURSE_RE = /^[A-Za-z0-9_-]{1,20}$/;
function normalizeCourseList(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input ?? "").split(/[, \s\n]+/g).map((s) => s.trim());
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const v = String(raw || "").trim().toUpperCase();
    if (!v || !COURSE_RE.test(v)) continue;
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/** GET /registrarRequests/requests?status=&registrarId=&committeeId= */
export const listRegistrarRequests = async (req, res) => {
  try {
    const { status = null, registrarId = null, committeeId = null } = req.query;
    const where = [], vals = [];
    if (status)      { vals.push(status);      where.push(`"Status" = $${vals.length}`); }
    if (registrarId) { vals.push(registrarId); where.push(`"RegistrarID" = $${vals.length}`); }
    if (committeeId) { vals.push(committeeId); where.push(`"CommitteeID" = $${vals.length}`); }

    const sql = `
      SELECT "RequestID" AS id, "Title" AS title, "RequestType" AS type,
             "Level" AS level, "NeededFields" AS "neededFields", "Description" AS description,
             "Status" AS status, "CommitteeID" AS "committeeId", "RegistrarID" AS "registrarId",
             "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
             "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
        FROM public."CommitteeRequests"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY "CreatedAt" DESC;`;
    const { rows } = await pool.query(sql, vals);
    res.json(rows);
  } catch (err) { handle500(res, "listRegistrarRequests error", err); }
};

/** GET /registrarRequests/requests/:id */
export const getRegistrarRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const rq = await pool.query(
      `SELECT "RequestID" AS id, "Title" AS title, "RequestType" AS type,
              "Level" AS level, "NeededFields" AS "neededFields", "Description" AS description,
              "Status" AS status, "CommitteeID" AS "committeeId", "RegistrarID" AS "registrarId",
              "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
              "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
         FROM public."CommitteeRequests" WHERE "RequestID" = $1`, [id]);
    if (rq.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const kids = await pool.query(
      `SELECT "CRStudentID" AS "crStudentId","StudentID" AS "studentId","StudentName" AS "studentName",
              "MatchStatus" AS "matchStatus","Status" AS status,"ResponseData" AS "responseData",
              "RespondedAt" AS "respondedAt"
         FROM public."CommitteeRequestStudents"
        WHERE "RequestID" = $1
        ORDER BY "CRStudentID"`, [id]);

    res.json({ ...rq.rows[0], students: kids.rows });
  } catch (err) { handle500(res, "getRegistrarRequest error", err); }
};

/** POST /registrarRequests/requests/:id/students/:crStudentId/respond */
export const respondForStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, crStudentId } = req.params;
    const { data, status } = req.body;
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Missing data" });

    await client.query("BEGIN");

    await client.query(
      `UPDATE public."CommitteeRequestStudents"
          SET "ResponseData" = COALESCE("ResponseData",'{}'::jsonb) || $1::jsonb,
              "Status" = COALESCE($2,'fulfilled'),
              "RespondedAt" = now()
        WHERE "CRStudentID" = $3 AND "RequestID" = $4`,
      [JSON.stringify(data), status ?? null, crStudentId, id]
    );

    // optional write-through for irregular category
    const category = String(data?.category || "").toLowerCase().trim();
    if (category === "irregular") {
      const q = await client.query(
        `SELECT "StudentID" FROM public."CommitteeRequestStudents"
          WHERE "CRStudentID" = $1 AND "RequestID" = $2`, [crStudentId, id]);
      const studentId = q.rows[0]?.StudentID ?? null;

      if (studentId) {
        const courses = normalizeCourseList(data?.PreviousLevelCourses);
        if (courses.length) {
          await client.query(
            `INSERT INTO public."IrregularStudents" ("StudentID","PreviousLevelCourses")
             VALUES ($1,$2::text[])
             ON CONFLICT ("StudentID") DO UPDATE SET "PreviousLevelCourses" = EXCLUDED."PreviousLevelCourses"`,
            [studentId, courses]
          );
        }
        const lvRaw = data?.Level;
        if (lvRaw !== undefined && lvRaw !== null && String(lvRaw).trim() !== "") {
          const lv = Number(lvRaw);
          if (Number.isInteger(lv) && lv >= 1 && lv <= 12) {
            await client.query(`UPDATE public."Students" SET "level" = $2 WHERE "StudentID" = $1`, [studentId, lv]);
          }
        }
      }
    }

    const remaining = await client.query(
      `SELECT COUNT(*) FILTER (WHERE "Status" = 'pending') AS remaining
         FROM public."CommitteeRequestStudents" WHERE "RequestID" = $1`, [id]);
    if (Number(remaining.rows[0].remaining) === 0) {
      await client.query(
        `UPDATE public."CommitteeRequests"
            SET "Status"='fulfilled',"HandledAt"=now(),"UpdatedAt"=now()
          WHERE "RequestID"=$1`, [id]);
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    handle500(res, "respondForStudent error", err);
  } finally {
    client.release();
  }
};
