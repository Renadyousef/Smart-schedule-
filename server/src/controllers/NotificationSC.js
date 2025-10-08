import pool from "../../DataBase_config/DB_config.js";

/** GET /Notifications/view
 * يدعم ?limit=20&offset=0 أو ?cursor=ISOdate لاحقًا
 */
export const fetchMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.UserID; // حسب الـ verifyToken عندكم
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const q = `
      SELECT
        n."NotificationID"        AS id,
        n."Message"               AS message,
        n."CreatedAt"             AS created_at,
        n."IsRead"                AS is_read,
        n."Type"                  AS type,
        n."Entity"                AS entity,
        n."EntityId"              AS entity_id,
        sender."UserID"           AS sender_id,
        sender."Role"             AS sender_type,
        sender."Email"            AS sender_email,
        recv."UserID"             AS receiver_id,
        recv."Email"              AS receiver_email
      FROM "Notifications" n
      JOIN "User" recv   ON recv."UserID" = n."ReceiverID"
      LEFT JOIN "User" sender ON sender."UserID" = n."CreatedBy"
      WHERE n."ReceiverID" = $1
      ORDER BY n."CreatedAt" DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await pool.query(q, [userId, limit, offset]);
    return res.status(200).json({ success: true, notifications: rows });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
};

/** PATCH /Notifications/:id/read */
export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.UserID;
    const id = Number(req.params.id);
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: "Invalid id" });

    const q = `
      UPDATE "Notifications"
         SET "IsRead" = true, "ReadAt" = NOW()
       WHERE "NotificationID" = $1 AND "ReceiverID" = $2
       RETURNING "NotificationID" AS id, "IsRead" AS is_read, "ReadAt" AS read_at
    `;
    const { rows } = await pool.query(q, [id, userId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: "Not found" });

    return res.status(200).json({ success: true, ...rows[0] });
  } catch (err) {
    console.error("markNotificationRead error:", err);
    return res.status(500).json({ success: false, error: "Failed to update notification" });
  }
};

/** POST /Notifications
 * body: { message, receiverId, type?, entity?, entityId? }
 * المرسل يؤخذ من التوكن (CreatedBy)
 */
export const createNotification = async (req, res) => {
  try {
    const createdBy = req.user?.id || req.user?.UserID || null;
    const {
      message,
      receiverId,
      type = "general",
      entity = null,
      entityId = null,
    } = req.body || {};

    if (!message || !receiverId) {
      return res.status(400).json({ success: false, error: "message and receiverId are required" });
    }

    const q = `
      INSERT INTO "Notifications"
        ("Message", "CreatedAt", "CreatedBy", "ReceiverID", "Type", "Entity", "EntityId")
      VALUES ($1, NOW(), $2, $3, $4, $5, $6)
      RETURNING "NotificationID" AS id
    `;
    const { rows } = await pool.query(q, [message, createdBy, receiverId, type, entity, entityId]);

    return res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("createNotification error:", err);
    return res.status(500).json({ success: false, error: "Failed to create notification" });
  }
};

/** Helper لتُستدعى داخليًا من أي كنترولر (ريكوست/فيدباك...) */
export async function pushNotification({
  message,
  receiverId,
  createdBy = null,
  type = "general",
  entity = null,
  entityId = null,
}, client = pool) {
  const q = `
    INSERT INTO "Notifications"
      ("Message", "CreatedAt", "CreatedBy", "ReceiverID", "Type", "Entity", "EntityId")
    VALUES ($1, NOW(), $2, $3, $4, $5, $6)
    RETURNING "NotificationID" AS id
  `;
  const { rows } = await client.query(q, [message, createdBy, receiverId, type, entity, entityId]);
  return rows[0].id;
}
