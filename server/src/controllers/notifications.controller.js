// server/src/controllers/notifications.controller.js
import pool from "../../DataBase_config/DB_config.js";

// الأنواع العامة المسموح عرضها إذا كان ReceiverID NULL
const PUBLIC_TYPES_FOR_SC = ["schedule_feedback_student", "tlc_schedule_feedback"];

/**
 * GET /api/notifications/sc
 * Query params:
 *  - type: schedule_feedback_student | tlc_schedule_feedback | new_request
 *  - unread: 1 (غير مقروء فقط)
 *  - limit: رقم (افتراضي 50)
 *  - offset: رقم (افتراضي 0)
 */
export async function getSCNotifications(req, res) {
  const { type, unread, limit = 50, offset = 0 } = req.query;

  // الاسم الكامل وفق أعمدة User الفعلية: First_name / Last_name
  const NAME_SQL = `
    (COALESCE(u."First_name",'') ||
     CASE WHEN u."First_name" IS NOT NULL AND u."Last_name" IS NOT NULL THEN ' ' ELSE '' END ||
     COALESCE(u."Last_name",'')) AS "Full_name"
  `;

  // قاعدة الاختيار:
  // 1) إشعارات موجّهة مباشرة لأعضاء SC
  // 2) إشعارات عامة (ReceiverID IS NULL) لكن من الأنواع المحددة فقط
  const base = `
    FROM "Notifications" n
    JOIN "User" u ON u."UserID" = n."CreatedBy"
    LEFT JOIN "Schedule" sch ON sch."ScheduleID" = n."EntityId"
    WHERE (
      n."ReceiverID" IN (SELECT "UserID" FROM "User" WHERE lower("Role") = 'sc')
      OR (n."ReceiverID" IS NULL AND n."Type" = ANY ($1))
    )
  `;

  const params = [PUBLIC_TYPES_FOR_SC.slice()]; // $1 = الأنواع العامة المسموح بها
  const where = [];
  let idx = 2; // القادم بعد مصفوفة $1

  // فلتر النوع (يطبّق فوق القاعدة)
  if (type) {
    where.push(`n."Type" = $${idx++}`);
    params.push(type);
  }
  // فلتر غير مقروء
  if (String(unread) === "1") {
    where.push(`n."IsRead" = FALSE`);
  }

  const whereSql = where.length ? ` AND ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      n."NotificationID",
      n."Title",
      n."Message",
      n."CreatedAt",
      n."CreatedBy",
      n."UserID",
      n."ReceiverID",
      n."Type",
      n."Entity",
      n."EntityId",
      n."IsRead",
      n."ReadAt",
      ${NAME_SQL},
      u."Email" AS "Email",
      sch."Level" AS "ScheduleLevel"
    ${base}
    ${whereSql}
    ORDER BY n."CreatedAt" DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;

  params.push(Math.max(0, Number(limit) || 50));
  params.push(Math.max(0, Number(offset) || 0));

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("getSCNotifications error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
}

/**
 * PUT /api/notifications/:id/read
 * Body: { isRead: true|false }
 */
export async function markNotificationRead(req, res) {
  const id = Number(req.params.id);
  const { isRead } = req.body ?? {};
  if (!id || typeof isRead !== "boolean") {
    return res.status(400).json({ error: "id and boolean isRead are required" });
  }

  const sql = `
    UPDATE "Notifications"
    SET "IsRead" = $1,
        "ReadAt" = CASE WHEN $1 THEN NOW() ELSE NULL END
    WHERE "NotificationID" = $2
    RETURNING
      "NotificationID","Title","Message","CreatedAt","CreatedBy",
      "UserID","ReceiverID","Type","Entity","EntityId","IsRead","ReadAt";
  `;

  try {
    const { rows } = await pool.query(sql, [isRead, id]);
    if (!rows.length) return res.status(404).json({ error: "Notification not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("markNotificationRead error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

/**
 * PUT /api/notifications/sc/mark-all-read
 * Body (اختياري): { type: "schedule_feedback_student" | "tlc_schedule_feedback" | "new_request" }
 *
 * يعلّم كمقروء:
 *  - كل الإشعارات الموجهة لأعضاء SC
 *  - بالإضافة إلى العامة (ReceiverID IS NULL) من الأنواع المحددة فقط (PUBLIC_TYPES_FOR_SC)
 *  - وإن تم تمرير type، نقيّد على هذا النوع فقط
 */
export async function markAllSCRead(req, res) {
  const { type } = req.body ?? {};

  const params = [PUBLIC_TYPES_FOR_SC.slice()];
  let idx = 2;

  const base = `
    UPDATE "Notifications" n
    SET "IsRead" = TRUE,
        "ReadAt" = COALESCE(n."ReadAt", NOW())
    WHERE (
      n."ReceiverID" IN (SELECT "UserID" FROM "User" WHERE lower("Role") = 'sc')
      OR (n."ReceiverID" IS NULL AND n."Type" = ANY ($1))
    )
      AND n."IsRead" = FALSE
  `;

  const extra = type ? ` AND n."Type" = $${idx++}` : "";
  if (type) params.push(type);

  const sql = `${base}${extra} RETURNING n."NotificationID";`;

  try {
    const { rows } = await pool.query(sql, params);
    res.json({ updated: rows.length });
  } catch (err) {
    console.error("markAllSCRead error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}
