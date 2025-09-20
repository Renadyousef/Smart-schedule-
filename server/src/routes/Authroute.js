import express from "express";
import { signup } from "../controllers/Authcontrollers/signup.js"; // use .js and named import
import { signin } from "../controllers/Authcontrollers/signin.js";

const router = express.Router();

// Define route
router.post("/signup", signup);
router.post("/signin", signin);
export default router;
