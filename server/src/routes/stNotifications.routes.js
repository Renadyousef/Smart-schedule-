// server/src/routes/stNotifications.routes.js
import express from "express";
import { getStudentNotifications, markAllStudentScheduleRead } from "../controllers/stNotifications.controller.js";

const router = express.Router();

router.get("/", getStudentNotifications);
router.put("/mark-all-read", markAllStudentScheduleRead); // 👈 جديد

export default router;