import express from "express";
import { verifyToken } from "../middleware/verfiyToken.js";
import {
  fetchMyNotifications,
  markNotificationRead,
  createNotification,
} from "../controllers/NotificationSC.js";

const router = express.Router();

// كل المستخدم يشوف إشعاراته فقط
router.get("/view", verifyToken, fetchMyNotifications);

// تأشير كمقروء
router.patch("/:id/read", verifyToken, markNotificationRead);

// إنشاء إشعار (تستخدمونها من أي مكان بالخلفية، أو مؤقتًا عبر POST)
router.post("/", verifyToken, createNotification);

export default router;
