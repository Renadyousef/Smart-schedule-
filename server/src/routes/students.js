// routes/students.js
import express from "express";
import { getStudent, updatePreferences, getPreferencesHistory } from "../controllers/students.js";

const router = express.Router();

router.get("/:id", getStudent);
router.get("/:id/preferences/history", getPreferencesHistory); // NEW
router.put("/:id/preferences", updatePreferences);

export default router;
