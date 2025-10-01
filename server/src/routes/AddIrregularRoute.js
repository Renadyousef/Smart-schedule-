import express from "express";
import {
  getStudentName,
  addIrregularStudent,
  searchStudentsByName,
} from "../controllers/IrregularStudentsController.js";

const router = express.Router();

// النهايات (بعد mount في app.js):
// GET  /irregular/students/search
// GET  /irregular/students/:id
// POST /irregular
router.get("/students/search", searchStudentsByName);
router.get("/students/:id", getStudentName);
router.post("/", addIrregularStudent);

export default router;
