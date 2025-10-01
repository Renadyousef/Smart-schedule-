// server/src/controllers/feedback.controller.js
import pool from "../../DataBase_config/DB_config.js";

export async function createFeedback(req, res) {
  try {
    const { comment, scheduleId, courseId = null, role, userId } = req.body;

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ error: "Comment is required" });
    }
    if (!scheduleId) {
      return res.status(400).json({ error: "ScheduleID is required" });
    }
    if (!userId) {
      return res.status(400).json({ error: "UserID is required" });
    }

    const sql = `
      INSERT INTO "Feedback"
        ("Comment","ScheduleID","CourseID","UserID","role","CreatedAt")
      VALUES ($1,$2,$3,$4,$5, NOW())
      RETURNING "FeedbackID";
    `;
    const params = [comment.trim(), Number(scheduleId), courseId, Number(userId), role || null];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json({ ok: true, feedbackId: rows[0].FeedbackID });
  } catch (err) {
    console.error("createFeedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// (اختياري) لعرض فيدباك حسب الجدول
export async function listFeedbackBySchedule(req, res) {
  try {
    const scheduleId = Number(req.params.scheduleId);
    if (!scheduleId) return res.status(400).json({ error: "Invalid scheduleId" });

    const { rows } = await pool.query(
      `SELECT "FeedbackID","Comment","UserID","role","CreatedAt"
       FROM "Feedback" WHERE "ScheduleID"=$1 ORDER BY "CreatedAt" DESC`,
      [scheduleId]
    );
    return res.json({ scheduleId, count: rows.length, rows });
  } catch (err) {
    console.error("listFeedbackBySchedule error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
