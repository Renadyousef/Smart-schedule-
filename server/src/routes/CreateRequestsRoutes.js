import express from "express";
import {
  createRequest,
  getRequests,
  getRequestById,
} from "../controllers/CreateRequestsController.js";

const router = express.Router();

// IMPORTANT: do NOT prefix with /createRequests here.
// The app mounts this router at /createRequests.
router.post("/requests", createRequest);
router.get("/requests", getRequests);
router.get("/requests/:id", getRequestById);

export default router;
