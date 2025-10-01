import { Router } from "express";
import {
  initSchedule,
  addExternalSlot,
  listExternalSlots,
  autoListAndPrepareInternal,
  generatePreliminarySchedule,
  listAllSlotsForGrid,
  shareSchedule,
   listSchedules,
} from "../controllers/scheduleController.js";
import { verifyToken as requireAuth } from "../middleware/verfiyToken.js";

const router = Router();

// 🔹 Add this FIRST
router.post("/init", requireAuth, initSchedule);

// Existing endpoints
router.post("/core-courses/slots", requireAuth, addExternalSlot);
router.get("/core-courses/slots/:scheduleId", requireAuth, listExternalSlots);

router.get("/internal-courses/auto/:scheduleId", requireAuth, autoListAndPrepareInternal);

router.post("/generate/:scheduleId", requireAuth, generatePreliminarySchedule);
router.get("/grid/:scheduleId", requireAuth, listAllSlotsForGrid);

router.post("/share/:scheduleId", requireAuth, shareSchedule);
router.get("/list", listSchedules); 

export default router;