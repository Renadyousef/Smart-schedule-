import express from "express";
import { fetch_rules } from "../controllers/ManageRules/FetchRulesController.js";

const router = express.Router();
//to get them on display
router.get('/display',fetch_rules)




export default router;