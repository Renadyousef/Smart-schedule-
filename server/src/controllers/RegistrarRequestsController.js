// server/controllers/RegistrarRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

/* -------------------- shared helpers -------------------- */
function handle500(res, label, err) {
  console.error(label, err);
  return res
    .status(500)
    .json({ error: "Server error", message: err?.message ?? null, detail: err?.detail ?? null });
}

const COURSE_RE = /^[A-Za-z0-9_-]{1,20}$/;

function normalizeCourseList(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input ?? "")
        .split(/[, \s\n]+/g)
        .map((s) => s.trim());
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const v = String(raw || "").trim().toUpperCase();
    if (!v || !COURSE_RE.test(v)) continue;
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

async function detectUsersTable(client) {
  const q1 = await client.query(`select to_regclass('public."Users"') as r`);
  if (q1.rows[0]?.r) return `public."Users"`;
  const q2 = await client.query(`select to_regclass('public."User"') as r`);
  if (q2.rows[0]?.r) return `public."User"`;
  throw new Error(`Neither public."Users" nor public."User" exists`);
}

async function hasLastLogin(client, usersTableName) {
  const tbl = usersTableName.replace(/public\./, "").replace(/"/g, "");
  const chk = await client.query(
    `select 1
       from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = 'last_login_at'
      limit 1`,
    [tbl]
  );
  return chk.rowCount > 0;
}

function isIrregularAction(data) {
  const cat = String(data?.category || "").toLowerCase();
  const rt = String(data?.responseType || "").toLowerCase();
  return cat === "irregular" || rt.includes("irregular");
}

function extractCourses(data) {
  const src = data?.PreviousLevelCourses ?? data?.courses ?? [];
  return normalizeCourseList(src);
}

function extractLevel(data) {
  const raw = data?.Level ?? data?.level;
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

function extractReplaceFlag(data) {
  const raw = data?.replace ?? data?.Replace ?? false;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

async function resolveStudentId(client, { requestId, crStudentId, data }) {
  const r1 = await client.query(
    `select "StudentID","StudentName"
       from public."CommitteeRequestStudents"
      where "CRStudentID" = $1 and "RequestID" = $2`,
    [crStudentId, requestId]
  );
  let studentId = r1.rows[0]?.StudentID ?? null;
  let studentName = r1.rows[0]?.StudentName ?? null;
  if (studentId) return studentId;

  const fromBody = Number(data?.studentId);
  if (Number.isInteger(fromBody)) return fromBody;

  const name = String(data?.studentName || studentName || "").trim();
  if (!name) return null;

  const usersTable = await detectUsersTable(client);
  const q = await client.query(
    `
    select s."StudentID" as id
      from public."Students" s
      join ${usersTable} u on u."UserID" = s."StudentID"
     where lower(coalesce(u."Full_name",
               trim(coalesce(u."First_name",'') || ' ' || coalesce(u."Last_name",''))))
           = lower($1)
     limit 1
    `,
    [name]
  );
  return q.rows[0]?.id ?? null;
}

const LINE_STATUS_ALLOWED = new Set(["pending", "fulfilled", "rejected", "failed"]);
function sanitizeLineStatus(v) {
  const s = String(v ?? "").toLowerCase().trim();
  return LINE_STATUS_ALLOWED.has(s) ? s : "fulfilled";
}

/* -------------------- controllers -------------------- */

/** GET /registrarRequests/requests?status=&registrarId=&committeeId= */
export const listRegistrarRequests = async (req, res) => {
  try {
    const { status = null, registrarId = null, committeeId = null } = req.query;
    const where = [];
    const vals = [];
    if (status) {
      vals.push(status);
      where.push(`"Status" = $${vals.length}`);
    }
    if (registrarId) {
      vals.push(registrarId);
      where.push(`"RegistrarID" = $${vals.length}`);
    }
    if (committeeId) {
      vals.push(committeeId);
      where.push(`"CommitteeID" = $${vals.length}`);
    }

    const sql = `
      SELECT "RequestID" AS id, "Title" AS title, "RequestType" AS type,
             "Level" AS level, "NeededFields" AS "neededFields", "Description" AS description,
             "Status" AS status, "CommitteeID" AS "committeeId", "RegistrarID" AS "registrarId",
             "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
             "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
        FROM public."CommitteeRequests"
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY "CreatedAt" DESC;`;
    const { rows } = await pool.query(sql, vals);
    res.json(rows);
  } catch (err) {
    handle500(res, "listRegistrarRequests error", err);
  }
};

/** GET /registrarRequests/requests/:id  (DataRequest only payload) */
export const getRegistrarRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const rq = await pool.query(
      `SELECT "RequestID" AS id, "Title" AS title, "RequestType" AS type,
              "Level" AS level, "NeededFields" AS "neededFields", "Description" AS description,
              "Status" AS status, "CommitteeID" AS "committeeId", "RegistrarID" AS "registrarId",
              "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
              "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
         FROM public."CommitteeRequests"
        WHERE "RequestID" = $1`,
      [id]
    );
    if (rq.rowCount === 0) return res.status(404).json({ error: "Not found" });

    const kids = await pool.query(
      `SELECT "CRStudentID" AS "crStudentId","StudentID" AS "studentId","StudentName" AS "studentName",
              "MatchStatus" AS "matchStatus","Status" AS status,"ResponseData" AS "responseData",
              "RespondedAt" AS "respondedAt"
         FROM public."CommitteeRequestStudents"
        WHERE "RequestID" = $1
        ORDER BY "CRStudentID"`,
      [id]
    );

    res.json({ ...rq.rows[0], students: kids.rows, electives: [] });
  } catch (err) {
    handle500(res, "getRegistrarRequest error", err);
  }
};

/** POST /registrarRequests/requests/:id/students/:crStudentId/respond  (DataRequest only) */
export const respondForStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, crStudentId } = req.params;
    const { data, status, createdBy: bodyCreatedBy = null, receiverId: bodyReceiverId = null } = req.body || {};
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Missing data" });
    }

    const lineStatus = sanitizeLineStatus(status);
    await client.query("BEGIN");

    await client.query(
      `UPDATE public."CommitteeRequestStudents"
          SET "ResponseData" = COALESCE("ResponseData",'{}'::jsonb) || $1::jsonb,
              "Status" = $2,
              "RespondedAt" = now()
        WHERE "CRStudentID" = $3 AND "RequestID" = $4`,
      [JSON.stringify(data), lineStatus, crStudentId, id]
    );

    // ---- irregular write-through (كما هو) ----
    if (isIrregularAction(data)) {
      const studentId = await resolveStudentId(client, { requestId: id, crStudentId, data });
      if (studentId) {
        const usersTable = await detectUsersTable(client);
        const hasLL = await hasLastLogin(client, usersTable);

        if (hasLL) {
          const u = await client.query(
            `select "last_login_at" from ${usersTable} where "UserID" = $1`,
            [studentId]
          );
          if (u.rowCount === 0) throw new Error("User record not found");
          if (u.rows[0]?.last_login_at == null) {
            await client.query(
              `UPDATE public."CommitteeRequestStudents"
                 SET "Status" = 'failed', "RespondedAt" = now()
               WHERE "CRStudentID" = $1 AND "RequestID" = $2`,
              [crStudentId, id]
            );
            await client.query("ROLLBACK");
            return res.status(403).json({
              error: "Student must log in at least once before registrar can add irregular record.",
            });
          }
        }

        const replaceFlag = extractReplaceFlag(data);
        const courses = extractCourses(data);
        const newLevel = extractLevel(data);

        const ex = await client.query(
          `select "PreviousLevelCourses"
             from public."IrregularStudents"
            where "StudentID" = $1
            for update`,
          [studentId]
        );

        const existing = (ex.rows[0]?.PreviousLevelCourses || [])
          .map((x) => String(x || "").trim().toUpperCase())
          .filter(Boolean);

        let finalCourses;
        if (replaceFlag) {
          finalCourses = courses;
        } else {
          const seen = new Set();
          finalCourses = [];
          for (const c of [...existing, ...courses]) {
            if (!COURSE_RE.test(c)) continue;
            const up = c.toUpperCase();
            if (!seen.has(up)) {
              seen.add(up);
              finalCourses.push(up);
            }
          }
        }

        await client.query(
          `insert into public."IrregularStudents" ("StudentID","PreviousLevelCourses")
           values ($1,$2::text[])
           on conflict ("StudentID")
           do update set "PreviousLevelCourses" = excluded."PreviousLevelCourses"`,
          [studentId, finalCourses]
        );

        if (newLevel !== null) {
          await client.query(
            `update public."Students" set "level" = $2 where "StudentID" = $1`,
            [studentId, newLevel]
          );
        }
      }
    }

    // ---- تجميع الحالة العامة لخطوط الطلب ----
    const agg = await client.query(
      `select
         count(*) filter (where "Status" = 'pending') as pending,
         count(*) filter (where "Status" = 'failed')  as failed,
         count(*) filter (where "Status" = 'rejected') as rejected
       from public."CommitteeRequestStudents"
      where "RequestID" = $1`,
      [id]
    );
    const pending = Number(agg.rows[0].pending);
    const failed = Number(agg.rows[0].failed);
    const rejected = Number(agg.rows[0].rejected);

    if (pending === 0) {
      const parentStatus = failed > 0 ? "failed" : rejected > 0 ? "rejected" : "fulfilled";

      // حدّث حالة الطلب الأب
      await client.query(
        `update public."CommitteeRequests"
            set "Status"=$2,"HandledAt"=now(),"UpdatedAt"=now()
          where "RequestID"=$1`,
        [id, parentStatus]
      );

      // ✅ إشعار respond_request: Message = ملاحظة الريجستر فقط، التفاصيل داخل Data
      const publicMsg =
        parentStatus === "rejected" ? "rejected" :
        parentStatus === "fulfilled" ? "approved" : null;

      if (publicMsg) {
        const hdr2 = await client.query(
          `select "RegistrarID","Level" from public."CommitteeRequests" where "RequestID"=$1`,
          [id]
        );
        const createdByForPublic = hdr2.rows[0]?.RegistrarID ?? 1;
        const level = hdr2.rows[0]?.Level ?? null;

        const aggQ = await client.query(
          `select
             coalesce(jsonb_agg(crs."StudentName" order by crs."CRStudentID"), '[]'::jsonb) as names,
             count(*)::int as total,
             array_remove(
               array_agg(
                 nullif(
                   coalesce(
                     crs."ResponseData"->>'note',
                     crs."ResponseData"->>'Note',
                     crs."ResponseData"->>'comment',
                     crs."ResponseData"->>'Comment',
                     crs."ResponseData"->>'message',
                     crs."ResponseData"->>'Message'
                   ), ''
                 )
               ),
               null
             ) as notes
           from public."CommitteeRequestStudents" crs
           where crs."RequestID" = $1`,
          [id]
        );

        const names = aggQ.rows[0]?.names ?? [];
        const total = Number(aggQ.rows[0]?.total ?? 0);
        const notes = (aggQ.rows[0]?.notes || []).filter(Boolean);
        const message = notes.length ? notes.join(" | ") : ""; // 👈 رسالة = النوت فقط

        const dataJson = {
          requestId: Number(id),
          level: level ?? null,
          students: (names || []).filter(Boolean),
          total,
          status: publicMsg,
          notes, // احتفاظ بالنوتات في Data أيضًا للعرض التفصيلي
        };

        await client.query(
          `INSERT INTO public."Notifications"
            ("Title","Message","ReceiverID","Type","Entity","EntityId","Data","CreatedBy","IsRead")
           VALUES ($1,$2,NULL,$3,'CommitteeRequest',$4,$5,$6,FALSE)`,
          [
            "respond request",
            message,                  // فقط النوت هنا
            "respond_request",
            Number(id),
            JSON.stringify(dataJson), // كل التفاصيل هنا
            createdByForPublic,
          ]
        );
      }
    } else {
      await client.query(
        `update public."CommitteeRequests" set "UpdatedAt"=now() where "RequestID"=$1`,
        [id]
      );
    }

    // إشعار داخلي للجنة — كما كان
    try {
      let receiverId = bodyReceiverId ? Number(bodyReceiverId) : null;
      let createdById = bodyCreatedBy ? Number(bodyCreatedBy) : null;

      const hdr = await client.query(
        `select "CommitteeID","RegistrarID","CreatedBy" from public."CommitteeRequests" where "RequestID"=$1`,
        [id]
      );
      if (!receiverId) receiverId = hdr.rows[0]?.CommitteeID ?? hdr.rows[0]?.CreatedBy ?? null;
      if (!createdById) createdById = hdr.rows[0]?.RegistrarID ?? null;

      if (receiverId) {
        const payload = {
          action: "registrar_response",
          requestId: Number(id),
          crStudentId: Number(crStudentId),
          lineStatus,
          ...data
        };
        await client.query(
          `INSERT INTO "Notifications"
            ("ReceiverID","CreatedBy","Message","Type","Entity","EntityId","Data")
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            Number(receiverId),
            createdById ?? null,
            `Registrar responded on request ${id}`,
            "request",
            "CommitteeRequest",
            Number(id),
            JSON.stringify(payload)
          ]
        );
      }
    } catch (notifyErr) {
      console.warn("respondForStudent: notification insert skipped", notifyErr?.message);
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    return handle500(res, "respondForStudent error", err);
  } finally {
    client.release();
  }
};

/** POST /registrarRequests/requests/:id/status
 *  Body: { status: 'fulfilled' | 'rejected' | 'pending' | 'failed' | 'approved' }
 */
export const updateRegistrarRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const raw = String((req.body || {}).status || "").toLowerCase().trim();
    const s = raw === "approved" ? "fulfilled" : raw;

    console.log("🔥 updateRegistrarRequestStatus FROM: server/src/controllers/RegistrarRequestsController.js");
    const allowed = new Set(["pending", "fulfilled", "rejected", "failed"]);
    if (!allowed.has(s)) return res.status(400).json({ error: "Invalid status" });

    console.log("➡️ updateRegistrarRequestStatus params:", { id, raw, normalized: s });

    const r = await pool.query(
      `update public."CommitteeRequests"
          set "Status"=$2,"UpdatedAt"=now(),
              "HandledAt" = case when $2 in ('fulfilled','rejected','failed') then now() else "HandledAt" end
        where "RequestID"=$1
      returning "RequestID"`,
      [id, s]
    );
    console.log("➡️ updated rows:", r.rowCount);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });

    /* (1) إشعار داخلي للجنة */
    try {
      const hdr = await pool.query(
        `select "CommitteeID","RegistrarID","CreatedBy","Title"
           from public."CommitteeRequests"
          where "RequestID"=$1`,
        [id]
      );
      const receiverId = hdr.rows[0]?.CommitteeID ?? hdr.rows[0]?.CreatedBy ?? null;
      const createdById = hdr.rows[0]?.RegistrarID ?? null;
      const title = hdr.rows[0]?.Title || "Request";

      if (receiverId) {
        await pool.query(
          `INSERT INTO public."Notifications"
            ("ReceiverID","CreatedBy","Message","Type","Entity","EntityId","Data")
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            Number(receiverId),
            createdById ?? null,
            `Registrar updated status of ${title} (#${id}) to ${s}`,
            "request",
            "CommitteeRequest",
            Number(id),
            JSON.stringify({ action: "request_status", status: s, requestId: Number(id) })
          ]
        );
      }
    } catch (notifyErr) {
      console.warn("⚠️ committee notification skipped:", notifyErr?.message);
    }

    /* (2) إشعار عام respond_request — Message = ملاحظة الريجستر فقط؛ التفاصيل داخل Data */
    try {
      const publicMsg = s === "rejected" ? "rejected" : (s === "fulfilled" ? "approved" : null);

      if (publicMsg) {
        const hdr2 = await pool.query(
          `select "RegistrarID","Level" from public."CommitteeRequests" where "RequestID"=$1`,
          [id]
        );
        const createdByForPublic = hdr2.rows[0]?.RegistrarID ?? 1;
        const level = hdr2.rows[0]?.Level ?? null;

        const aggQ = await pool.query(
          `select
             coalesce(jsonb_agg(crs."StudentName" order by crs."CRStudentID"), '[]'::jsonb) as names,
             count(*)::int as total,
             array_remove(
               array_agg(
                 nullif(
                   coalesce(
                     crs."ResponseData"->>'note',
                     crs."ResponseData"->>'Note',
                     crs."ResponseData"->>'comment',
                     crs."ResponseData"->>'Comment',
                     crs."ResponseData"->>'message',
                     crs."ResponseData"->>'Message'
                   ), ''
                 )
               ),
               null
             ) as notes
           from public."CommitteeRequestStudents" crs
           where crs."RequestID" = $1`,
          [id]
        );

        const names = aggQ.rows[0]?.names ?? [];
        const total = Number(aggQ.rows[0]?.total ?? 0);
        const notes = (aggQ.rows[0]?.notes || []).filter(Boolean);
        const message = notes.length ? notes.join(" | ") : ""; // 👈 الرسالة = النوت فقط

        const dataJson = {
          requestId: Number(id),
          level: level ?? null,
          students: (names || []).filter(Boolean),
          total,
          status: publicMsg,
          notes,
        };

        const ins = await pool.query(
          `INSERT INTO public."Notifications"
            ("Title","Message","ReceiverID","Type","Entity","EntityId","Data","CreatedBy","IsRead")
           VALUES ($1,$2,NULL,$3,'CommitteeRequest',$4,$5,$6,FALSE)
           RETURNING "NotificationID"`,
          [
            "respond request",
            message,                  // فقط النوت
            "respond_request",
            Number(id),
            JSON.stringify(dataJson), // كل التفاصيل في Data
            createdByForPublic
          ]
        );

        console.log("[respond_request] inserted ✅ id:", ins.rows[0]?.NotificationID);
      } else {
        console.log("[respond_request] skipped (status not fulfilled/rejected)");
      }
    } catch (publicNotifyErr) {
      console.error("❌ public respond_request insert failed:", publicNotifyErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    return handle500(res, "updateRegistrarRequestStatus error", err);
  }
};
