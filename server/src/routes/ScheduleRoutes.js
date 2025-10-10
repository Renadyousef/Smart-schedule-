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
  createManualSlot,
  updateScheduleSlot,
  removeScheduleSlot,
  approveSchedule,
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

router.post("/slots", requireAuth, createManualSlot);
router.patch("/slots/:slotId", requireAuth, updateScheduleSlot);
router.delete("/slots/:slotId", requireAuth, removeScheduleSlot);

router.post("/share/:scheduleId", requireAuth, shareSchedule);
router.post("/approve/:scheduleId", requireAuth, approveSchedule);
router.get("/list", listSchedules); 

export default router;