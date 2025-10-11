// controllers/feedbackTLC.js
import pool from "../../DataBase_config/DB_config.js"; 

export const submitFeedback = async (req, res) => {
  const client = await pool.connect();
  try {
    const { comment, scheduleId } = req.body;
    const userId = req.user?.id; // logged-in user ID

    if (!comment || !scheduleId) {
      return res.status(400).json({ error: "Comment and ScheduleID are required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: user not found" });
    }

    await client.query("BEGIN");

    // Insert feedback, btw we didnt inser usr id inseter its value from above 
    const feedbackQuery = `
      INSERT INTO "Feedback" ("Comment", "ScheduleID", "CreatedAt","UserID")
      VALUES ($1, $2, NOW(),$3)
      RETURNING *;
    `;
    const feedbackResult = await client.query(feedbackQuery, [comment, scheduleId,userId]);
    const feedback = feedbackResult.rows[0];

    // Fetch schedule info to include in notification
    const scheduleQuery = `
      SELECT "Level", "GroupNo" 
      FROM "Schedule" 
      WHERE "ScheduleID" = $1
    `;
    const scheduleResult = await client.query(scheduleQuery, [scheduleId]);
    const schedule = scheduleResult.rows[0];

    const scheduleInfo = schedule
      ? `Level ${schedule.Level} - Group ${schedule.GroupNo}`
      : `Schedule #${scheduleId}`;

    // Insert notification
    const notificationMessage = `New TLC feedback for ${scheduleInfo}: ${comment}`;
    const notificationQuery = `
      INSERT INTO "Notifications" ("Message", "CreatedAt", "CreatedBy", "Type", "IsRead")
      VALUES ($1, NOW(), $2, $3, false)
      RETURNING *;
    `;
    const notificationResult = await client.query(notificationQuery, [
      notificationMessage,
      userId,
      "tlc_schedule_feedback",
    ]);
    const notification = notificationResult.rows[0];

    await client.query("COMMIT");

    res.status(201).json({
      message: "Feedback submitted  successfully",
      feedback,
      notification,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving feedback and notification:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  } finally {
    client.release();
  }
};
