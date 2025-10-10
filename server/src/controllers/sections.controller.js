// server/src/controllers/sections.controller.js
import pool from "../../DataBase_config/DB_config.js";

/* ---------- helpers ---------- */
function toHM(v) {
  if (v == null) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}
function normDay(v) {
  if (v == null) return null;
  return String(v).trim();
}

/* =========================================================
 * A) القديم (لو تبينه): /api/sections/courses-by-level
 * =======================================================*/
export async function getCoursesByLevel(req, res) {
  try {
    const level = Number(req.query.level);
    const includeSlots = String(req.query.includeSlots || "") === "1";
    const statusRaw = String(req.query.status || "").trim().toLowerCase();

    if (!Number.isInteger(level)) {
      return res.status(400).json({ error: "Query param 'level' must be integer" });
    }

    const params = [level];
    const statusFilterSql = statusRaw ? `AND LOWER(sch."Status") = $${params.length + 1}` : "";
    if (statusRaw) params.push(statusRaw);

    const slotSelect = includeSlots
      ? `,
         sl."DayOfWeek" AS "DayOfWeek",
         sl."StartTime" AS "StartTime",
         sl."EndTime"   AS "EndTime"`
      : "";

    const slotJoin = includeSlots
      ? `JOIN "ScheduleSlot" sl ON sl."SlotID" = s."SlotID"`
      : "";

    const sql = `
      SELECT
        sch."ScheduleID"               AS "ScheduleID",
        sch."Level"                    AS "Level",
        sch."Status"                   AS "Status",
        sch."GroupNo"                  AS "GroupNo",
        c."course_code",
        c."course_name",
        LOWER(COALESCE(c."course_type",'core')) AS "course_type",
        c.level                        AS "CourseLevel",
        s."SectionID",
        COALESCE(NULLIF(TRIM(s."Room"), ''), NULLIF(TRIM(s."ClassRoom"), ''), '000') AS room
        ${slotSelect}
      FROM "Sections" s
      JOIN "Schedule" sch ON sch."ScheduleID" = s."ScheduleID"
      JOIN "courses"  c   ON c."CourseID"     = s."CourseID"
      ${slotJoin}
      WHERE sch."Level" = $1
        ${statusFilterSql}
        ${includeSlots ? `AND s."SlotID" IS NOT NULL` : ``}
      ORDER BY
        ${includeSlots ? `sl."DayOfWeek" NULLS LAST, sl."StartTime" NULLS LAST,` : ""}
        c."course_code", s."SectionID";
    `;

    const { rows } = await pool.query(sql, params);
    const cleaned = rows.map(r => ({
      ...r,
      DayOfWeek: normDay(r.DayOfWeek ?? r.day_of_week ?? null),
      StartTime: toHM(r.StartTime ?? r.start_time ?? null),
      EndTime:   toHM(r.EndTime   ?? r.end_time   ?? null),
    }));

    const scheduleId = cleaned?.[0]?.ScheduleID ?? null;
    const groupNo    = cleaned?.[0]?.GroupNo    ?? null;

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      scheduleId,
      meta: {
        level,
        requestedStatus: statusRaw || null,
        includeSlots,
        groupNo,
        count: cleaned.length,
      },
      rows: cleaned,
    });
  } catch (err) {
    console.error("getCoursesByLevel error:", err);
    return res.status(500).json({ error: "Internal server error", details: err?.message || "" });
  }
}

/* =========================================================
 * B) الجديد: /api/sections/grid-by-level
 *    يرجّع كل الـ Groups لهذا اللفل بنفس فورمات Grid
 *    groups:[{scheduleId, meta:{level,status,groupNo,count}, slots:[...]}]
 * =======================================================*/
export async function getGridByLevel(req, res) {
  try {
    const level = Number(req.query.level);
    if (!Number.isInteger(level)) {
      return res.status(400).json({ error: "Query param 'level' must be integer" });
    }

    const statusRaw = String(req.query.status || "").trim().toLowerCase(); // draft/generated/approved/shared
    const groupNoRaw = req.query.groupNo != null ? Number(req.query.groupNo) : null;

    // اختاري كل السكيجولات لهذا اللفل (وممكن فلترة بالحالة/القروب)
    const p = [level];
    let where = `WHERE "Level"=$1 AND "Status"<>'archived'`;
    if (statusRaw) {
      p.push(statusRaw);
      where += ` AND LOWER("Status")=$${p.length}`;
    }
    if (Number.isInteger(groupNoRaw)) {
      p.push(groupNoRaw);
      where += ` AND "GroupNo"=$${p.length}`;
    }

    const pickSql = `
      SELECT "ScheduleID","Level","GroupNo","Status"
        FROM "Schedule"
        ${where}
       ORDER BY COALESCE("GroupNo",0), "ScheduleID"
    `;
    const pickRes = await pool.query(pickSql, p);

    if (!pickRes.rowCount) {
      return res.json({
        meta: { level, status: statusRaw || null, groupNo: groupNoRaw, groupsCount: 0 },
        groups: [],
      });
    }

    // اجلب الـGrid لكل ScheduleID
    const groups = [];
    for (const row of pickRes.rows) {
      const scheduleId = row.ScheduleID;
      const gridSql = `
        SELECT s."SlotID"       AS slot_id,
               sec."SectionID"  AS section_id,
               c.is_external,
               c.course_code,
               c.course_name,
               COALESCE(sec."SectionNumber",1) AS section_number,
               COALESCE(sec."Capacity",30)     AS capacity,
               s."DayOfWeek"   AS day,
               s."StartTime"   AS start,
               s."EndTime"     AS end
          FROM "ScheduleSlot" s
          JOIN courses c ON c."CourseID"=s."CourseID"
          LEFT JOIN "Sections" sec ON sec."SlotID"=s."SlotID"
         WHERE s."ScheduleID"=$1
         ORDER BY s."DayOfWeek", s."StartTime"
      `;
      const { rows: slotsRaw } = await pool.query(gridSql, [scheduleId]);
      const slots = slotsRaw.map(r => ({
        ...r,
        day: normDay(r.day),
        start: toHM(r.start),
        end: toHM(r.end),
      }));

      groups.push({
        scheduleId,
        meta: {
          level: row.Level,
          status: row.Status,
          groupNo: row.GroupNo,
          count: slots.length,
        },
        slots,
      });
    }

    return res.json({
      meta: { level, status: statusRaw || null, groupNo: groupNoRaw, groupsCount: groups.length },
      groups,
    });
  } catch (err) {
    console.error("getGridByLevel error:", err);
    return res.status(500).json({ error: "Internal server error", details: err?.message || "" });
  }
}
