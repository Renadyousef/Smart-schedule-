import express from "express";
import { signup } from "../controllers/Authcontrollers/signup.js"; // use .js and named import
import { signin } from "../controllers/Authcontrollers/signin.js";
import { checkEmail } from "../controllers/Authcontrollers/checkEmail.js"; // ✅ أضفنا هذا السطر

const router = express.Router();

// ✅ تحقق من الإيميل قبل التسجيل
router.post("/check-email", checkEmail);

// ✅ التسجيل
router.post("/signup", signup);

// ✅ تسجيل الدخول
router.post("/signin", signin);

export default router;