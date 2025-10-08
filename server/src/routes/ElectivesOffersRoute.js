import express from "express";
import { fetch_offers,handel_offers } from "../controllers/Electives_on_SC_end/FetchOffersControllers.js";
//for the SC end
const router = express.Router();
//1.offers/view
router.get('/view',fetch_offers)

//2.handel offers
router.put('/approve/:id',handel_offers)
export default router;