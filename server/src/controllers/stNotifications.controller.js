// server/src/controllers/stNotifications.controller.js
import pool from "../../DataBase_config/DB_config.js";

/** موجودة عندك مسبقًا… (لا تغيّرها لو محدثة عندك) */
export async function getStudentNotifications(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const NAME_SQL = `
      (COALESCE(u."First_name",'') ||
       CASE WHEN u."First_name" IS NOT NULL AND u."Last_name" IS NOT NULL THEN ' ' ELSE '' END ||
       COALESCE(u."Last_name",'')) AS "Full_name"
    `;

    const sql = `
      SELECT 
        n."NotificationID",
        n."Message",
        n."CreatedAt",
        n."Type",
        n."ReceiverID",
        n."IsRead",
        n."ReadAt",
        ${NAME_SQL},
        u."Email" AS "Email",
        sch."Level"   AS "ScheduleLevel",
        sch."GroupNo" AS "GroupNo"
      FROM "Notifications" n
      LEFT JOIN "User"     u   ON u."UserID" = n."CreatedBy"
      LEFT JOIN "Schedule" sch ON sch."ScheduleID" = n."EntityId"
      WHERE 
        (n."Type" = 'schedule' OR n."Type" = 'sc_available')
        AND n."ReceiverID" IS NULL
      ORDER BY n."CreatedAt" DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(sql, [limit, offset]);

    const formatted = rows.map(r => ({
      id: r.NotificationID,
      title: "Schedule is available",
      message: r.Message || "You can now view the schedule.",
      createdAt: r.CreatedAt,
      type: r.Type,
      Full_name: r.Full_name || null,
      Email: r.Email || null,
      ScheduleLevel: r.ScheduleLevel ?? null,
      GroupNo: r.GroupNo ?? null,
      IsRead: !!r.IsRead,
      ReadAt: r.ReadAt || null,
    }));

    res.json({ rows: formatted });
  } catch (err) {
    console.error("Error fetching student notifications:", err);
    res.status(500).json({ error: "Failed to fetch student notifications" });
  }
}

/** NEW: PUT /api/st-notifications/mark-all-read */
export async function markAllStudentScheduleRead(req, res) {
  try {
    const sql = `
      UPDATE "Notifications" n
      SET "IsRead" = TRUE,
          "ReadAt" = COALESCE(n."ReadAt", NOW())
      WHERE (n."Type" = 'schedule' OR n."Type" = 'sc_available')
        AND n."ReceiverID" IS NULL
        AND n."IsRead" = FALSE
      RETURNING n."NotificationID";
    `;
    const { rows } = await pool.query(sql);
    res.json({ updated: rows.length });
  } catch (err) {
    console.error("Error markAllStudentScheduleRead:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}