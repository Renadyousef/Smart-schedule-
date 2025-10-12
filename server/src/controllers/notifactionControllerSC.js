// server/src/controllers/notificationControllerSC.js
import pool from "../../DataBase_config/DB_config.js";

const TYPE = "tlc_schedule_shared";

/* ========== Helpers ========== */
function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("DB_TIMEOUT")), ms)),
  ]);
}
async function safeQuery(clientOrPool, text, params = [], ms = 5000) {
  const q = { text, values: params };
  return withTimeout(clientOrPool.query(q), ms + 500);
}

/* ========== Controllers ========== */
/** GET /NotificationsSC/tlc  و  /NotificationsSC/view */
export async function getSharedScheduleNotifications(req, res) {
  let client;
  try {
    // خذ هوية المستخدم (من الهيدر أو من ميدلويرك لو عندك)
    const currentUserId = toInt(req.headers["x-user-id"]);
    if (!currentUserId) {
      return res.status(400).json({ success: false, error: "x-user-id header required" });
    }

    const unreadOnly = String(req.query.unreadOnly ?? "").toLowerCase() === "true";
    const limit  = Math.max(1, toInt(req.query.limit, 20));
    const offset = Math.max(0, toInt(req.query.offset, 0));

    client = await withTimeout(pool.connect(), 3000);

    // عدد كلي
    const countSql = `
      SELECT COUNT(*) AS c
      FROM public."NotificationRecipients" r
      JOIN public."Notifications" n ON n."NotificationID"=r."NotificationID"
      WHERE r."UserID" = $1
        AND lower(n."Type")='tlc_schedule_shared'
        AND lower(n."Entity")='schedule'
        ${unreadOnly ? `AND COALESCE(r."IsRead", false)=false` : ``}
    `;
    const totalRes = await safeQuery(client, countSql, [currentUserId], 4000);
    const total = Number(totalRes.rows?.[0]?.c ?? 0);

    // صفحة
    const pageSql = `
      SELECT
        n."NotificationID", n."Title", n."Message",
        n."Type", n."Entity", n."EntityId",
        n."CreatedAt", r."IsRead",
        s."ScheduleID", s."Level", s."GroupNo", s."Status",
        s."SectionID", s."CommitteeID", s."UpdatedAt" AS "ScheduleUpdatedAt"
      FROM public."NotificationRecipients" r
      JOIN public."Notifications" n ON n."NotificationID"=r."NotificationID"
      LEFT JOIN public."Schedule" s
        ON lower(n."Entity")='schedule' AND n."EntityId"=s."ScheduleID"
      WHERE r."UserID" = $1
        AND lower(n."Type")='tlc_schedule_shared'
        AND lower(n."Entity")='schedule'
        ${unreadOnly ? `AND COALESCE(r."IsRead", false)=false` : ``}
      ORDER BY n."CreatedAt" DESC NULLS LAST, n."NotificationID" DESC
      LIMIT $2 OFFSET $3
    `;
    const page = await safeQuery(client, pageSql, [currentUserId, limit, offset], 5000);

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

/** PATCH /NotificationsSC/tlc/:id/read */
export async function markSharedScheduleRead(req, res) {
  let client;
  try {
    const id = toInt(req.params.id);
    const currentUserId = toInt(req.headers["x-user-id"]);
    if (!id || !currentUserId) {
      return res.status(400).json({ success: false, error: "id and x-user-id required" });
    }

    client = await withTimeout(pool.connect(), 3000);

    const sql = `
      UPDATE public."NotificationRecipients"
      SET "IsRead"=true, "ReadAt"=clock_timestamp()
      WHERE "NotificationID"=$1 AND "UserID"=$2
      RETURNING "NotificationID"
    `;
    const r = await safeQuery(client, sql, [id, currentUserId], 4000);
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

/** GET /NotificationsSC/tlc/unread-count */
export async function getSharedScheduleUnreadCount(req, res) {
  let client;
  try {
    const currentUserId = toInt(req.headers["x-user-id"]);
    if (!currentUserId) {
      return res.status(400).json({ success: false, error: "x-user-id header required" });
    }

    client = await withTimeout(pool.connect(), 3000);

    const sql = `
      SELECT COUNT(*) AS c
      FROM public."NotificationRecipients" r
      JOIN public."Notifications" n ON n."NotificationID"=r."NotificationID"
      WHERE r."UserID" = $1
        AND lower(n."Type")='tlc_schedule_shared'
        AND lower(n."Entity")='schedule'
        AND COALESCE(r."IsRead",false)=false
    `;
    const r = await safeQuery(client, sql, [currentUserId], 3000);
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
    const currentUserId = toInt(req.headers["x-user-id"]);
    if (!ids.length || !currentUserId) {
      return res.status(400).json({ success: false, error: "ids[] and x-user-id required" });
    }

    client = await withTimeout(pool.connect(), 3000);

    const sql = `
      UPDATE public."NotificationRecipients"
      SET "IsRead"=true, "ReadAt"=clock_timestamp()
      WHERE "UserID"=$1 AND "NotificationID" = ANY($2::int4[])
    `;
    await safeQuery(client, sql, [currentUserId, ids], 6000);
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

/** POST /NotificationsSC/clear-all */
export async function clearAllSharedSchedule(req, res) {
  let client;
  try {
    const currentUserId = toInt(req.headers["x-user-id"]);
    if (!currentUserId) {
      return res.status(400).json({ success: false, error: "x-user-id header required" });
    }

    client = await withTimeout(pool.connect(), 3000);

    const sql = `
      UPDATE public."NotificationRecipients"
      SET "IsRead"=true, "ReadAt"=clock_timestamp()
      WHERE "UserID"=$1
        AND "NotificationID" IN (
          SELECT n."NotificationID"
          FROM public."Notifications" n
          WHERE lower(n."Type")='tlc_schedule_shared'
            AND lower(n."Entity")='schedule'
        )
        AND COALESCE("IsRead",false)=false
    `;
    const r = await safeQuery(client, sql, [currentUserId], 8000);
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
