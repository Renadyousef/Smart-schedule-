// routes/courses.js
import express from "express";
import { fetchElectiveCourses } from "../controllers/fetchElectiveCourses.js";

const router = express.Router();

// جلب المواد Elective
router.get("/", fetchElectiveCourses);

export default router;
