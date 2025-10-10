import express from "express";
import {
  viewNotifications,
  getCounts,
  markRead,
  markAllRead,
  createNotification,
} from "../controllers/NotificationsController.js";

const router = express.Router();

router.get("/view", viewNotifications);
router.get("/counts", getCounts);
router.post("/mark-read", markRead);
router.post("/mark-all-read", markAllRead);
router.post("/create", createNotification); // للاختبار

export default router;
