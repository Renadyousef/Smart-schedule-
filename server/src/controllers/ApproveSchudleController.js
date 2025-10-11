import pool from "../../DataBase_config/DB_config.js";

/**
 * Approve a schedule by ScheduleID from TLC
 */
export const approveSchedule = async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isInteger(scheduleId)) {
      return res.status(400).json({ error: "scheduleId must be integer" });
    }

    // Update the status to 'approved'
    const sql = `
      UPDATE "Schedule"
      SET "Status" = 'approved'
      WHERE "ScheduleID" = $1
      RETURNING "ScheduleID", "Level", "GroupNo", "Status";
    `;
    const { rows } = await pool.query(sql, [scheduleId]);

    if (!rows.length) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({ message: "Schedule approved successfully", schedule: rows[0] });
  } catch (err) {
    console.error("approveSchedule error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
