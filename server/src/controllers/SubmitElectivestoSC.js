import pool from '../../DataBase_config/DB_config.js';

export const submit_electives = async (req, res) => {
  try {
    const { electives } = req.body;
    const userId = req.user.id; // from JWT middleware

    if (!electives || electives.length === 0) {
      return res.status(400).json({ error: "No electives provided" });
    }

    // Get registrar's department
    const userResult = await pool.query(
      `SELECT "DepartmentID" FROM "User" WHERE "UserID" = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Registrar not found" });
    }
    const departmentId = userResult.rows[0].DepartmentID;

    const now = new Date();
    const inserted = [];

    const insertQuery = `
      INSERT INTO "Offers" 
      ("CourseID", "DepartmentID", "OfferedAt", "ClassType", "Section", "Days", "StartTime", "EndTime", "Status")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    for (const elective of electives) {
      // Insert Lecture
      const lectureResult = await pool.query(insertQuery, [
        elective.CourseID,
        departmentId,
        now,
        "Lecture",
        elective.lectureSection,
        elective.lectureDays,
        elective.lectureStart,
        elective.lectureEnd,
        "Offered",
      ]);
      inserted.push(lectureResult.rows[0]);

      // Insert Tutorial
      const tutorialResult = await pool.query(insertQuery, [
        elective.CourseID,
        departmentId,
        now,
        "Tutorial",
        elective.tutorialSection,
        elective.tutorialDays,
        elective.tutorialStart,
        elective.tutorialEnd,
        "Offered",
      ]);
      inserted.push(tutorialResult.rows[0]);

      // Insert Lab if labSection exists
      if (elective.labSection && elective.labDays && elective.labStart && elective.labEnd) {
        const labResult = await pool.query(insertQuery, [
          elective.CourseID,
          departmentId,
          now,
          "Lab",
          elective.labSection,
          elective.labDays,
          elective.labStart,
          elective.labEnd,
          "Offered",
        ]);
        inserted.push(labResult.rows[0]);
      }
    }

    // Safely insert notification without breaking electives
    try {
      const depResult = await pool.query(
        `SELECT "Name" FROM "Departments" WHERE "DepartmentID" = $1`,
        [departmentId]
      );
      const departmentName = depResult.rows[0]?.Name || "Unknown Department";

      const message = `New electives have been offered by ${departmentName} Department.`;

      await pool.query(
        `INSERT INTO "Notifications" ("Message", "CreatedBy", "Type", "IsRead")
         VALUES ($1, $2, $3, $4)`,
        [message, userId, 'register_to_scheduler', false]
      );
    } catch (notifErr) {
      console.error("Notification insert failed:", notifErr);
    }

    return res.json({
      message: "Electives offered successfully",
      offered: inserted,
    });

  } catch (err) {
    console.error("Error submitting electives:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
