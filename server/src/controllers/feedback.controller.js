// server/src/controllers/feedback.controller.js
import pool from "../../DataBase_config/DB_config.js";

/**
 * POST /api/feedback
 * body: { comment, scheduleId, courseId?, userId?, role }
 *
 * ملاحظات:
 * - comment (نص الفيدباك) إجباري
 * - scheduleId إجباري
 * - role إجباري (student | tlc | ...). التريغر يستخدمه لتحديد نوع النوتفكيشن
 * - courseId اختياري (لو كان الفيدباك على كورس معيّن)
 * - userId اختياري (جدول Feedback يسمح NULL حسب صورتك)
 */
export async function createFeedback(req, res) {
  const { comment, scheduleId, courseId, userId, role } = req.body ?? {};

  if (!comment || !scheduleId || !role) {
    return res.status(400).json({
      error: "Fields required: comment, scheduleId, role",
    });
  }

  try {
    const sql = `
      INSERT INTO "Feedback"
        ("Comment","ScheduleID","CourseID","UserID","role","CreatedAt")
      VALUES
        ($1,$2,$3,$4,$5,NOW())
      RETURNING
        "FeedbackID","Comment","ScheduleID","CourseID","UserID","role","CreatedAt";
    `;
    const params = [
      comment,
      Number(scheduleId),
      courseId ? Number(courseId) : null,
      userId ? Number(userId) : null,
      role,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("createFeedback error:", err);
    return res.status(500).json({ error: "Failed to create feedback" });
  }
}

/**
 * GET /api/feedback/by-schedule/:scheduleId
 * يرجّع كل الفيدباكات لجدول معيّن (مع إمكانية الفلترة بالـ role).
 * Query: role=student|tlc (اختياري)
 */
export async function listFeedbackBySchedule(req, res) {
  const scheduleId = Number(req.params.scheduleId);
  const { role } = req.query;

  if (!scheduleId) {
    return res.status(400).json({ error: "scheduleId is required (param)" });
  }

  try {
    let sql = `
      SELECT
        f."FeedbackID",
        f."Comment",
        f."ScheduleID",
        f."CourseID",
        f."UserID",
        f."role",
        f."CreatedAt"
      FROM "Feedback" f
      WHERE f."ScheduleID" = $1
    `;
    const params = [scheduleId];

    if (role) {
      sql += ` AND lower(f."role") = lower($2) `;
      params.push(role);
    }

    sql += ` ORDER BY f."CreatedAt" DESC, f."FeedbackID" DESC;`;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("listFeedbackBySchedule error:", err);
    return res.status(500).json({ error: "Failed to fetch feedback" });
  }
}

/**
 * GET /api/feedback/by-schedule/:scheduleId/course/:courseId
 * يرجّع فيدباكات سكجول + كورس معيّن (اختياري فلترة role).
 * Query: role=student|tlc (اختياري)
 */
export async function listFeedbackByScheduleAndCourse(req, res) {
  const scheduleId = Number(req.params.scheduleId);
  const courseId = Number(req.params.courseId);
  const { role } = req.query;

  if (!scheduleId || !courseId) {
    return res
      .status(400)
      .json({ error: "scheduleId and courseId are required (params)" });
  }

  try {
    let sql = `
      SELECT
        f."FeedbackID",
        f."Comment",
        f."ScheduleID",
        f."CourseID",
        f."UserID",
        f."role",
        f."CreatedAt"
      FROM "Feedback" f
      WHERE f."ScheduleID" = $1
        AND f."CourseID"   = $2
    `;
    const params = [scheduleId, courseId];

    if (role) {
      sql += ` AND lower(f."role") = lower($3) `;
      params.push(role);
    }

    sql += ` ORDER BY f."CreatedAt" DESC, f."FeedbackID" DESC;`;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("listFeedbackByScheduleAndCourse error:", err);
    return res.status(500).json({ error: "Failed to fetch feedback" });
  }
}
