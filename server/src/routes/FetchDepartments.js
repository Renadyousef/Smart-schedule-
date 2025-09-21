import express from "express";
import { fetchDepartments } from "../controllers/fetchDepartments.js";

const router = express.Router();

router.get('/',fetchDepartments)

export default router;