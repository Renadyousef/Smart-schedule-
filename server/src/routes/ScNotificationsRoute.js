import express from "express";
import {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
} from "../controllers/NotificationSC.js"; // exact file name

const router = express.Router();

/**
 * This router is mounted in app.js at path `/Notifications`.
 * Therefore, define routes RELATIVE to that mount so the final
 * URLs become:
 *   POST   /Notifications
 *   GET    /Notifications/view
 *   PATCH  /Notifications/:id/read
 *   POST   /Notifications/mark-all-read
 */
router.post("/", createNotification);
router.get("/view", listNotifications);
router.patch("/:id/read", markRead);
router.post("/mark-all-read", markAllRead);

export default router;
