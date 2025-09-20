import bcrypt from "bcrypt";
import pool from "../../../DataBase_config/DB_config.js"; // note the .js extension

// Signup
export const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, department } = req.body;

    // Check if user already exists
    const checkUser = await pool.query(
      `SELECT "UserID" FROM "User" WHERE "Email" = $1`,
      [email]
    );
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });//i need to show that in front!
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build full name
    const fullName = `${firstName} ${lastName}`;

    // Insert new user (UserID is auto)
    const result = await pool.query(
  `INSERT INTO "User" 
    ("First_name", "Last_name", "Email", "Password", "Role", "DepartmentID")
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING "UserID", "Email", "Role"`,
  [
    firstName,
    lastName,
    email,
    hashedPassword,
    role,
    null, // DepartmentID placeholder i need to map it to actual dep
  ]
);


   const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.UserID, email: user.Email, role: user.Role },
      process.env.JWT_SECRET
    );

    // Respond with user + token
    res.status(201).json({
      message: "Sign Up successful!",
      token,
      user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Signup failed" });
  }
};
