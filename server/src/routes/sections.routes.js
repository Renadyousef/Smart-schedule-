import { Router } from "express";
import { getCoursesByLevel } from "../controllers/sections.controller.js";
// لو بغيتِ حماية بالتوكن فعّلي verifyToken
// import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

// بدون توكن مؤقتًا لتجربة المسار:
router.get("/courses-by-level", /* verifyToken, */ getCoursesByLevel);

export default router;
