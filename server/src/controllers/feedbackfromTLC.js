// controllers/feedbackTLC.js
import pool from "../../DataBase_config/DB_config.js"; 

export const submitFeedback = async (req, res) => {
  try {
    const { comment, scheduleId } = req.body;
    const userId = req.user?.id;

    if (!comment || !scheduleId) {
      return res.status(400).json({ error: "Comment and ScheduleID are required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: user not found" });
    }

    // Insert feedback
    const feedbackQuery = `
      INSERT INTO "Feedback" ("Comment", "ScheduleID", "CreatedAt", "UserID")
      VALUES ($1, $2, NOW(), $3)
      RETURNING *;
    `;
    const feedbackResult = await pool.query(feedbackQuery, [comment, scheduleId, userId]);
    const feedback = feedbackResult.rows[0];

    // Fetch schedule info
    const scheduleResult = await pool.query(
      `SELECT "Level", "GroupNo" FROM "Schedule" WHERE "ScheduleID" = $1`,
      [scheduleId]
    );
    const schedule = scheduleResult.rows[0];
    const scheduleInfo = schedule
      ? `Level ${schedule.Level} - Group ${schedule.GroupNo}`
      : `Schedule #${scheduleId}`;

    // Insert notification
    const notificationMessage = `New TLC feedback for Schedule of ${scheduleInfo}: ${comment}`;
    const notificationQuery = `
      INSERT INTO "Notifications" ("Message", "CreatedAt", "CreatedBy", "Type", "IsRead")
      VALUES ($1, NOW(), $2, $3, false)
      RETURNING *;
    `;
    const notificationResult = await pool.query(notificationQuery, [
      notificationMessage,
      userId,                // CreatedBy
      "tlc_schedule_feedback" // Type
    ]);
    const notification = notificationResult.rows[0];
    console.log("Notification inserted:", notification);

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback,
      notification
    });

  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
};
