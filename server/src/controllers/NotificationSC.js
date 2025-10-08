import pool from "../../DataBase_config/DB_config.js";

/* ===== helpers ===== */
function safeText(v, max = 4000) {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Detect users table name once per connection (supports "Users" or "User")
async function detectUsersTable(client) {
  const q1 = await client.query(`select to_regclass('public."Users"') as r`);
  if (q1.rows[0]?.r) return `public."Users"`;
  const q2 = await client.query(`select to_regclass('public."User"') as r`);
  if (q2.rows[0]?.r) return `public."User"`;
  // Fallback: don't join users if none found
  return null;
}

/* ===== POST /Notifications ===== */
export async function createNotification(req, res) {
  const client = await pool.connect();
  try {
    const {
      receiverId,          // required
      createdBy = null,
      message,             // required
      type = "general",    // 'general'|'request'|'feedback'|'schedule'
      entity = null,       // e.g. 'CommitteeRequest'
      entityId = null,
      data = {},           // jsonb payload
    } = req.body;

    if (!receiverId || !message) {
      return res
        .status(400)
        .json({ success: false, error: "receiverId and message are required" });
    }

    const q = `
      INSERT INTO "Notifications"
        ("ReceiverID","CreatedBy","Message","Type","Entity","EntityId","Data")
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;
    const params = [
      toInt(receiverId),
      createdBy ? toInt(createdBy) : null,
      safeText(message),
      String(type || "general"),
      entity ? String(entity) : null,
      entityId ? toInt(entityId) : null,
      data ?? {},
    ];

    const { rows } = await client.query(q, params);
    return res.json({ success: true, notification: rows[0] });
  } catch (err) {
    console.error("createNotification error", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error", detail: err?.message });
  } finally {
    client.release();
  }
}

/* ===== GET /Notifications/view ===== */
export async function listNotifications(req, res) {
  const client = await pool.connect();
  try {
    const {
      receiverId,          // recommended (for per-user)
      isRead,              // 'true' | 'false'
      type,
      entity,
      entityId,
      limit = 20,
      offset = 0,
      since,               // ISO date string
    } = req.query;

    // If your app requires receiverId, enforce it:
    // if (!receiverId) return res.status(400).json({ success:false, error:"receiverId is required" });

    const where = [];
    const args = [];
    let i = 1;

    if (receiverId) { where.push(`"ReceiverID" = $${i++}`); args.push(toInt(receiverId)); }
    if (typeof isRead !== "undefined") { where.push(`"IsRead" = $${i++}`); args.push(isRead === "true"); }
    if (type) { where.push(`"Type" = $${i++}`); args.push(String(type)); }
    if (entity) { where.push(`"Entity" = $${i++}`); args.push(String(entity)); }
    if (entityId) { where.push(`"EntityId" = $${i++}`); args.push(toInt(entityId)); }
    if (since) { where.push(`"CreatedAt" >= $${i++}`); args.push(new Date(since)); }

    // Try to enrich with sender/receiver details if users table exists
    const usersTable = await detectUsersTable(client);
    const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const q = usersTable
      ? `
      SELECT n.*,
             COALESCE(su."Full_name", trim(coalesce(su."First_name",'') || ' ' || coalesce(su."Last_name",''))) AS "SenderName",
             su."Email"          AS "SenderEmail",
             su."Role"           AS "SenderRole",
             COALESCE(ru."Full_name", trim(coalesce(ru."First_name",'') || ' ' || coalesce(ru."Last_name",''))) AS "ReceiverName",
             ru."Email"          AS "ReceiverEmail",
             ru."Role"           AS "ReceiverRole"
        FROM "Notifications" n
        LEFT JOIN ${usersTable} su ON su."UserID" = n."CreatedBy"
        LEFT JOIN ${usersTable} ru ON ru."UserID" = n."ReceiverID"
        ${baseWhere}
       ORDER BY n."CreatedAt" DESC
       LIMIT $${i++} OFFSET $${i++};
      `
      : `
      SELECT *
        FROM "Notifications"
        ${baseWhere}
       ORDER BY "CreatedAt" DESC
       LIMIT $${i++} OFFSET $${i++};
      `;
    args.push(Number(limit), Number(offset));

    const { rows } = await client.query(q, args);

    // unread count (per receiver if provided)
    let unreadCount = 0;
    if (receiverId) {
      const { rows: cnt } = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM "Notifications"
         WHERE "ReceiverID" = $1 AND "IsRead" = false;`,
        [toInt(receiverId)]
      );
      unreadCount = cnt[0]?.count ?? 0;
    }

    return res.json({ success: true, notifications: rows, unreadCount });
  } catch (err) {
    console.error("listNotifications error", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error", detail: err?.message });
  } finally {
    client.release();
  }
}

/* ===== PATCH /Notifications/:id/read ===== */
export async function markRead(req, res) {
  const client = await pool.connect();
  try {
    const id = toInt(req.params.id);
    const { receiverId } = req.body; // optional but safer to require

    if (!id) {
      return res.status(400).json({ success: false, error: "id is required" });
    }

    const args = [id];
    let i = 2;
    let guard = "";

    if (receiverId) {
      guard = ` AND "ReceiverID" = $${i++}`;
      args.push(toInt(receiverId));
    }

    const q = `
      UPDATE "Notifications"
      SET "IsRead" = true, "ReadAt" = now()
      WHERE "NotificationID" = $1${guard}
      RETURNING *;
    `;
    const { rows } = await client.query(q, args);
    if (!rows[0]) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, notification: rows[0] });
  } catch (err) {
    console.error("markRead error", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error", detail: err?.message });
  } finally {
    client.release();
  }
}

/* ===== POST /Notifications/mark-all-read ===== */
export async function markAllRead(req, res) {
  const client = await pool.connect();
  try {
    const { receiverId, type, entity } = req.body;
    if (!receiverId)
      return res.status(400).json({ success: false, error: "receiverId required" });

    const where = [`"ReceiverID" = $1`, `"IsRead" = false`];
    const args = [toInt(receiverId)];
    let i = 2;
    if (type) { where.push(`"Type" = $${i++}`); args.push(String(type)); }
    if (entity) { where.push(`"Entity" = $${i++}`); args.push(String(entity)); }

    const q = `
      UPDATE "Notifications"
      SET "IsRead" = true, "ReadAt" = now()
      WHERE ${where.join(" AND ")}
      RETURNING "NotificationID";
    `;
    const { rows } = await client.query(q, args);
    return res.json({ success: true, updated: rows.length });
  } catch (err) {
    console.error("markAllRead error", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error", detail: err?.message });
  } finally {
    client.release();
  }
}
