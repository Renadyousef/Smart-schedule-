// server/src/controllers/IrregularStudentsController.js
import pool from "../../DataBase_config/DB_config.js";

/* ---------- helpers ---------- */

// نحدد اسم جدول المستخدمين تلقائيًا: "Users" أو "User"
async function detectUsersTable(client) {
  const q1 = await client.query(`select to_regclass('public."Users"') as r`);
  if (q1.rows[0]?.r) return `public."Users"`;
  const q2 = await client.query(`select to_regclass('public."User"') as r`);
  if (q2.rows[0]?.r) return `public."User"`;
  throw new Error(`Neither public."Users" nor public."User" table exists`);
}

// هل عمود last_login_at موجود؟
async function hasLastLogin(client, usersTableName) {
  const tbl = usersTableName.replace(/public\./, "").replace(/"/g, "");
  const chk = await client.query(
    `select 1
       from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = 'last_login_at'
      limit 1`,
    [tbl]
  );
  return chk.rowCount > 0;
}

const COURSE_RE = /^[A-Za-z0-9_-]{1,20}$/;
function normalizeCourses(courses) {
  if (!Array.isArray(courses)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of courses) {
    const v = String(raw || "").trim();
    if (!v) continue;
    if (!COURSE_RE.test(v)) continue;
    const upper = v.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      out.push(upper);
    }
  }
  return out;
}

