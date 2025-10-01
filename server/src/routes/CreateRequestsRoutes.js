// server/routes/CreateRequestsRoutes.js
import { Router } from "express";
import { createRequest, getRequests, getRequestById } from "../controllers/CreateRequestsController.js";

const router = Router();
router.get("/requests", getRequests);
router.post("/requests", createRequest);
router.get("/requests/:id", getRequestById);
export default router;
