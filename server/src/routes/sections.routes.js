// server/src/routes/sections.routes.js
import { Router } from "express";
import { getCoursesByLevel } from "../controllers/sections.controller.js";
// import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

// فعّلي verifyToken لاحقًا إذا بغيتي
router.get("/courses-by-level", /* verifyToken, */ getCoursesByLevel);

export default router;