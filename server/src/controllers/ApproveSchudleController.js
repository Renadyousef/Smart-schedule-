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
    const userId = req.user?.id; //from the middlware

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

    const approvedSchedule = rows[0];

    // Insert notification for the approved schedule
    const notificationSql = `
      INSERT INTO "Notifications" ("Message", "CreatedAt", "CreatedBy", "Type", "IsRead", "EntityId")
      VALUES ($1, NOW(), $2, $3, false, $4)
      RETURNING "NotificationID", "Message";
    `;
    const notificationValues = [
      `Schedule Posted check the Schedule tab !`, // Message
      userId , // CreatedBy 
      'schedule', // Type
      scheduleId // EntityId points to the approved schedule to fetch in notificaions
    ];
    const { rows: notifRows } = await pool.query(notificationSql, notificationValues);

    res.json({ 
      message: "Schedule approved successfully", 
      schedule: approvedSchedule,
      notification: notifRows[0]
    });
  } catch (err) {
    console.error("approveSchedule error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
