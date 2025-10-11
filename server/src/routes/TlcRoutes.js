import express from "express";
import { verifyToken } from "../middleware/verfiyToken.js";
import {getSchedulesByLevel,getSchedulesByCourse} from '../controllers/FetchSchdulesTlc.js'
import {fetchCourses} from '../controllers/fetchAllCources.js'
import {approveSchedule} from '../controllers/ApproveSchudleController.js'
const router = express.Router();
//to get them on display
//fetch all cources first and display them by name
router.get('/cources',fetchCourses)
//i need to only fetch the sgared schudle is that by status?
router.get("/level", getSchedulesByLevel);
router.get("/course", getSchedulesByCourse);
router.patch("/approve/:scheduleId", verifyToken, approveSchedule);
export default router;