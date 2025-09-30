// controllers/Profile/FetchProfileController.js
import pool from "../../../DataBase_config/DB_config.js";

export const fetch_profile = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT 
        u."UserID",
        u."First_name",
        u."Last_name",
        u."Email",
        u."Role",
        d."DepartmentID",
        d."Name" AS "DepartmentName",
        s."level" AS "Level"               -- لو موجود يرجع، وإلا تكون NULL
      FROM "User" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      LEFT JOIN "Students"    s ON s."StudentID"   = u."UserID"
      WHERE u."UserID" = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const r = rows[0];
    return res.json({
      id: r.UserID,
      firstName: r.First_name,
      lastName:  r.Last_name,
      email:     r.Email,
      role:      r.Role,
      department: {
        id:   r.DepartmentID,
        name: r.DepartmentName,
      },
      level: r.Level ?? null,              // null إذا ما فيه صف بـ Students
    });
  } catch (err) {
    console.error("fetch_profile error:", err.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
