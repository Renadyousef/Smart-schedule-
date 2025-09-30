// controllers/fetchElectiveCourses.js
import pool from '../../DataBase_config/DB_config.js';

export const fetchElectiveCourses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "CourseID",
             "course_name",
             "course_code",
             "credit_hours",
             "DepartmentID",
             "is_external"
      FROM "courses"
      WHERE "course_type" = 'Elective'
      ORDER BY "course_code"
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};
