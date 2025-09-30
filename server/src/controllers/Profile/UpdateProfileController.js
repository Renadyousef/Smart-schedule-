// controllers/Profile/UpdateProfileController.js
import pool from "../../../DataBase_config/DB_config.js";

export const update_profile = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { firstName, lastName, email, departmentId, level } = req.body;

    // تحقق level اختياري
    let levelInt = null;
    if (level !== undefined && level !== null && String(level).trim() !== "") {
      const parsed = parseInt(level, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 8) {
        return res.status(400).json({ message: "Level must be an integer between 1 and 8." });
      }
      levelInt = parsed;
    }

    await client.query("BEGIN");

    // نحدّث جدول User
    // ثم نقرأ النتيجة مع مستوى الطالب (إن وجد) في SELECT واحدة
    const result = await client.query(
      `
      WITH u AS (
        UPDATE "User"
        SET "First_name"   = $1,
            "Last_name"    = $2,
            "Email"        = $3,
            "DepartmentID" = $4
        WHERE "UserID"     = $5
        RETURNING "UserID","First_name","Last_name","Email","Role","DepartmentID"
      )
      SELECT 
        u."UserID"        AS "id",
        u."First_name"    AS "firstName",
        u."Last_name"     AS "lastName",
        u."Email"         AS "email",
        u."Role"          AS "role",
        u."DepartmentID"  AS "departmentId",
        s."level"         AS "level"
      FROM u
      LEFT JOIN "Students" s ON s."StudentID" = u."UserID";
      `,
      [firstName, lastName, email, departmentId ?? null, id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    // إذا أرسل level نكتب/نحدّث صف الطالب
    if (levelInt !== null) {
      await client.query(
        `INSERT INTO "Students" ("StudentID","level")
         VALUES ($1,$2)
         ON CONFLICT ("StudentID")
         DO UPDATE SET "level" = EXCLUDED."level"`,
        [id, levelInt]
      );
    }

    // بعد احتمال تعديل مستوى الطالب، نرجّع SELECT نهائية مضمونة التزامن
    const finalUser = (
      await client.query(
        `SELECT 
           u."UserID"       AS "id",
           u."First_name"   AS "firstName",
           u."Last_name"    AS "lastName",
           u."Email"        AS "email",
           u."Role"         AS "role",
           u."DepartmentID" AS "departmentId",
           s."level"        AS "level"
         FROM "User" u
         LEFT JOIN "Students" s ON s."StudentID" = u."UserID"
         WHERE u."UserID" = $1`,
        [id]
      )
    ).rows[0];

    await client.query("COMMIT");

    return res.json({
      message: "Profile updated successfully",
      user: finalUser, // فيه level دائمًا (قد يكون null إن ما انحفظ)
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("update_profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
  
};
