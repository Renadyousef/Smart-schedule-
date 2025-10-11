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

    // Insert feedback with Role = 'tlc'
    const feedbackQuery = `
      INSERT INTO "Feedback" ("Comment", "ScheduleID", "CreatedAt", "UserID", "role")
      VALUES ($1, $2, NOW(), $3, 'tlc')
      RETURNING *;
    `;
    const feedbackResult = await pool.query(feedbackQuery, [comment, scheduleId, userId]);
    const feedback = feedbackResult.rows[0];

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback
    });

  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
};
