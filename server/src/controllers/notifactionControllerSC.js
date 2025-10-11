// server/src/controllers/notificationControllerSC.js
import pool from "../../DataBase_config/DB_config.js";

const TYPE = "tlc_schedule_shared";

/* ========== Helpers ========== */
function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

// Race-based timeout so الاستعلام ما يعلّق
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("DB_TIMEOUT")), ms)),
  ]);
}

async function safeQuery(clientOrPool, text, params = [], ms = 5000) {
  const q = { text, values: params /*, query_timeout: ms */ };
  return withTimeout(clientOrPool.query(q), ms + 500);
}

async function detectNotificationCols(client) {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Notifications'
  `;
  const { rows } = await safeQuery(client, q, [], 3000);
  const names = new Set(rows.map(r => r.column_name));
  return {
    hasMessage:   names.has("Message"),
    hasTitle:     names.has("Title"),
    hasType:      names.has("Type"),
    hasEntity:    names.has("Entity"),
    hasEntityId:  names.has("EntityId"),
    hasReceiver:  names.has("ReceiverID"),
    hasCreatedBy: names.has("CreatedBy"),
    hasIsRead:    names.has("IsRead"),
    hasCreatedAt: names.has("CreatedAt"),
    hasNotifId:   names.has("NotificationID"),
  };
}

/* ========== Controllers ========== */
/** GET /NotificationsSC/tlc  و  /NotificationsSC/view */
export async function getSharedScheduleNotifications(req, res) {
  let client;
  try {
    const unreadOnly = String(req.query.unreadOnly ?? "").toLowerCase() === "true";
    const limit  = Math.max(1, toInt(req.query.limit, 20));
    const offset = Math.max(0, toInt(req.query.offset, 0));

    try {
      client = await withTimeout(pool.connect(), 3000);
    } catch (e) {
      if (e?.message === "DB_TIMEOUT") {
        return res.status(503).json({ success: false, error: "Database unavailable (connect timeout)" });
      }
      throw e;
    }

    const reg = await safeQuery(client, `SELECT to_regclass('public."Notifications"') AS r`, [], 2000);
    if (!reg.rows[0]?.r) {
      return res.json({ success: true, total: 0, limit, offset, notifications: [] });
    }

    const cols = await detectNotificationCols(client);

    const where = [`n."Type" = $1`, `n."Entity" = 'Schedule'`];
    const params = [TYPE];
    if (unreadOnly && cols.hasIsRead) where.push(`COALESCE(n."IsRead", false) = false`);

    const orderPieces = [];
    if (cols.hasCreatedAt) orderPieces.push(`n."CreatedAt" DESC NULLS LAST`);
    if (cols.hasNotifId)   orderPieces.push(`n."NotificationID" DESC`);
    const orderBy = orderPieces.length ? orderPieces.join(", ") : `n."Type"`;

    const selectFields = [
      cols.hasNotifId   ? `n."NotificationID"`  : `NULL::int4 AS "NotificationID"`,
      cols.hasTitle     ? `n."Title"`           : `NULL::varchar AS "Title"`,
      cols.hasMessage   ? `n."Message"`         : `NULL::varchar AS "Message"`,
      `n."Type"`,
      `n."Entity"`,
      `n."EntityId"`,
      cols.hasIsRead    ? `n."IsRead"`          : `NULL::bool AS "IsRead"`,
      cols.hasCreatedAt ? `n."CreatedAt"`       : `NOW() AS "CreatedAt"`,
      `s."ScheduleID"`,
      `s."Level"`,
      `s."GroupNo"`,
      `s."Status"`,
      `s."SectionID"`,
      `s."CommitteeID"`,
      `s."UpdatedAt" AS "ScheduleUpdatedAt"`
    ].join(", ");

    const baseSql = `
      FROM public."Notifications" n
      LEFT JOIN public."Schedule" s
        ON n."Entity"='Schedule' AND n."EntityId" = s."ScheduleID"
      WHERE ${where.join(" AND ")}
    `;

    const totalRes = await safeQuery(client, `SELECT COUNT(*) AS c ${baseSql}`, params, 4000);
    const total = Number(totalRes.rows?.[0]?.c ?? 0);

    const pageSql = `
      SELECT ${selectFields}
      ${baseSql}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const pageParams = [...params, limit, offset];
    const page = await safeQuery(client, pageSql, pageParams, 5000);

    return res.json({ success: true, total, limit, offset, notifications: page.rows });
  } catch (e) {
    if (e?.message === "DB_TIMEOUT") {
      return res.status(503).json({ success: false, error: "Database unavailable (query timeout)" });
    }
    console.error("getSharedScheduleNotifications:", e);
    return res.status(500).json({ success: false, error: "Failed to load notifications" });
  } finally {
    if (client) client.release();
  }
}

