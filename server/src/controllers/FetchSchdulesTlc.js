import pool from "../../DataBase_config/DB_config.js";

// ---------- helpers ----------
function toHM(v) {
  if (!v) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function normDay(v) {
  if (!v) return null;
  return String(v).trim();
}

function normalizeType(type, courseName) {
  const t = String(type || "").toLowerCase();
  if (t === "tutorial") return "tutorial";
  if (t === "lab" || t === "laboratory") return "lab";
  if (t === "elective" || t === "optional") return "elective";

  const name = String(courseName || "").toLowerCase();
  if (/tutorial/.test(name)) return "tutorial";
  if (/lab|laborator/.test(name)) return "lab";

  return "core";
}

/**
 * Fetch all  schedules for a level multiple groups
 */
export const getSchedulesByLevel = async (req, res) => {
  try {
    const level = Number(req.query.level);
    if (!Number.isInteger(level)) return res.status(400).json({ error: "level must be integer" });

    const statusFilter = "shared";
    const sqlSchedules = `
      SELECT "ScheduleID","Level","GroupNo","Status"
      FROM "Schedule"
      WHERE "Level"=$1 AND LOWER("Status")=$2
      ORDER BY COALESCE("GroupNo",0), "ScheduleID"
    `;
    const { rows: schedules } = await pool.query(sqlSchedules, [level, statusFilter]);
    if (!schedules.length) return res.json({ meta:{level, groupsCount:0}, groups: [] });

    const groups = [];
    for (const sch of schedules) {
      const slotsSql = `
        SELECT s."SlotID", sec."SectionID", c.is_external, c.course_code, c.course_name, c.course_type,
               COALESCE(sec."SectionNumber",1) AS section_number,
               COALESCE(sec."Capacity",30) AS capacity,
               s."DayOfWeek" AS day, s."StartTime" AS start, s."EndTime" AS end
        FROM "ScheduleSlot" s
        JOIN courses c ON c."CourseID"=s."CourseID"
        LEFT JOIN "Sections" sec ON sec."SlotID"=s."SlotID"
        WHERE s."ScheduleID"=$1
        ORDER BY s."DayOfWeek", s."StartTime"
      `;
      const { rows: slotsRaw } = await pool.query(slotsSql, [sch.ScheduleID]);

      const slots = slotsRaw.map(r => ({
        ...r,
        day: normDay(r.day),
        start: toHM(r.start),
        end: toHM(r.end),
        course_type: normalizeType(r.course_type, r.course_name),
      }));

      groups.push({
        scheduleId: sch.ScheduleID,
        meta: {
          level: sch.Level,
          status: sch.Status,
          groupNo: sch.GroupNo,
          count: slots.length
        },
        slots
      });
    }

    res.json({ meta: { level, groupsCount: groups.length }, groups });

  } catch (err) {
    console.error("TLC getSchedulesByLevel error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Fetch schedules by course
 */
export const getSchedulesByCourse = async (req, res) => {
  try {
    const courseId = Number(req.query.courseId);
    if (!Number.isInteger(courseId))
      return res.status(400).json({ error: "courseId must be integer" });

    const statusFilter = "shared";

    // Select distinct schedules only
    const sqlSchedules = `
      SELECT DISTINCT sch."ScheduleID", sch."Level", sch."GroupNo", sch."Status"
      FROM "Schedule" sch
      JOIN "ScheduleSlot" sl ON sl."ScheduleID" = sch."ScheduleID"
      WHERE sl."CourseID" = $1 AND LOWER(sch."Status") = $2
      ORDER BY sch."Level", sch."GroupNo", sch."ScheduleID";
    `;
    const { rows: schedules } = await pool.query(sqlSchedules, [courseId, statusFilter]);
    if (!schedules.length) return res.json({ meta:{courseId, groupsCount:0}, groups: [] });

    const groups = [];
    for (const sch of schedules) {
      const slotsSql = `
        SELECT s."SlotID", sec."SectionID", c.is_external, c.course_code, c.course_name, c.course_type,
               COALESCE(sec."SectionNumber",1) AS section_number,
               COALESCE(sec."Capacity",30) AS capacity,
               s."DayOfWeek" AS day, s."StartTime" AS start, s."EndTime" AS end,
               sec."Room" AS room
        FROM "ScheduleSlot" s
        JOIN courses c ON c."CourseID" = s."CourseID"
        LEFT JOIN "Sections" sec ON sec."SlotID" = s."SlotID"
        WHERE s."ScheduleID" = $1 AND s."CourseID" = $2
        ORDER BY s."DayOfWeek", s."StartTime"
      `;
      const { rows: slotsRaw } = await pool.query(slotsSql, [sch.ScheduleID, courseId]);

      const slots = slotsRaw.map(r => ({
        ...r,
        day: r.day?.trim() || null,
        start: r.start?.toString().slice(0,5) || null,
        end: r.end?.toString().slice(0,5) || null,
        course_type: normalizeType(r.course_type, r.course_name),
      }));

      groups.push({
        scheduleId: sch.ScheduleID,
        meta: {
          level: sch.Level,
          status: sch.Status,
          groupNo: sch.GroupNo,
          count: slots.length
        },
        slots
      });
    }

    res.json({ meta: { courseId, groupsCount: groups.length }, groups });

  } catch(err) {
    console.error("TLC getSchedulesByCourse error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
