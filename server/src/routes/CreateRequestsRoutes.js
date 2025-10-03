// server/src/routes/CreateRequestsRoutes.js
import express from "express";
import {
  createRequest,
  getRequests,
  getRequestById,
} from "../controllers/CreateRequestsController.js";

const router = express.Router();

// Mounted at /createRequests by your app.
router.post("/requests", createRequest);
router.get("/requests", getRequests);
router.get("/requests/:id", getRequestById);

export default router;