/** PATCH /NotificationsSC/tlc/:id/read  و  /NotificationsSC/mark-read/:id */
export async function markSharedScheduleRead(req, res) {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid id" });

  let client;
  try {
    try {
      client = await withTimeout(pool.connect(), 3000);
    } catch (e) {
      if (e?.message === "DB_TIMEOUT") {
        return res.status(503).json({ success: false, error: "Database unavailable (connect timeout)" });
      }
      throw e;
    }

    const reg = await safeQuery(client, `SELECT to_regclass('public."Notifications"') AS r`, [], 2000);
    if (!reg.rows[0]?.r) return res.status(404).json({ success: false, error: "Notifications table not found" });

    const cols = await detectNotificationCols(client);
    if (!cols.hasIsRead) {
      return res.json({ success: true, msg: "IsRead column not present; nothing to update." });
    }

    const sql = `
      UPDATE public."Notifications"
      SET "IsRead" = true
      WHERE "Type" = $1 AND "Entity"='Schedule' AND "NotificationID" = $2
      RETURNING "NotificationID"
    `;
    const r = await safeQuery(client, sql, [TYPE, id], 4000);
    if (!r.rowCount) return res.status(404).json({ success: false, error: "Notification not found" });

    return res.json({ success: true });
  } catch (e) {
    if (e?.message === "DB_TIMEOUT") {
      return res.status(503).json({ success: false, error: "Database unavailable (query timeout)" });
    }
    console.error("markSharedScheduleRead:", e);
    return res.status(500).json({ success: false, error: "Failed to mark as read" });
  } finally {
    if (client) client.release();
  }
}

/** GET /NotificationsSC/tlc/unread-count  و  /NotificationsSC/unread-count */
export async function getSharedScheduleUnreadCount(req, res) {
  let client;
  try {
    try {
      client = await withTimeout(pool.connect(), 3000);
    } catch (e) {
      if (e?.message === "DB_TIMEOUT") {
        return res.status(503).json({ success: false, error: "Database unavailable (connect timeout)" });
      }
      throw e;
    }

    const reg = await safeQuery(client, `SELECT to_regclass('public."Notifications"') AS r`, [], 2000);
    if (!reg.rows[0]?.r) return res.json({ success: true, unread: 0 });

    const cols = await detectNotificationCols(client);
    const where = [`"Type"=$1`, `"Entity"='Schedule'`];
    const params = [TYPE];
    if (cols.hasIsRead) where.push(`COALESCE("IsRead", false)=false`);

    const sql = `SELECT COUNT(*) AS c FROM public."Notifications" WHERE ${where.join(" AND ")}`;
    const r = await safeQuery(client, sql, params, 3000);
    return res.json({ success: true, unread: Number(r.rows?.[0]?.c ?? 0) });
  } catch (e) {
    if (e?.message === "DB_TIMEOUT") {
      return res.status(503).json({ success: false, error: "Database unavailable (query timeout)" });
    }
    console.error("getSharedScheduleUnreadCount:", e);
    return res.status(500).json({ success: false, error: "Failed to get unread count" });
  } finally {
    if (client) client.release();
  }
}

/** POST /NotificationsSC/mark-read   (body: { ids: number[] }) */
export async function markSharedScheduleReadBatch(req, res) {
  let client;
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Number.isFinite) : [];
    if (!ids.length) return res.status(400).json({ success: false, error: "ids[] required" });

    client = await withTimeout(pool.connect(), 3000);

    const reg = await safeQuery(client, `SELECT to_regclass('public."Notifications"') AS r`, [], 2000);
    if (!reg.rows[0]?.r) return res.status(404).json({ success: false, error: "Notifications table not found" });

    const cols = await detectNotificationCols(client);
    if (!cols.hasIsRead) {
      return res.json({ success: true, msg: "IsRead column not present; nothing to update." });
    }

    const sql = `
      UPDATE public."Notifications"
      SET "IsRead" = true
      WHERE "Type" = $1 AND "Entity"='Schedule' AND "NotificationID" = ANY($2::int4[])
    `;
    await safeQuery(client, sql, [TYPE, ids], 6000);
    return res.json({ success: true, updated: ids.length });
  } catch (e) {
    if (e?.message === "DB_TIMEOUT") {
      return res.status(503).json({ success: false, error: "Database unavailable (query timeout)" });
    }
    console.error("markSharedScheduleReadBatch:", e);
    return res.status(500).json({ success: false, error: "Failed to mark selected as read" });
  } finally {
    if (client) client.release();
  }
}

/** POST /NotificationsSC/clear-all   (تعليم كل إشعارات هذا النوع كمقروء) */
export async function clearAllSharedSchedule(req, res) {
  let client;
  try {
    client = await withTimeout(pool.connect(), 3000);

    const reg = await safeQuery(client, `SELECT to_regclass('public."Notifications"') AS r`, [], 2000);
    if (!reg.rows[0]?.r) return res.json({ success: true, cleared: 0 });

    const cols = await detectNotificationCols(client);
    if (!cols.hasIsRead) {
      return res.json({ success: true, msg: "IsRead column not present; nothing to update." });
    }

    const sql = `
      UPDATE public."Notifications"
      SET "IsRead" = true
      WHERE "Type" = $1 AND "Entity"='Schedule' AND COALESCE("IsRead", false) = false
    `;
    const r = await safeQuery(client, sql, [TYPE], 8000);
    return res.json({ success: true, cleared: r.rowCount ?? 0 });
  } catch (e) {
    if (e?.message === "DB_TIMEOUT") {
      return res.status(503).json({ success: false, error: "Database unavailable (query timeout)" });
    }
    console.error("clearAllSharedSchedule:", e);
    return res.status(500).json({ success: false, error: "Failed to clear all" });
  } finally {
    if (client) client.release();
  }
}
