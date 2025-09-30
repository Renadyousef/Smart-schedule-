// routes/ProfileRoute.js
import express from "express";
import { fetch_profile } from "../controllers/Profile/FetchProfileController.js";
import { update_profile } from "../controllers/Profile/UpdateProfileController.js";

const router = express.Router();

// جلب بيانات البروفايل
router.get("/profile/:id", fetch_profile);

// تحديث بيانات البروفايل
router.put("/profile/:id", update_profile);

export default router;
