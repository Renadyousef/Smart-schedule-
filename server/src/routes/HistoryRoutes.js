import { Router } from "express";
import { listHistory, getHistoryEntry } from "../controllers/historyController.js";
import { verifyToken as requireAuth } from "../middleware/verfiyToken.js";

const router = Router();

router.get("/", requireAuth, listHistory);
router.get("/:historyId", requireAuth, getHistoryEntry);

export default router;
