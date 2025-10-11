// server/src/controllers/notifactionControllerSC.js
import pool from "../../DataBase_config/DB_config.js";
import jwt from "jsonwebtoken";

/* ------------------------------- helpers -------------------------------- */
function resolveUserId(req) {
  let userId =
    req.user?.id ?? req.user?.UserID ?? req.user?.userId ?? req.user?.sub ?? null;

  if (!userId) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    if (token) {
      const decoded = jwt.decode(token);
      userId = decoded?.id ?? decoded?.UserID ?? decoded?.userId ?? decoded?.sub ?? null;
    }
  }
  return userId;
}
function safeText(v, max = 4000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Generic insert that tolerates missing columns */
async function insertNotificationSafe(client, row) {
  const meta = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema='public' and table_name='Notifications'
  `);
  const cols = new Set(meta.rows.map(r => r.column_name));
  if (!cols.size) throw new Error('Table "Notifications" not found');

  const want = {
    Message: safeText(row.Message ?? "", 2000),
    Title: safeText(row.Title ?? "", 255),
    Type: safeText(row.Type ?? "general", 100),
    Entity: safeText(row.Entity ?? null, 100),
    EntityId: toInt(row.EntityId),
    CreatedBy: toInt(row.CreatedBy),
    ReceiverID: toInt(row.ReceiverID),
    UserID: toInt(row.UserID),
    IsRead: row.IsRead === true, // default false
  };

  const use = [], vals = [];
  function add(name, val) { if (cols.has(name) && val !== undefined) { use.push(`"${name}"`); vals.push(val); } }

  add("Message", want.Message);
  add("Title", want.Title);
  add("Type", want.Type);
  add("Entity", want.Entity);
  add("EntityId", want.EntityId);
  add("CreatedBy", want.CreatedBy);
  add("ReceiverID", want.ReceiverID);
  add("UserID", want.UserID);
  add("IsRead", want.IsRead);

  if (!use.length) throw new Error("No insertable columns for Notifications");

  const params = use.map((_, i) => `$${i + 1}`).join(",");
  let sql = `INSERT INTO "Notifications"(${use.join(",")}) VALUES (${params})`;
  if (cols.has("NotificationID")) sql += ` RETURNING "NotificationID"`;

  const out = await client.query(sql, vals);
  return out.rows?.[0] ?? null;
}

/* ------------------ Readers for TLC landing (no JSON dependency) ------------------ */

/** shared WHERE condition used by all TLC queries */
const TLC_WHERE_TYPE = `
(
     "Type" ilike 'tlc\\_schedule\\_%' escape '\\'   -- tlc_schedule_shared / approved / feedback ...
  or "Type" ilike 'tlc.%'                            -- backward-compat (dot style)
  or lower("Type") = 'shere_schedule'                -- common typo in legacy rows
  or lower("Type") = 'share_schedule'                -- variant spelling
)
`;

/**
 * GET /NotificationsSC/view?limit=30
 */
export async function viewLanding(req, res) {
  const client = await pool.connect();
  try {
    const limit = Math.min(Math.max(toInt(req.query?.limit) ?? 30, 1), 200);
    const uid = resolveUserId(req);

    const q = `
      select "NotificationID","ReceiverID","CreatedBy","Message","Title","Type",
             "Entity","EntityId","IsRead","CreatedAt"
        from "Notifications"
       where
         ( ("ReceiverID" is null) or ($1::int is not null and "ReceiverID" = $1::int) )
         and ${TLC_WHERE_TYPE}
       order by coalesce("CreatedAt", now()) desc, "NotificationID" desc
       limit $2
    `;
    const r = await client.query(q, [toInt(uid), limit]);
    res.json({ success: true, notifications: r.rows });
  } catch (e) {
    console.error("viewLanding:", e);
    res.status(500).json({ success: false, msg: "Failed to load notifications", error: e.message });
  } finally {
    client.release();
  }
}

/** GET /NotificationsSC/unread-count */
export async function unreadCount(req, res) {
  const client = await pool.connect();
  try {
    const uid = resolveUserId(req);
    const q = `
      select count(*)::int as unread
        from "Notifications"
       where coalesce("IsRead", false) = false
         and ( ("ReceiverID" is null) or ($1::int is not null and "ReceiverID"=$1::int) )
         and ${TLC_WHERE_TYPE}
    `;
    const r = await client.query(q, [toInt(uid)]);
    res.json({ success: true, unread: Number(r.rows[0]?.unread ?? 0) });
  } catch (e) {
    console.error("unreadCount:", e);
    res.status(500).json({ success: false, msg: "Failed to count unread", error: e.message });
  } finally {
    client.release();
  }
}

/** POST /NotificationsSC/mark-read { ids:number[] } */
export async function markRead(req, res) {
  const client = await pool.connect();
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    if (!ids.length) return res.status(400).json({ success: false, msg: "ids required" });

    await client.query(
      `update "Notifications" set "IsRead"=true where "NotificationID" = any($1::int[])`,
      [ids]
    );
    res.json({ success: true, updated: ids.length });
  } catch (e) {
    console.error("markRead:", e);
    res.status(500).json({ success: false, msg: "Failed to mark read", error: e.message });
  } finally {
    client.release();
  }
}

/** POST /NotificationsSC/clear-all */
export async function clearAll(req, res) {
  const client = await pool.connect();
  try {
    const uid = resolveUserId(req);
    if (!uid) return res.status(401).json({ success: false, msg: "Unauthorized" });

    await client.query(`
      update "Notifications"
         set "IsRead"=true
       where ( ("ReceiverID" is null) or ("ReceiverID"=$1::int) )
         and ${TLC_WHERE_TYPE}
    `, [toInt(uid)]);

    res.json({ success: true });
  } catch (e) {
    console.error("clearAll:", e);
    res.status(500).json({ success: false, msg: "Failed to clear", error: e.message });
  } finally {
    client.release();
  }
}

/* ---------------------- Writers used by schedule actions ---------------------- */

/** Call this from shareSchedule */
export async function createTLCShareNotification({
  client, scheduleId, createdBy,
  title = "TLC notification",
  message = "Schedule shared with TLC"
}) {
  await insertNotificationSafe(client, {
    ReceiverID: null,                 // broadcast to TLC landing
    CreatedBy: toInt(createdBy),
    Title: title,
    Message: message,
    Type: "tlc_schedule_shared",      // consistent type
    Entity: "Schedule",
    EntityId: toInt(scheduleId),
    IsRead: false,
  });
}

/** Call this from approveSchedule */
export async function createTLCApproveNotification({
  client, scheduleId, createdBy,
  title = "TLC notification",
  message = "Schedule approved, you can view it now"
}) {
  await insertNotificationSafe(client, {
    ReceiverID: null,
    CreatedBy: toInt(createdBy),
    Title: title,
    Message: message,
    Type: "tlc_schedule_approved",
    Entity: "Schedule",
    EntityId: toInt(scheduleId),
    IsRead: false,
  });
}

/** Simple health */
export async function health(_req, res) {
  try {
    const r = await pool.query(`select 1 as ok`);
    res.json({ ok: r.rows[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
