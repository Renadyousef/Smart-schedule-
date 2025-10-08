import pool from "../../DataBase_config/DB_config.js";

/**
 * 📘 Fetch schedules by level
 * Links: Schedule -> Sections -> Courses -> Slot (optional)
 */
export const getSchedulesByLevel = async (req, res) => {
  try {
    const level = Number(req.query.level);
    const includeSlots = req.query.includeSlots === "1";

    if (!Number.isInteger(level)) {
      return res.status(400).json({ message: "Query param 'level' must be integer" });
    }

    const slotSelect = includeSlots
      ? `, sl."DayOfWeek", sl."StartTime", sl."EndTime"`
      : "";

    const slotJoin = includeSlots
      ? `LEFT JOIN "ScheduleSlot" sl ON sl."SlotID" = s."SlotID"`
      : "";

    const sql = `
      SELECT
        sch."ScheduleID",
        sch."Level",
        c."course_code",
        c."course_name",
        s."SectionID",
        s."Room" AS room
        ${slotSelect}
      FROM "Schedule" sch
      JOIN "Sections" s ON s."ScheduleID" = sch."ScheduleID"
      JOIN "courses"  c ON c."CourseID" = s."CourseID"
      ${slotJoin}
      WHERE sch."Level" = $1
      ORDER BY c."course_code", s."SectionID";
    `;

    const { rows } = await pool.query(sql, [level]);

    return res.json({
      meta: { level, includeSlots, count: rows.length },
      rows,
    });
  } catch (err) {
    console.error("Error fetching schedules by level:", err);
    res.status(500).json({ message: "Error fetching schedules by level" });
  }
};

/**
 * 📗 Fetch schedules by course ID
 * Links: Schedule -> Sections -> Courses -> Slot (optional)
 */
export const getSchedulesByCourse = async (req, res) => {
  try {
    const courseId = Number(req.query.courseId);
    const includeSlots = req.query.includeSlots === "1";

    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ message: "Query param 'courseId' must be integer" });
    }

    const slotSelect = includeSlots
      ? `, sl."DayOfWeek", sl."StartTime", sl."EndTime"`
      : "";

    const slotJoin = includeSlots
      ? `LEFT JOIN "ScheduleSlot" sl ON sl."SlotID" = s."SlotID"`
      : "";

    const sql = `
      SELECT
        sch."ScheduleID",
        sch."Level",
        c."course_code",
        c."course_name",
        s."SectionID",
        s."Room" AS room
        ${slotSelect}
      FROM "Schedule" sch
      JOIN "Sections" s ON s."ScheduleID" = sch."ScheduleID"
      JOIN "courses"  c ON c."CourseID" = s."CourseID"
      ${slotJoin}
      WHERE c."CourseID" = $1
      ORDER BY s."SectionID";
    `;

    const { rows } = await pool.query(sql, [courseId]);

    return res.json({
      meta: { courseId, includeSlots, count: rows.length },
      rows,
    });
  } catch (err) {
    console.error("Error fetching schedules by course:", err);
    res.status(500).json({ message: "Error fetching schedules by course" });
  }
};
