// server/src/controllers/notifications.controller.js
import pool from "../../DataBase_config/DB_config.js";

/* ===== الأنواع المسموح بها للـ SC ===== */
const ALLOWED_TYPES_FOR_SC = [
  "schedule_feedback_student",
  "tlc_schedule_feedback",
  "register_to_scheduler",
  "respond_request", // ✅ النوع المطلوب
];

/* ===== اكتشاف جدول المستخدمين User/Users ===== */
async function detectUsersTable() {
  const q1 = await pool.query(`select to_regclass('public."Users"') as r`);
  if (q1.rows[0]?.r) return `public."Users"`;
  const q2 = await pool.query(`select to_regclass('public."User"') as r`);
  if (q2.rows[0]?.r) return `public."User"`;
  return `public."User"`;
}

/**
 * GET /api/notifications/sc
 * Query params:
 *  - type: schedule_feedback_student | tlc_schedule_feedback | register_to_scheduler | respond_request
 *  - unread: 1
 *  - limit, offset
 */
export async function getSCNotifications(req, res) {
  const { unread, limit = 50, offset = 0 } = req.query;
  const type = req.query.type ? String(req.query.type).toLowerCase().trim() : null;

  console.log("➡️ getSCNotifications params:", { ...req.query, type });

  if (type && !ALLOWED_TYPES_FOR_SC.includes(type)) {
    console.warn("⚠️ Invalid type passed:", type);
    return res.status(400).json({
      error: `Invalid type. Allowed: ${ALLOWED_TYPES_FOR_SC.join(", ")}`,
    });
  }

  try {
    const usersTable = await detectUsersTable();

    const NAME_SQL = `
      (COALESCE(u."First_name",'') ||
       CASE WHEN u."First_name" IS NOT NULL AND u."Last_name" IS NOT NULL THEN ' ' ELSE '' END ||
       COALESCE(u."Last_name",'')) AS "Full_name"
    `;

    // ✅ نعرض إشعارات الـ SC وكذلك العامة (ReceiverID IS NULL)
    const base = `
      FROM "Notifications" n
      LEFT JOIN ${usersTable} u
             ON u."UserID" = n."CreatedBy"
      LEFT JOIN "Schedule" sch
             ON sch."ScheduleID" = n."EntityId"
            AND n."Entity" = 'Schedule'
      WHERE (
        (
          n."ReceiverID" IN (SELECT "UserID" FROM ${usersTable} WHERE lower("Role") = 'sc')
          OR n."ReceiverID" IS NULL
        )
        AND n."Type" = ANY ($1)
      )
    `;

    const params = [ALLOWED_TYPES_FOR_SC.slice()];
    const where = [];
    let idx = 2;

    if (type) {
      where.push(`n."Type" = $${idx++}`);
      params.push(type);
    }

    if (String(unread) === "1") {
      where.push(`n."IsRead" = FALSE`);
    }

    const whereSql = where.length ? ` AND ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        n."NotificationID",
        n."Title",
        COALESCE(
          n."Title",
          CASE
            WHEN n."Type" = 'register_to_scheduler' THEN 'New Elective'
            WHEN n."Type" = 'respond_request'       THEN 'Respond request'
            ELSE INITCAP(REPLACE(n."Type",'_',' '))
          END
        ) AS "TitleDisplay",
        n."Message",
        n."Data" AS "Data",              -- ✅ مهم: نرجّع الـ Data للفرونت
        n."CreatedAt",
        n."CreatedBy",
        n."ReceiverID",
        n."Type",
        n."Entity",
        n."EntityId",
        n."IsRead",
        n."ReadAt",
        ${NAME_SQL},
        ${NAME_SQL.replace(' AS "Full_name"', ' AS "CreatedByName"')},
        u."Email" AS "Email",
        sch."Level"   AS "ScheduleLevel",
        sch."GroupNo" AS "GroupNo"
      ${base}
      ${whereSql}
      ORDER BY n."CreatedAt" DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    params.push(Math.max(0, Number(limit) || 50));
    params.push(Math.max(0, Number(offset) || 0));

    console.log("➡️ Executing SQL:", sql, params);
    const { rows } = await pool.query(sql, params);
    console.log("✅ getSCNotifications rows:", rows.length);
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
  console.log("➡️ markNotificationRead:", id, isRead);

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
 */
export async function markAllSCRead(req, res) {
  const { type } = req.body ?? {};
  console.log("➡️ markAllSCRead type:", type);

  if (type && !ALLOWED_TYPES_FOR_SC.includes(type)) {
    console.warn("⚠️ Invalid type passed to markAllSCRead:", type);
    return res.status(400).json({
      error: `Invalid type. Allowed: ${ALLOWED_TYPES_FOR_SC.join(", ")}`,
    });
  }

  try {
    const usersTable = await detectUsersTable();

    const params = [ALLOWED_TYPES_FOR_SC.slice()];
    let idx = 2;

    const base = `
      UPDATE "Notifications" n
      SET "IsRead" = TRUE,
          "ReadAt" = COALESCE(n."ReadAt", NOW())
      WHERE (
        (n."ReceiverID" IN (SELECT "UserID" FROM ${usersTable} WHERE lower("Role") = 'sc')
         OR n."ReceiverID" IS NULL)
        AND n."Type" = ANY ($1)
      )
        AND n."IsRead" = FALSE
    `;

    const extra = type ? ` AND n."Type" = $${idx++}` : "";
    if (type) params.push(type);

    const sql = `${base}${extra} RETURNING n."NotificationID";`;

    console.log("➡️ Executing SQL:", sql, params);
    const { rows } = await pool.query(sql, params);
    res.json({ updated: rows.length });
  } catch (err) {
    console.error("❌ markAllSCRead error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}
