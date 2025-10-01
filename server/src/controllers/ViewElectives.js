import pool from "../../DataBase_config/DB_config.js";

export const view_electives = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get registrar's department
    const userResult = await pool.query(
      'SELECT "DepartmentID" FROM "User" WHERE "UserID" = $1',
      [userId]
    );
    const userRows = userResult.rows;

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const registrarDepId = userRows[0].DepartmentID;

    // 2. Fetch ALL students' preferences (not filtered by student dep)
    const prefsResult = await pool.query('SELECT "preferences" FROM "Students"');
    const prefsRows = prefsResult.rows;

    if (prefsRows.length === 0) {
      return res.json({ departmentId: registrarDepId, electives: [] });
    }

    // 3. Aggregate only subjects that belong to registrar's department
    const counts = {};
    for (const row of prefsRows) {
      // Parse the preferences only if it's a string, otherwise use it directly
      const preferences =
        typeof row.preferences === "string"
          ? JSON.parse(row.preferences)
          : row.preferences || [];

      for (const pref of preferences) {
        if (pref.DepartmentID === registrarDepId) {
          const key = pref.CourseID;
          if (!counts[key]) {
            counts[key] = {
              CourseID: pref.CourseID,
              code: pref.code,
              name: pref.name,
              credit_hours: pref.credit_hours,
              count: 0,
            };
          }
          counts[key].count++;
        }
      }
    }

    // 4. Convert to array and sort by popularity
    const results = Object.values(counts).sort((a, b) => b.count - a.count);

    return res.json({ departmentId: registrarDepId, electives: results });
  } catch (err) {
    console.error("Error fetching electives:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
