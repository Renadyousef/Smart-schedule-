import express from "express";

import { verifyToken } from "../middleware/verfiyToken.js";
import { fetch_notifications } from "../controllers/NotificationSC.js";
const router = express.Router();
//to get them on display
router.get('/view',fetch_notifications)

export default router;