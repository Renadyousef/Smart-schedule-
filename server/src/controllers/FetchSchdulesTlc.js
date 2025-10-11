import pool from "../../DataBase_config/DB_config.js";

// helpers
function toHM(v) {
  if (!v) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}
function normDay(v) {
  if (!v) return null;
  return String(v).trim();
}

/**
 * Fetch all shared schedules for a level (multiple groups)
 */
export const getSchedulesByLevel = async (req, res) => {
  try {
    const level = Number(req.query.level);
    if (!Number.isInteger(level)) return res.status(400).json({ error: "level must be integer" });

    const statusFilter = "approved"; // Only fetch shared schedules
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
        SELECT s."SlotID", sec."SectionID", c.is_external, c.course_code, c.course_name,
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
export const getSchedulesByCourse = async (req,res) => {
  try {
    const courseId = Number(req.query.courseId);
    if (!Number.isInteger(courseId)) return res.status(400).json({ error: "courseId must be integer" });

    const sql = `
      SELECT sch."ScheduleID", sch."Level", sch."GroupNo", sch."Status",
             s."SectionID", s."Room", sl."DayOfWeek" AS day, sl."StartTime" AS start, sl."EndTime" AS end,
             c.course_name, c.course_code
      FROM "Schedule" sch
      JOIN "Sections" s ON s."ScheduleID"=sch."ScheduleID"
      JOIN courses c ON c."CourseID"=s."CourseID"
      LEFT JOIN "ScheduleSlot" sl ON sl."SlotID"=s."SlotID"
      WHERE c."CourseID"=$1 AND LOWER(sch."Status")='shared'
      ORDER BY sch."GroupNo", s."SectionID";
    `;
    const { rows } = await pool.query(sql,[courseId]);

    res.json({ meta:{courseId, count: rows.length}, rows });

  } catch(err) {
    console.error("TLC getSchedulesByCourse error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
