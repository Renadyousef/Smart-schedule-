// server/src/controllers/sections.controller.js
import pool from "../../DataBase_config/DB_config.js";

// GET /api/sections/courses-by-level?level=5&status=draft&includeSlots=1
export async function getCoursesByLevel(req, res) {
  try {
    const level = Number(req.query.level);
    const status = "draft"; // أو خليه من الكويري إذا تبين
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

    const slotOrder = includeSlots
      ? `sl."DayOfWeek" NULLS LAST, sl."StartTime" NULLS LAST,`
      : "";

    const sql = `
      SELECT
        sch."ScheduleID"               AS "ScheduleID",   -- ✅ مهم للواجهة
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
      WHERE sch."Level" = $1 AND LOWER(sch."Status") = $2
      ORDER BY ${slotOrder} c."course_code", s."SectionID";
    `;

    const { rows } = await pool.query(sql, [level, status]);

    // نرجّع scheduleId صريحًا (لو فيه صفوف)
    const scheduleId =
      rows?.[0]?.ScheduleID !== undefined ? rows[0].ScheduleID : null;

    return res.json({
      scheduleId,                     // ✅ هذا ما تحتاجه الواجهة لتمكين زر الإرسال
      meta: { level, status, includeSlots, count: rows.length },
      rows,
    });
  } catch (err) {
    console.error("getCoursesByLevel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}