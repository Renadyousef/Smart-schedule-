
import { Router } from "express";
import {
  listIrregularStudents,
  getIrregularStudentById,
  getIrregularStudentMe,
} from "../controllers/Irregular.Student.Controller.js";

const router = Router();

router.get("/", /* auth? */ listIrregularStudents); // ضعها قبل :studentId
router.get("/:studentId", getIrregularStudentById);
router.get("/me", /* auth? */ getIrregularStudentMe);

export default router;