import pool from "../../DataBase_config/DB_config.js";

/* Helpers */
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

/* ========== GET /api/irregular-student  (list all) ========== */
export async function listIrregularStudents(req, res) {
  try {
    const sql = `
      SELECT
        i."StudentID"              AS student_id,
        i."PreviousLevelCourses"   AS previous_courses,   -- text[]
        s.level                    AS level,
        s.program                  AS program,            -- text[] أو _text
        u."Full_name"              AS full_name,
        u."Email"                  AS email
      FROM "IrregularStudents" i
      LEFT JOIN "Students" s ON s."StudentID" = i."StudentID"
      LEFT JOIN "User"     u ON u."UserID"   = i."StudentID"
      ORDER BY i."StudentID" DESC;   -- الأحدث أولاً حسب الإضافة
    `;
    const { rows } = await pool.query(sql, []);
    const data = rows.map((r) => ({
      studentId: r.student_id,
      fullName: r.full_name ?? null,
      email: r.email ?? null,
      level: r.level ?? null,
      program: asArray(r.program),
      previousCourses: asArray(r.previous_courses),
    }));
    return res.json(data);
  } catch (err) {
    console.error("listIrregularStudents", err);
    return res
      .status(500)
      .json({ error: "ServerError", message: err?.message ?? "unknown" });
  }
}

/* ========== GET /api/irregular-student/:studentId ========== */
export async function getIrregularStudentById(req, res) {
  try {
    const idParam = req.params.studentId ?? req.query.studentId;
    const studentId = Number(idParam);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res
        .status(400)
        .json({ error: "BadRequest", message: "studentId مطلوب كعدد صحيح موجب." });
    }

    const sql = `
      SELECT
        i."StudentID"              AS student_id,
        i."PreviousLevelCourses"   AS previous_courses,
        s.level                    AS level,
        s.program                  AS program,
        u."Full_name"              AS full_name,
        u."Email"                  AS email
      FROM "IrregularStudents" i
      LEFT JOIN "Students" s ON s."StudentID" = i."StudentID"
      LEFT JOIN "User"     u ON u."UserID"   = i."StudentID"
      WHERE i."StudentID" = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(sql, [studentId]);

    if (!rows?.length) {
      return res
        .status(404)
        .json({ error: "NotFound", message: "لا يوجد سجل لطالب غير منتظم بهذا الرقم." });
    }

    const r = rows[0];
    return res.json({
      studentId: r.student_id,
      fullName: r.full_name ?? null,
      email: r.email ?? null,
      level: r.level ?? null,
      program: asArray(r.program),
      previousCourses: asArray(r.previous_courses),
    });
  } catch (err) {
    console.error("getIrregularStudentById", err);
    return res
      .status(500)
      .json({ error: "ServerError", message: err?.message ?? "unknown" });
  }
}

/* ========== GET /api/irregular-student/me  (اختياري) ========== */
export async function getIrregularStudentMe(req, res) {
  try {
    const authedId = Number(req.user?.id || req.user?.UserID);
    if (!Number.isFinite(authedId) || authedId <= 0) {
      return res.status(401).json({ error: "Unauthorized", message: "Authentication required." });
    }
    // أعد استخدام الدالة الأساسية
    req.params.studentId = String(authedId);
    return getIrregularStudentById(req, res);
  } catch (err) {
    console.error("getIrregularStudentMe", err);
    return res
      .status(500)
      .json({ error: "ServerError", message: err?.message ?? "unknown" });
  }
}
