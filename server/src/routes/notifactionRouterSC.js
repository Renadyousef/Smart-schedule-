// server/src/routes/notifactionRouterSC.js
import express from "express";
import {
  getSharedScheduleNotifications,
  getSharedScheduleUnreadCount,
  markSharedScheduleRead,        // PATCH /mark-read/:id
  markSharedScheduleReadBatch,   // POST  /mark-read  { ids:[] }
  clearAllSharedSchedule         // POST  /clear-all
} from "../controllers/notifactionControllerSC.js";

const router = express.Router();

// صحّة خاصة بالراوتر نفسه
router.get("/__health", (_req, res) => res.json({ ok: true, scope: "NotificationsSC" }));

/* المسارات الأساسية (لو حبيتي تستعمليها) */
router.get("/tlc", getSharedScheduleNotifications);
router.get("/tlc/unread-count", getSharedScheduleUnreadCount);
router.patch("/tlc/:id/read", markSharedScheduleRead);

/* ALIASES المتوافقة مع الواجهة الحالية */
router.get("/view", getSharedScheduleNotifications);       // GET /NotificationsSC/view?limit=30
router.get("/unread-count", getSharedScheduleUnreadCount); // GET /NotificationsSC/unread-count
router.patch("/mark-read/:id", markSharedScheduleRead);    // PATCH /NotificationsSC/mark-read/:id
router.post("/mark-read", markSharedScheduleReadBatch);    // POST  /NotificationsSC/mark-read
router.post("/clear-all", clearAllSharedSchedule);         // POST  /NotificationsSC/clear-all

export default router;
