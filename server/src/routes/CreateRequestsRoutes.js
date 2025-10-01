// server/src/routes/CreateRequestsRoutes.js
import { Router } from "express";
import {
  createRequest,
  getRequests,
  getRequestById,
} from "../controllers/CreateRequestsController.js";

const router = Router();

// POST /createRequests/requests
router.post("/requests", createRequest);

// GET /createRequests/requests?status=pending&committeeId=...&registrarId=...
router.get("/requests", getRequests);

// GET /createRequests/requests/:id
router.get("/requests/:id", getRequestById);

export default router;
