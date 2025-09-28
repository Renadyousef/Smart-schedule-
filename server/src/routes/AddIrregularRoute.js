import { Router } from "express";
import { addIrregularStudent, getStudentName } from "../controllers/IrregularStudentsController.js";

const router = Router();

// لو عندك توكن/صلاحيات للـ registrar، أضف ميدلوير هنا
router.get("/students/:id", getStudentName);
router.post("/irregular", addIrregularStudent);

export default router;
