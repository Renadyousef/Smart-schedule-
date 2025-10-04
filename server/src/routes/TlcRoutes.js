import express from "express";
import { verifyToken } from "../middleware/verfiyToken.js";
import {getSchedulesByLevel,getSchedulesByCourse} from '../controllers/FetchSchdulesTlc.js'
import {fetchCourses} from '../controllers/fetchAllCources.js'
const router = express.Router();
//to get them on display
//fetch all cources first and display them by name
router.get('/cources',fetchCourses)
router.get("/level", getSchedulesByLevel);
router.get("/course", getSchedulesByCourse);
export default router;