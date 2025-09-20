// server/src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config(); // load JWT_SECRET from .env

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization header:", authHeader); // DEBUG

  if (!authHeader) {
    console.log("No token provided");
    return res.status(401).json({ msg: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { id, email, role }
    console.log("Token decoded successfully:", decoded); // DEBUG
    next();
  } catch (err) {
    console.log("Token verification failed:", err.message); // DEBUG
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Unauthorized: Token expired" });
    }
    return res.status(403).json({ msg: "Forbidden: Invalid token" });
  }
};
