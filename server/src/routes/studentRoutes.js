// server/routes/studentRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const student = require("../controllers/studentController");

router.get("/students/me/preferences", verifyToken, requireRole("student"), student.getMyPreferences);
router.put("/students/me/preferences", verifyToken, requireRole("student"), student.putMyPreferences);
router.post("/schedule/suggest", verifyToken, requireRole("student"), student.getSuggestion);

module.exports = router;
