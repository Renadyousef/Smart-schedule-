// controllers/Auth/signin.js
import bcrypt from "bcrypt";
import pool from "../../../DataBase_config/DB_config.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await pool.query(
      `
      SELECT
        u."UserID"       AS "id",
        u."Email"        AS "email",
        u."Password"     AS "password_hash",
        u."Role"         AS "role",
        u."First_name"   AS "firstName",
        u."Last_name"    AS "lastName",
        u."DepartmentID" AS "departmentId",
        d."Name"         AS "department",
        s."level"        AS "level"
      FROM "User" u
      LEFT JOIN "Departments" d ON d."DepartmentID" = u."DepartmentID"
      LEFT JOIN "Students"   s  ON s."StudentID"    = u."UserID"
      WHERE LOWER(u."Email") = LOWER($1)
      `,
      [email]
    );

    if (!rows.length) return res.status(400).json({ message: "Invalid email or password" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.json({
      message: "Sign in successful",
      token,
      user: {
        id: user.id,
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        email: user.email,
        role: user.role,
        departmentId: user.departmentId ?? null,
        department: user.department ?? null,
        level: user.level ?? null, // ← مهم
      },
    });
  } catch (e) {
    console.error("Signin error:", e);
    return res.status(500).json({ message: "Sign in failed" });
  }
};
