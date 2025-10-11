// server/src/controllers/notifications.controller.js
import pool from "../../DataBase_config/DB_config.js";

// ✅ الأنواع الوحيدة المسموح بها للـ SC
const ALLOWED_TYPES_FOR_SC = [
  "schedule_feedback_student",
  "tlc_schedule_feedback",
  "register_to_scheduler",
];

/**
 * GET /api/notifications/sc
 * Query params:
 *  - type: schedule_feedback_student | tlc_schedule_feedback | register_to_scheduler
 *  - unread: 1
 *  - limit, offset
 *
 * "All types" = الأنواع الثلاثة أعلاه فقط
 */
export async function getSCNotifications(req, res) {
  const { type, unread, limit = 50, offset = 0 } = req.query;
  console.log("➡️ getSCNotifications params:", req.query); // ✅ DEBUG

  // ✅ تحقّق من صحة النوع إن تم تمريره
  if (type && !ALLOWED_TYPES_FOR_SC.includes(type)) {
    console.warn("⚠️ Invalid type passed:", type);
    return res.status(400).json({
      error: `Invalid type. Allowed: ${ALLOWED_TYPES_FOR_SC.join(", ")}`,
    });
  }

  const NAME_SQL = `
    (COALESCE(u."First_name",'') ||
     CASE WHEN u."First_name" IS NOT NULL AND u."Last_name" IS NOT NULL THEN ' ' ELSE '' END ||
     COALESCE(u."Last_name",'')) AS "Full_name"
  `;

  // ✅ قاعدة الاختيار: دائماً نحصر بالأنواع الثلاثة (سواء موجّهة لـSC أو عامة)
  //   - نسمح بالسجلات الموجّهة لأي عضو Role='sc'
  //   - ونسمح بالسجلات العامة ReceiverID IS NULL
  //   - لكن دائماً AND n."Type" = ANY($1)
  const base = `
    FROM "Notifications" n
    LEFT JOIN "User" u ON u."UserID" = n."CreatedBy"
    LEFT JOIN "Schedule" sch ON sch."ScheduleID" = n."EntityId"
    WHERE (
      (n."ReceiverID" IN (SELECT "UserID" FROM "User" WHERE lower("Role") = 'sc')
       OR n."ReceiverID" IS NULL)
      AND n."Type" = ANY ($1)
    )
  `;

  const params = [ALLOWED_TYPES_FOR_SC.slice()]; // $1 = الأنواع المسموحة فقط
  const where = [];
  let idx = 2;

  // ✅ فلتر إضافي اختياري على النوع
  if (type) {
    where.push(`n."Type" = $${idx++}`);
    params.push(type);
  }

  // ✅ فلتر غير مقروء
  if (String(unread) === "1") {
    where.push(`n."IsRead" = FALSE`);
  }

  const whereSql = where.length ? ` AND ${where.join(" AND ")}` : "";

  // ✅ توليد عنوان معروض TitleDisplay:
  //    - لو Title موجود نستخدمه
  //    - لو النوع register_to_scheduler نرجّع "New Request"
  //    - وإلا نحوّل النوع إلى صيغة Title Case مع استبدال "_" بمسافة
  const sql = `
    SELECT
      n."NotificationID",
      -- العنوان الأصلي (قد يكون NULL)
      n."Title",
      -- العنوان المعروض مع الافتراضات
      COALESCE(
        n."Title",
        CASE
          WHEN n."Type" = 'register_to_scheduler' THEN 'New Request'
          ELSE INITCAP(REPLACE(n."Type",'_',' '))
        END
      ) AS "TitleDisplay",
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
      sch."Level" AS "ScheduleLevel",
      sch."GroupNo" AS "GroupNo"
    ${base}
    ${whereSql}
    ORDER BY n."CreatedAt" DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;

  params.push(Math.max(0, Number(limit) || 50));
  params.push(Math.max(0, Number(offset) || 0));

  try {
    console.log("➡️ Executing SQL:", sql, params); // ✅ DEBUG
    const { rows } = await pool.query(sql, params);
    console.log("✅ getSCNotifications rows:", rows.length); // ✅ DEBUG
    res.json(rows);
  } catch (err) {
    console.error("❌ getSCNotifications error:", err);
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
  console.log("➡️ markNotificationRead:", id, isRead); // ✅ DEBUG

  if (!id || typeof isRead !== "boolean") {
    return res.status(400).json({ error: "id and boolean isRead are required" });
  }

  const sql = `
    UPDATE "Notifications"
    SET "IsRead" = $1,
        "ReadAt" = CASE WHEN $1 THEN NOW() ELSE NULL END
    WHERE "NotificationID" = $2
    RETURNING *;
  `;

  try {
    const { rows } = await pool.query(sql, [isRead, id]);
    console.log("✅ markNotificationRead updated:", rows.length); // ✅ DEBUG
    if (!rows.length) return res.status(404).json({ error: "Notification not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ markNotificationRead error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

/**
 * PUT /api/notifications/sc/mark-all-read
 * Body (اختياري): { type: one of ALLOWED_TYPES_FOR_SC }
 *
 * يعلّم كمقروء:
 *  - كل الموجّه لأعضاء SC
 *  - والعامة (ReceiverID IS NULL)
 *  - دائمًا محصور بالأنواع الثلاثة
 *  - ولو تم تمرير type نقيّد عليه أيضًا
 */
export async function markAllSCRead(req, res) {
  const { type } = req.body ?? {};
  console.log("➡️ markAllSCRead type:", type); // ✅ DEBUG

  if (type && !ALLOWED_TYPES_FOR_SC.includes(type)) {
    console.warn("⚠️ Invalid type passed to markAllSCRead:", type);
    return res.status(400).json({
      error: `Invalid type. Allowed: ${ALLOWED_TYPES_FOR_SC.join(", ")}`,
    });
  }

  const params = [ALLOWED_TYPES_FOR_SC.slice()];
  let idx = 2;

  // ✅ نفس تقييد الأنواع في UPDATE
  const base = `
    UPDATE "Notifications" n
    SET "IsRead" = TRUE,
        "ReadAt" = COALESCE(n."ReadAt", NOW())
    WHERE (
      (n."ReceiverID" IN (SELECT "UserID" FROM "User" WHERE lower("Role") = 'sc')
       OR n."ReceiverID" IS NULL)
      AND n."Type" = ANY ($1)
    )
      AND n."IsRead" = FALSE
  `;

  const extra = type ? ` AND n."Type" = $${idx++}` : "";
  if (type) params.push(type);

  const sql = `${base}${extra} RETURNING n."NotificationID";`;

  try {
    console.log("➡️ Executing SQL:", sql, params); // ✅ DEBUG
    const { rows } = await pool.query(sql, params);
    console.log("✅ markAllSCRead updated:", rows.length); // ✅ DEBUG
    res.json({ updated: rows.length });
  } catch (err) {
    console.error("❌ markAllSCRead error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}