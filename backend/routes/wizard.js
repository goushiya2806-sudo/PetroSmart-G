// routes/wizard.js
// All Setup Wizard API routes
// All routes require: authenticate → requireOwner → attachWizardContext

import express from 'express';
import rateLimit from 'express-rate-limit';

import { authenticate }       from '../middleware/auth.js';
import { requireOwner, attachWizardContext } from '../middleware/setupWizard.js';

import { getProgress }        from '../controllers/wizard/progressController.js';
import { getStep1, saveStep1 } from '../controllers/wizard/step1Controller.js';
import { getStep2, saveStep2 } from '../controllers/wizard/step2Controller.js';
import { getStep3, saveStep3 } from '../controllers/wizard/step3Controller.js';
import { getStep4, saveStep4 } from '../controllers/wizard/step4Controller.js';
import { getStep5, saveStep5 } from '../controllers/wizard/step5Controller.js';

const router = express.Router();

// Rate limiter: max 30 saves per 10 minutes per IP
const wizardLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
});

// ── Apply auth + owner check + wizard context to ALL routes ───────
router.use(authenticate, requireOwner, attachWizardContext);

// ── Progress ──────────────────────────────────────────────────────
// GET /api/wizard/progress
router.get('/progress', getProgress);

// ── Step 1: Basic Details ─────────────────────────────────────────
// GET  /api/wizard/step1  → load existing data
// POST /api/wizard/step1  → save & continue
router.get('/step1',         getStep1);
router.post('/step1', wizardLimiter, saveStep1);

// ── Step 2: Fuel Types ────────────────────────────────────────────
router.get('/step2',         getStep2);
router.post('/step2', wizardLimiter, saveStep2);

// ── Step 3: Tanks ─────────────────────────────────────────────────
router.get('/step3',         getStep3);
router.post('/step3', wizardLimiter, saveStep3);

// ── Step 4: Dispensing Pumps & Nozzles ───────────────────────────
router.get('/step4',         getStep4);
router.post('/step4', wizardLimiter, saveStep4);

// ── Step 5: Operational Settings ─────────────────────────────────
router.get('/step5',         getStep5);
router.post('/step5', wizardLimiter, saveStep5);

export default router;