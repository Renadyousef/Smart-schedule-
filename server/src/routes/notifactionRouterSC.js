// server/src/routes/notifactionRouterSC.js
import express from "express";
import {
  viewLanding,
  unreadCount,
  markRead,
  clearAll,
  health,
} from "../controllers/notifactionControllerSC.js";

const router = express.Router();

router.get("/view", viewLanding);
router.get("/unread-count", unreadCount);
router.post("/mark-read", markRead);
router.post("/clear-all", clearAll);
router.get("/health", health);

export default router;
