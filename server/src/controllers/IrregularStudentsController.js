import pool from "../../DataBase_config/DB_config.js";

/** فلترة ورصنمة أكواد المقررات */
const COURSE_RE = /^[A-Za-z0-9_-]{1,20}$/;
function normalizeCourses(courses) {
  if (!Array.isArray(courses)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of courses) {
    const v = String(raw || "").trim();
    if (!v) continue;
    if (!COURSE_RE.test(v)) continue; // تجاهل المدخل غير المطابق
    const upper = v.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      out.push(upper);
    }
  }
  return out;
}

/** GET /students/:id  -> يرجّع اسم الطالب (للاستخدام في Lookup من الواجهة) */
export const getStudentName = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "id must be an integer" });
  }

  const client = await pool.connect();
  try {
    // تأكد وجود الطالب في Students
    const chk = await client.query(
      'select 1 from public."Students" where "StudentID" = $1',
      [id]
    );
    if (chk.rowCount === 0) {
      return res.status(404).json({ error: "Student not found in Students" });
    }

    // جلب الاسم من Users
    const u = await client.query(
      `select "Full_name", "First_name", "Last_name"
         from public."Users" where "UserID" = $1`,
      [id]
    );
    if (u.rowCount === 0) {
      return res.status(404).json({ error: "User record not found for this StudentID" });
    }

    const row = u.rows[0];
    const fullName =
      row.Full_name ||
      [row.First_name, row.Last_name].filter(Boolean).join(" ");

    return res.json({
      fullName: fullName || "",
      user: {
        Full_name: row.Full_name || null,
        First_name: row.First_name || null,
        Last_name: row.Last_name || null,
      },
    });
  } catch (err) {
    console.error("getStudentName error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/** POST /irregular  -> upsert في IrregularStudents */
export const addIrregularStudent = async (req, res) => {
  try {
    const { studentId, courses } = req.body;

    // تحقق بسيط للمدخلات
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ error: "studentId must be an integer" });
    }
    const cleanCourses = normalizeCourses(courses);
    // نسمح بمصفوفة فاضية (لتفريغ الكورسات)؛ لو تبغي ترفضها، افحص length هنا.

    const client = await pool.connect();
    try {
      // هل الطالب موجود؟
      const check = await client.query(
        'select 1 from public."Students" where "StudentID" = $1',
        [studentId]
      );
      if (check.rowCount === 0) {
        return res.status(404).json({ error: "Student not found in Students" });
      }

      // upsert في IrregularStudents
      const upsert = await client.query(
        `insert into public."IrregularStudents"("StudentID","PreviousLevelCourses")
         values ($1, $2::text[])
         on conflict ("StudentID")
         do update set "PreviousLevelCourses" = excluded."PreviousLevelCourses"
         returning "StudentID","PreviousLevelCourses";`,
        [studentId, cleanCourses]
      );

      // (اختياري) رجّع الاسم مع النتيجة
      const u = await client.query(
        `select coalesce("Full_name", trim(concat(coalesce("First_name",''),' ',coalesce("Last_name",'')))) as "fullName"
           from public."Users" where "UserID" = $1`,
        [studentId]
      );

      return res.json({
        ok: true,
        data: {
          ...upsert.rows[0],
          fullName: u.rows[0]?.fullName || null,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("addIrregularStudent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
