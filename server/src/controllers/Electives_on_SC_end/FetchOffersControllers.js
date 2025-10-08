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
//apprive offers
export const handel_offers = async (req, res) => {
  const offerId = req.params.id;
  
  try {
    // Update status to 'Approved'
    const update = await pool.query(
      `UPDATE public."Offers"
       SET "Status" = 'Approved'
       WHERE "OfferID" = $1
       RETURNING *;`,
      [offerId]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({ error: "Offer not found" });
    }

    res.json({
      message: "Offer approved successfully",
      updatedOffer: update.rows[0]
    });

  } catch (err) {
    console.error("Error approving offer:", err);
    res.status(500).json({ error: "Failed to approve offer" });
  }
};