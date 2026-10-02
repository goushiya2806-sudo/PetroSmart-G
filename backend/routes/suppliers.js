import express from "express";

import { authenticate } from "../middleware/auth.js";

import {
  getSuppliers,
  createSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getSuppliers);

router.post("/", createSupplier);

export default router;