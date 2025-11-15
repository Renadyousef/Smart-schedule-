import pool from "../../../DataBase_config/DB_config.js";

export const checkEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ exists: false, message: "Email is required" });

  try {
    const result = await pool.query(`SELECT 1 FROM "User" WHERE "Email"=$1`, [email]);
    const exists = result.rowCount > 0;
    return res.json({ exists });
  } catch (err) {
    console.error("CHECK_EMAIL_ERROR:", err);
    return res.status(500).json({ exists: false, message: "Server error" });
  }
};