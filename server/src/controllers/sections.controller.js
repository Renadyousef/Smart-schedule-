// server/src/controllers/sections.controller.js
import pool from "../../DataBase_config/DB_config.js";

// GET /api/sections/courses-by-level?level=5&status=draft&includeSlots=1
export async function getCoursesByLevel(req, res) {
  try {
    const level = Number(req.query.level);
    const includeSlots = req.query.includeSlots === "1";

    if (!Number.isInteger(level)) {
      return res.status(400).json({ error: "Query param 'level' must be integer" });
    }

    const slotSelect = includeSlots
      ? `,
        sl."DayOfWeek",
        sl."StartTime",
        sl."EndTime"`
      : "";

    const slotJoin = includeSlots
      ? `LEFT JOIN "ScheduleSlot" sl ON sl."SlotID" = s."SlotID"`
      : "";

    // 🔒 فلترة ثابتة على draft فقط
    const sql = `
      SELECT
        sch."ScheduleID"               AS "ScheduleID",
        sch."Level"                    AS "Level",
        sch."Status"                   AS "Status",
        c."course_code",
        c."course_name",
        LOWER(c."course_type")         AS "course_type",
        s."SectionID",
        COALESCE(s."Room", s."ClassRoom") AS room
        ${slotSelect}
      FROM "Sections" s
      JOIN "Schedule" sch ON sch."ScheduleID" = s."ScheduleID"
      JOIN "courses"  c   ON c."CourseID"    = s."CourseID"
      ${slotJoin}
      WHERE sch."Level" = $1
        AND LOWER(sch."Status") = 'draft'
      ORDER BY
        ${includeSlots ? `sl."DayOfWeek" NULLS LAST, sl."StartTime" NULLS LAST,` : ""}
        c."course_code", s."SectionID";
    `;

    const { rows } = await pool.query(sql, [level]);
    const scheduleId = rows?.[0]?.ScheduleID ?? null;

    return res.json({
      scheduleId,
      meta: { level, status: "draft", includeSlots, count: rows.length },
      rows,
    });
  } catch (err) {
    console.error("getCoursesByLevel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
