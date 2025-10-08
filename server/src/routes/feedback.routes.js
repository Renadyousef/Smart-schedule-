// server/src/routes/feedback.routes.js
import { Router } from "express";
import { createFeedback, listFeedbackBySchedule } from "../controllers/feedback.controller.js";
// import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

// POST /api/feedback
router.post("/", /* verifyToken, */ createFeedback);

// GET /api/feedback/by-schedule/:scheduleId
router.get("/by-schedule/:scheduleId", /* verifyToken, */ listFeedbackBySchedule);

export default router;

