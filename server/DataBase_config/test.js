// /api/test-db.js
import pool from "./DB_config.js"

export default async function handler(req, res) {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).json({ time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
