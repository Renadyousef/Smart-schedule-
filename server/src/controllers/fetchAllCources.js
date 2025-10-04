import pool from '../../DataBase_config/DB_config.js';

// Fetch courses (ID + name)
export const fetchCourses = async (req, res) => {
  try {
   const result = await pool.query(
  `SELECT "CourseID" AS id, "course_name" AS name FROM "courses" ORDER BY "CourseID"`
);


    const rows = result.rows; // extract rows properly
    res.json(rows);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).send("Server error");
  }
};

