// server/src/routes/sections.routes.js
import { Router } from "express";
import { getCoursesByLevel, getGridByLevel } from "../controllers/sections.controller.js";

const router = Router();

router.get("/courses-by-level", getCoursesByLevel);
router.get("/grid-by-level", getGridByLevel);

export default router;
