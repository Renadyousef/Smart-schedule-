import pool from "../../DataBase_config/DB_config.js";

/**
 * Dashboard Data Controller
 * Fetch schedule stats: by status, by level, by week
 */
export const getDashboardStats = async (req, res) => {
  try {
    // 1️⃣ Count schedules by Status (case-sensitive)
    const { rows: statusStats } = await pool.query(`
      SELECT "Status" AS status, COUNT(*) AS count
      FROM "Schedule"
      GROUP BY "Status"
    `);

    // 2️⃣ Count by Level (used for elective chart)
    const { rows: levelStats } = await pool.query(`
      SELECT "Level", COUNT(*) AS count
      FROM "Schedule"
      GROUP BY "Level"
      ORDER BY "Level" ASC
    `);

    // 3️⃣ Weekly trend (approximate by week number of UpdatedAt)
    const { rows: weeklyStats } = await pool.query(`
      SELECT EXTRACT(WEEK FROM "UpdatedAt") AS week, COUNT(*) AS count
      FROM "Schedule"
      GROUP BY week
      ORDER BY week
    `);

    res.json({ statusStats, levelStats, weeklyStats });
  } catch (err) {
    console.error("Error in getDashboardStats:", err);
    res.status(500).json({ error: "Server error" });
  }
};
