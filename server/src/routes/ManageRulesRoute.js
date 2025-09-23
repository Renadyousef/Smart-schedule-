import express from "express";
import { fetch_rules } from "../controllers/ManageRules/FetchRulesController.js";
import {add_rule} from '../controllers/ManageRules/AddRuleController.js'


const router = express.Router();
//to get them on display
router.get('/display',fetch_rules)

//add rule
router.post('/add',add_rule)



export default router;