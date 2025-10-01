// server/controllers/RegistrarRequestsController.js
import pool from "../../DataBase_config/DB_config.js";

/* -------------------- utils -------------------- */
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
  // 1) from CommitteeRequestStudents row
  const r1 = await client.query(
    `select "StudentID","StudentName"
       from public."CommitteeRequestStudents"
      where "CRStudentID" = $1 and "RequestID" = $2`,
    [crStudentId, requestId]
  );
  let studentId = r1.rows[0]?.StudentID ?? null;
  let studentName = r1.rows[0]?.StudentName ?? null;
  if (studentId) return studentId;

  // 2) from body
  const fromBody = Number(data?.studentId);
  if (Number.isInteger(fromBody)) return fromBody;

  // 3) lookup by name (exact, case-insensitive)
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

/** GET /registrarRequests/requests/:id */
export const getRegistrarRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const rq = await pool.query(
      `SELECT "RequestID" AS id, "Title" AS title, "RequestType" AS type,
              "Level" AS level, "NeededFields" AS "neededFields", "Description" AS description,
              "Status" AS status, "CommitteeID" AS "committeeId", "RegistrarID" AS "registrarId",
              "CreatedAt" AS "createdAt", "UpdatedAt" AS "updatedAt",
              "AssignedAt" AS "assignedAt", "HandledAt" AS "handledAt"
         FROM public."CommitteeRequests" WHERE "RequestID" = $1`,
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

    res.json({ ...rq.rows[0], students: kids.rows });
  } catch (err) {
    handle500(res, "getRegistrarRequest error", err);
  }
};

/** POST /registrarRequests/requests/:id/students/:crStudentId/respond */
export const respondForStudent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, crStudentId } = req.params;
    const { data, status } = req.body || {};
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Missing data" });
    }

    const lineStatus = sanitizeLineStatus(status);

    await client.query("BEGIN");

    // 1) store response JSON + status on the line
    await client.query(
      `UPDATE public."CommitteeRequestStudents"
          SET "ResponseData" = COALESCE("ResponseData",'{}'::jsonb) || $1::jsonb,
              "Status" = $2,
              "RespondedAt" = now()
        WHERE "CRStudentID" = $3 AND "RequestID" = $4`,
      [JSON.stringify(data), lineStatus, crStudentId, id]
    );

    // 2) irregular write-through (merge/replace + level + last_login check)
    if (isIrregularAction(data)) {
      const studentId = await resolveStudentId(client, { requestId: id, crStudentId, data });
      if (studentId) {
        const usersTable = await detectUsersTable(client);
        const hasLL = await hasLastLogin(client, usersTable);

        // If the column exists, require last_login_at != null (same logic as IrregularStudentsController)
        if (hasLL) {
          const u = await client.query(
            `select "last_login_at" from ${usersTable} where "UserID" = $1`,
            [studentId]
          );
          if (u.rowCount === 0) {
            throw new Error("User record not found");
          }
          if (u.rows[0]?.last_login_at == null) {
            // non-fatal: mark the line failed, roll back irregular write-through but keep the ResponseData
            await client.query(
              `UPDATE public."CommitteeRequestStudents"
                 SET "Status" = 'failed', "RespondedAt" = now()
               WHERE "CRStudentID" = $1 AND "RequestID" = $2`,
              [crStudentId, id]
            );
            await client.query("ROLLBACK"); // rollback the tx so far
            return res.status(403).json({
              error:
                "Student must log in at least once before registrar can add irregular record.",
            });
          }
        }

        const replaceFlag = extractReplaceFlag(data);
        const courses = extractCourses(data); // normalized []
        const newLevel = extractLevel(data);  // number|null

        // lock current row & get existing courses
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
          finalCourses = courses; // full replace
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

        // upsert irregular row
        await client.query(
          `insert into public."IrregularStudents" ("StudentID","PreviousLevelCourses")
           values ($1,$2::text[])
           on conflict ("StudentID")
           do update set "PreviousLevelCourses" = excluded."PreviousLevelCourses"`,
          [studentId, finalCourses]
        );

        // optional level update
        if (newLevel !== null) {
          await client.query(
            `update public."Students" set "level" = $2 where "StudentID" = $1`,
            [studentId, newLevel]
          );
        }
      }
    }

    // 3) parent request status when no pending lines remain
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
      await client.query(
        `update public."CommitteeRequests"
            set "Status"=$2,"HandledAt"=now(),"UpdatedAt"=now()
          where "RequestID"=$1`,
        [id, parentStatus]
      );
    } else {
      // touch updatedAt
      await client.query(
        `update public."CommitteeRequests" set "UpdatedAt"=now() where "RequestID"=$1`,
        [id]
      );
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
