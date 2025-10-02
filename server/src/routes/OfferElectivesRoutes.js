import express from "express";
import { view_electives } from "../controllers/ViewElectives.js";
import { verifyToken } from "../middleware/verfiyToken.js";
import { submit_electives } from "../controllers/SubmitElectivestoSC.js";
const router = express.Router();
//to get them on display
router.get('/view',verifyToken,view_electives)
//submit electives
router.post('/submit',verifyToken,submit_electives)
export default router;