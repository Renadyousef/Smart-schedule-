import express from "express";
import { view_electives } from "../controllers/ViewElectives.js";
import { verifyToken } from "../middleware/verfiyToken.js";
const router = express.Router();
//to get them on display
router.get('/view',verifyToken,view_electives)


export default router;