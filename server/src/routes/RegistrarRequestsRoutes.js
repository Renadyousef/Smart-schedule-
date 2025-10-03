// server/routes/RegistrarRequestsRoutes.js
import { Router } from "express";
import {
  listRegistrarRequests,
  getRegistrarRequest,
  respondForStudent,
  updateRegistrarRequestStatus,
} from "../controllers/RegistrarRequestsController.js";

const router = Router();

router.get("/requests", listRegistrarRequests);
router.get("/requests/:id", getRegistrarRequest);
router.post("/requests/:id/students/:crStudentId/respond", respondForStudent);
router.post("/requests/:id/status", updateRegistrarRequestStatus);

export default router;