/* ---------- search by name (ترجيع isDisabled بدل الفلترة) ---------- */
/** GET /irregular/students/search?name=ali&limit=8&offset=0&depId=4 */
export const searchStudentsByName = async (req, res) => {
  const name = String(req.query.name || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit || "8", 10), 1), 50);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  if (name.length < 2) {
    return res.status(400).json({ error: "name must be at least 2 characters" });
  }

  const client = await pool.connect();
  try {
    const usersTable = await detectUsersTable(client);

    // depId اختياري من الكويري، fallback إلى 4
    let depId = Number(req.query.depId);
    if (!Number.isFinite(depId)) {
      // لو عندك الهيلبر getDepartmentIdByName: جرّبي تجيبيه بالاسم، وإلا 4
      try {
        depId = await getDepartmentIdByName(client, "software engineering");
      } catch {}
      if (!Number.isFinite(depId)) depId = 4;
    }

    const pattern = `%${name}%`;

    const q = await client.query(
      `
      select
        s."StudentID" as "studentId",
        coalesce(u."Full_name",
                 trim(coalesce(u."First_name",'') || ' ' || coalesce(u."Last_name",''))) as "fullName",
        u."DepartmentID" as "departmentId",
        case when u."DepartmentID" is distinct from $4 then true else false end as "isDisabled"
      from public."Students" s
      join ${usersTable} u on u."UserID" = s."StudentID"
      where u."Role" = 'student'
        and (
          u."Full_name"  ilike $1 or
          u."First_name" ilike $1 or
          u."Last_name"  ilike $1
        )
      order by "fullName" asc
      limit $2 offset $3
      `,
      [pattern, limit, offset, depId]
    );

    return res.json({
      ok: true,
      departmentId: depId,
      results: q.rows.map(r => ({
        studentId: r.studentId,
        fullName: r.fullName || "",
        departmentId: r.departmentId,
        isDisabled: !!r.isDisabled
      })),
      limit,
      offset,
    });
  } catch (err) {
    console.error("searchStudentsByName error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};


/* ---------- get student info ---------- */
/** GET /irregular/students/:id  -> fullName + level(from Students) + hasLoggedIn + irregular(PreviousLevelCourses) */
export const getStudentName = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "id must be an integer" });
  }

  const client = await pool.connect();
  try {
    // level من Students
    const s = await client.query(
      'select "level" from public."Students" where "StudentID" = $1',
      [id]
    );
    if (s.rowCount === 0) {
      return res.status(404).json({ error: "Student not found in Students" });
    }
    const currentLevel = s.rows[0]?.level ?? null;

    const usersTable = await detectUsersTable(client);
    const hasLL = await hasLastLogin(client, usersTable);

    // Users + آخر دخول (إن وجد العمود)
    const u = await client.query(
      `select "Full_name","First_name","Last_name"${hasLL ? `,"last_login_at"` : ``}
         from ${usersTable} where "UserID" = $1`,
      [id]
    );
    if (u.rowCount === 0) {
      return res.status(404).json({ error: "User record not found for this StudentID" });
    }
    const row = u.rows[0];
    const fullName =
      row.Full_name ||
      [row.First_name, row.Last_name].filter(Boolean).join(" ");
    const hasLoggedIn = hasLL ? row.last_login_at != null : true; // لو ما فيه عمود نعتبرها true

    // IrregularStudents (قد لا يوجد)
    const irr = await client.query(
      `select "PreviousLevelCourses"
         from public."IrregularStudents"
        where "StudentID" = $1`,
      [id]
    );

    return res.json({
      fullName: fullName || "",
      level: currentLevel,
      hasLoggedIn,
      irregular: irr.rows[0] || null
    });
  } catch (err) {
    console.error("getStudentName error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/* ---------- save irregular (append by default) ---------- */
/**
 * POST /irregular
 * body: { studentId: int, courses: string[], level?: int, replace?: boolean }
 * - يدمج الكورسات الجديدة مع الموجودة (بدون تكرار) بشكل افتراضي
 * - إذا replace=true يستبدل القائمة كاملة
 * - لو level مُرسل: يحدّث public."Students".level
 */
export const addIrregularStudent = async (req, res) => {
  try {
    const { studentId, courses, level, replace } = req.body;

    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ error: "studentId must be an integer" });
    }
    const cleanCourses = normalizeCourses(courses);
    const replaceMode = String(replace).toLowerCase() === "true";

    const client = await pool.connect();
    try {
      await client.query("begin");

      // الطالب موجود؟
      const s = await client.query(
        'select "level" from public."Students" where "StudentID" = $1',
        [studentId]
      );
      if (s.rowCount === 0) {
        await client.query("rollback");
        return res.status(404).json({ error: "Student not found in Students" });
      }

      // تحديث level (اختياري)
      if (level !== undefined && level !== null && String(level).trim() !== "") {
        const lv = Number(level);
        if (!Number.isInteger(lv) || lv < 1 || lv > 12) {
          await client.query("rollback");
          return res.status(400).json({ error: "level must be an integer between 1 and 12" });
        }
        await client.query(
          'update public."Students" set "level" = $2 where "StudentID" = $1',
          [studentId, lv]
        );
      }

      // (اختياري) التحقق من آخر دخول لو العمود موجود
      const usersTable = await detectUsersTable(client);
      const hasLL = await hasLastLogin(client, usersTable);
      if (hasLL) {
        const u = await client.query(
          `select "last_login_at" from ${usersTable} where "UserID" = $1`,
          [studentId]
        );
        if (u.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "User record not found" });
        }
        if (u.rows[0]?.last_login_at == null) {
          await client.query("rollback");
          return res.status(403).json({
            error: "Student must log in at least once before registrar can add irregular record.",
          });
        }
      }

      // جلب القديمة + دمج/استبدال
      const ex = await client.query(
        `select "PreviousLevelCourses" from public."IrregularStudents" where "StudentID" = $1 for update`,
        [studentId]
      );
      const existing = (ex.rows[0]?.PreviousLevelCourses || [])
        .map((x) => String(x || "").trim().toUpperCase())
        .filter(Boolean);

      let finalCourses;
      if (replaceMode) {
        finalCourses = cleanCourses; // استبدال كامل
      } else {
        const seen = new Set();
        finalCourses = [];
        for (const c of [...existing, ...cleanCourses]) {
          if (!COURSE_RE.test(c)) continue;
          const up = c.toUpperCase();
          if (!seen.has(up)) {
            seen.add(up);
            finalCourses.push(up);
          }
        }
      }

      // upsert بالقائمة النهائية
      const upsert = await client.query(
        `insert into public."IrregularStudents" ("StudentID","PreviousLevelCourses")
         values ($1, $2::text[])
         on conflict ("StudentID")
         do update set "PreviousLevelCourses" = excluded."PreviousLevelCourses"
         returning "StudentID","PreviousLevelCourses";`,
        [studentId, finalCourses]
      );

      // الاسم للعرض
      const nameQ = await client.query(
        `select coalesce("Full_name",
                 trim(coalesce("First_name",'') || ' ' || coalesce("Last_name",''))) as "fullName"
           from ${usersTable} where "UserID" = $1`,
        [studentId]
      );

      await client.query("commit");

      return res.json({
        ok: true,
        data: {
          ...upsert.rows[0],
          fullName: nameQ.rows[0]?.fullName || null,
          level: level ?? s.rows[0]?.level ?? null,
        }
      });
    } catch (err) {
      try { await client.query("rollback"); } catch {}
      console.error("addIrregularStudent error:", err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("addIrregularStudent outer error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
