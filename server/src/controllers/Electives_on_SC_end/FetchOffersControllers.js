import pool from "../../../DataBase_config/DB_config.js";

// Fetch all offers on Sc end
export const fetch_offers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o."OfferID",
        o."DepartmentID",
        d."Name" AS departmentname,
        o."CourseID",
        c."course_name" AS coursename,
        o."Section",
        o."ClassType",
        o."Status",
        o."Days",
        o."StartTime",
        o."EndTime",
        o."OfferedAt"
      FROM public."Offers" o
      JOIN public."Departments" d ON o."DepartmentID" = d."DepartmentID"
      JOIN public."courses" c ON o."CourseID" = c."CourseID"
      ORDER BY o."OfferedAt" DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
};