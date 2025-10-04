
import pool from "../../DataBase_config/DB_config.js";

// Fetch schedules by level
export const getSchedulesByLevel = async (req, res) => {
  try {
    const { level } = req.query;

    if (!level) {
      return res.status(400).json({ message: "Level is required" });
    }

    const [rows] = await pool.query(
      `SELECT schedules.*, sections.name AS section_name
       FROM schedules
       JOIN sections ON schedules.section_id = sections.id
       WHERE sections.level = ?`,
      [level]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching schedules by level:", err);
    res.status(500).json({ message: "Error fetching schedules by level" });
  }
};

// Fetch schedules by course
export const getSchedulesByCourse = async (req, res) => {
  try {
    const { courseId } = req.query;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const [rows] = await pool.query(
      `SELECT schedules.*, sections.name AS section_name, courses.name AS course_name
       FROM schedules
       JOIN sections ON schedules.section_id = sections.id
       JOIN courses ON sections.course_id = courses.id
       WHERE sections.course_id = ?`,
      [courseId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching schedules by course:", err);
    res.status(500).json({ message: "Error fetching schedules by course" });
  }
};
