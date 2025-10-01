// server/routes/RegistrarRequestsRoutes.js
import { Router } from "express";
import {
  listRegistrarRequests,
  getRegistrarRequest,
  respondForStudent,
} from "../controllers/RegistrarRequestsController.js";

const router = Router();

// List all committee requests visible to registrar (filters optional)
router.get("/requests", listRegistrarRequests);

// Single request + student lines
router.get("/requests/:id", getRegistrarRequest);

// Respond for a specific student line
router.post("/requests/:id/students/:crStudentId/respond", respondForStudent);

export default router;
