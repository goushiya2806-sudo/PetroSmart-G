import express from "express";
import { authenticate } from "../middleware/auth.js";

import {
  getPurchaseOptions,
  getPurchases,
  getPurchase,
  createPurchase,
} from "../controllers/purchaseController.js";

const router = express.Router();

router.use(authenticate);

router.get("/options", getPurchaseOptions);

router.get("/", getPurchases);

router.get("/:id", getPurchase);

router.post("/", createPurchase);

export default router;