import bcrypt from "bcrypt";
import pool from "../../../DataBase_config/DB_config.js"; 

export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const result = await pool.query(
      `SELECT "UserID", "Email", "Password", "Role" FROM "User" WHERE "Email" = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    // Compare hashed passwords
    const match = await bcrypt.compare(password, user.Password);
    if (!match) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Success
    res.status(200).json({
      message: "Sign in successful",
      user: {
        id: user.UserID,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Sign in failed" });
  }
};
