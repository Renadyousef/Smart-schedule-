// server/routes/RegistrarRequestsRoutes.js
import { Router } from "express";
import {
  listRegistrarRequests,
  getRegistrarRequest,
  respondForStudent,
  offerElectivesFromRequest,
  updateRegistrarRequestStatus,
} from "../controllers/RegistrarRequestsController.js";

const router = Router();

// List all committee requests visible to registrar (filters optional)
router.get("/requests", listRegistrarRequests);

// Single request + student lines + electives (if any)
router.get("/requests/:id", getRegistrarRequest);

// Respond for a specific student line (DataRequest, or line-level "Offer Elective")
router.post("/requests/:id/students/:crStudentId/respond", respondForStudent);

// NEW: Offer all electives attached to the request and mark the request fulfilled
router.post("/requests/:id/offer-electives", offerElectivesFromRequest);

// NEW: Approve/Reject/Pending the request (header-level)
router.post("/requests/:id/status", updateRegistrarRequestStatus);

export default router;
