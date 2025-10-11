// server/src/routes/notifications.routes.js
import express from "express";
import {
  getSCNotifications,
  markNotificationRead,
  markAllSCRead,
} from "../controllers/notifications.controller.js";

const router = express.Router();

router.get("/sc", getSCNotifications);
router.put("/:id/read", express.json(), markNotificationRead);
router.put("/sc/mark-all-read", express.json(), markAllSCRead);

export default router;