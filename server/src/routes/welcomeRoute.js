import express from "express";
import { verifyToken } from "../middleware/verfiyToken.js"; // your middleware
import pool from '../../DataBase_config/DB_config.js'

const router = express.Router();

router.get("/welcome", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT "Full_name", "Role" FROM "User" WHERE "UserID" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `Welcome ${result.rows[0].Full_name}!`,
      role: result.rows[0].Role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;