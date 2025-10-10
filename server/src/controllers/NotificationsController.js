import pool from "../../DataBase_config/DB_config.js";

/* helpers */
function safeText(v, max = 4000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function toBoolStr(v) {
  if (v === true || v === "true" || v === "1" || v === 1) return "true";
  if (v === false || v === "false" || v === "0" || v === 0) return "false";
  return null;
}

// Try to support either public."Users" or public."User"
async function detectUsersTable(client) {
  const q1 = await client.query(`select to_regclass('public."Users"') as r`);
  if (q1.rows[0]?.r) return `public."Users"`;
  const q2 = await client.query(`select to_regclass('public."User"') as r`);
  if (q2.rows[0]?.r) return `public."User"`;
  return null;
}

/* GET /Notifications/view */
export async function viewNotifications(req, res) {
  const receiverId = toInt(req.query.receiverId);
  const isRead = toBoolStr(req.query.isRead);
  const entity = safeText(req.query.entity || "", 100) || null;
  const type = safeText(req.query.type || "", 60) || null;
  const search = safeText(req.query.q || "", 200) || null;

  const page = Math.max(1, toInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, toInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const since = req.query.since ? new Date(req.query.since) : null;
  const until = req.query.until ? new Date(req.query.until) : null;

  const where = [];
  const vals = [];

  if (receiverId) { vals.push(receiverId); where.push(`n."ReceiverID" = $${vals.length}`); }
  if (isRead === "true")  where.push(`coalesce(n."IsRead",false) = true`);
  if (isRead === "false") where.push(`coalesce(n."IsRead",false) = false`);
  if (entity) { vals.push(entity); where.push(`n."Entity" = $${vals.length}`); }
  if (type)   { vals.push(type);   where.push(`n."Type" = $${vals.length}`); }
  if (search) { vals.push(`%${search}%`); where.push(`n."Message" ILIKE $${vals.length}`); }
  if (since)  { vals.push(since); where.push(`n."CreatedAt" >= $${vals.length}`); }
  if (until)  { vals.push(until); where.push(`n."CreatedAt" <= $${vals.length}`); }

  try {
    const client = await pool.connect();
    try {
      const usersTable = await detectUsersTable(client);
      const sql = usersTable
        ? `
          select n.*,
                 coalesce(su."Full_name", trim(coalesce(su."First_name",'') || ' ' || coalesce(su."Last_name",''))) as "SenderName",
                 su."Email" as "SenderEmail",
                 su."Role"  as "SenderRole",
                 coalesce(ru."Full_name", trim(coalesce(ru."First_name",'') || ' ' || coalesce(ru."Last_name",''))) as "ReceiverName",
                 ru."Email" as "ReceiverEmail",
                 ru."Role"  as "ReceiverRole"
            from "Notifications" n
            left join ${usersTable} su on su."UserID" = n."CreatedBy"
            left join ${usersTable} ru on ru."UserID" = n."ReceiverID"
           ${where.length ? "where " + where.join(" and ") : ""}
           order by n."CreatedAt" desc nulls last
           limit ${limit} offset ${offset}
        `
        : `
          select * from "Notifications" n
           ${where.length ? "where " + where.join(" and ") : ""}
           order by n."CreatedAt" desc nulls last
           limit ${limit} offset ${offset}
        `;
      const { rows } = await client.query(sql, vals);
      res.json({ success: true, notifications: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("viewNotifications error:", err);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
}

/* GET /Notifications/counts?receiverId= */
export async function getCounts(req, res) {
  const receiverId = toInt(req.query.receiverId);
  if (!receiverId) return res.status(400).json({ success: false, message: "receiverId is required" });

  try {
    const { rows } = await pool.query(
      `select
         count(*)::int as total,
         count(*) filter (where coalesce("IsRead",false)=false)::int as unread
       from "Notifications"
       where "ReceiverID" = $1`,
      [receiverId]
    );
    res.json({ success: true, ...rows[0] });
  } catch (err) {
    console.error("getCounts error:", err);
    res.status(500).json({ success: false, message: "Failed to get counts" });
  }
}

/* POST /Notifications/mark-read  { ids: number[] } */
export async function markRead(req, res) {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(toInt).filter(Boolean);
  if (!ids.length) return res.json({ success: true, updated: 0 });

  try {
    const { rowCount } = await pool.query(
      `update "Notifications"
       set "IsRead" = true, "ReadAt" = now()
       where "NotificationID" = any($1::int[])`,
      [ids]
    );
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
}

/* POST /Notifications/mark-all-read  { receiverId, entity?, type? } */
export async function markAllRead(req, res) {
  const receiverId = toInt(req.body?.receiverId);
  if (!receiverId) return res.status(400).json({ success: false, message: "receiverId is required" });

  const entity = req.body?.entity ? safeText(req.body.entity, 100) : null;
  const type   = req.body?.type   ? safeText(req.body.type, 60)   : null;

  const where = [`"ReceiverID" = $1`, `coalesce("IsRead",false) = false`];
  const vals  = [receiverId];

  if (entity) { vals.push(entity); where.push(`"Entity" = $${vals.length}`); }
  if (type)   { vals.push(type);   where.push(`"Type" = $${vals.length}`); }

  try {
    const sql = `update "Notifications" set "IsRead" = true, "ReadAt" = now() where ${where.join(" and ")}`;
    const { rowCount } = await pool.query(sql, vals);
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error("markAllRead error:", err);
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
}

/* اختياري للاختبار: POST /Notifications/create */
export async function createNotification(req, res) {
  try {
    const message    = safeText(req.body?.message || "", 4000);
    const createdBy  = toInt(req.body?.createdBy);
    const receiverId = toInt(req.body?.receiverId);
    const type       = req.body?.type   ? safeText(req.body.type, 60)   : null;
    const entity     = req.body?.entity ? safeText(req.body.entity, 100) : null;
    const entityId   = toInt(req.body?.entityId);
    const data       = req.body?.data ?? null;

    if (!message || !receiverId) {
      return res.status(400).json({ success: false, message: "message & receiverId are required" });
    }

    const { rows } = await pool.query(
      `insert into "Notifications"
        ("Message","CreatedAt","CreatedBy","UserID","ReceiverID","Type","Entity","EntityId","Data")
       values ($1, now(), $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [message, createdBy, receiverId, receiverId, type, entity, entityId, data]
    );
    res.json({ success: true, notification: rows[0] });
  } catch (err) {
    console.error("createNotification error:", err);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
}
