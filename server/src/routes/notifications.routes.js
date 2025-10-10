// server/src/routes/notifications.routes.js
import express from "express";
import {
  getSCNotifications,
  markNotificationRead,
  markAllSCRead,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// قائمة إشعارات SC (مع فلاتر اختيارية)
router.get("/sc", getSCNotifications);

// تعليم إشعار واحد كمقروء/غير مقروء
router.put("/:id/read", express.json(), markNotificationRead);

// تعليم كل إشعارات SC كمقروء
router.put("/sc/mark-all-read", markAllSCRead);

export default router;
