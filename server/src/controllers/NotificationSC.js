import pool from '../../DataBase_config/DB_config.js';

export const fetch_notifications = async (req, res) => {
  try {
    const query = `
      SELECT n."NotificationID" AS notificationid,
             n."Message" AS message,
             n."CreatedAt" AS createdat,
             u."Role" AS sender_type,
             u."Email" AS sender_email
      FROM "Notifications" n
      LEFT JOIN "User" u
      ON n."CreatedBy" = u."UserID"
      ORDER BY n."CreatedAt" DESC
      LIMIT 20
    `;

    const { rows } = await pool.query(query);

    res.status(200).json({ success: true, notifications: rows });
  } catch (err) {
    console.error("Error fetching notifications:", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
};
