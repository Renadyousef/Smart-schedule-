import express from "express";
import { verifyToken } from "../middleware/verfiyToken.js";
import {getSchedulesByLevel,getSchedulesByCourse} from '../controllers/FetchSchdulesTlc.js'
import {fetchCourses} from '../controllers/fetchAllCources.js'
import {approveSchedule} from '../controllers/ApproveSchudleController.js'
import {submitFeedback} from '../controllers/feedbackfromTLC.js'
const router = express.Router();

//fetch all cources first and display them by name
router.get('/cources',fetchCourses)

router.get("/level", getSchedulesByLevel);
router.get("/course", getSchedulesByCourse);
router.patch("/approve/:scheduleId", verifyToken, approveSchedule);
router.post('/feedback',verifyToken,submitFeedback)
export default router;