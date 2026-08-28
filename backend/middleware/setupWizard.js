// backend/middleware/setupWizard.js
// PASTE LOCATION: backend/middleware/setupWizard.js  (replace entire file)
//
// BUG FIXED: removed `setup_wizard_done` from the pumps SELECT.
// That column lives on `users`, not `pumps`. Selecting it caused
// a PostgreSQL error on EVERY wizard request → the wizard could
// never load or save anything (showed "Failed to save" always).

import pool from '../db.js';

// ── requireOwner ──────────────────────────────────────────────────
export function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json({
      error: 'Only pump owners can access the setup wizard.',
      code:  'NOT_OWNER',
    });
  }
  next();
}

// ── attachWizardContext ───────────────────────────────────────────
export async function attachWizardContext(req, res, next) {
  try {
    const owner_id = req.user.id;

    // ✅ FIX: `setup_wizard_done` removed — it belongs to `users`,
    //    not `pumps`. Selecting a non-existent column causes the
    //    entire wizard middleware to crash with a 500.
    const { rows: pumps } = await pool.query(
      `SELECT id, name, owner_id
       FROM pumps
       WHERE owner_id = $1
         AND is_active = TRUE
       LIMIT 1`,
      [owner_id]
    );

    if (!pumps.length) {
      // Auto-create pump for this owner on first wizard visit
      const { rows: newPump } = await pool.query(
        `INSERT INTO pumps (name, owner_id)
         VALUES ($1, $2)
         RETURNING id, name, owner_id`,
        ['My Petrol Station', owner_id]
      );

      const pump_id = newPump[0].id;

      await pool.query(
        `INSERT INTO setup_wizard_progress (pump_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (pump_id) DO NOTHING`,
        [pump_id, owner_id]
      );

      req.pump_id = pump_id;
      req.wizard  = { wizard_complete: false, current_step: 1 };
      return next();
    }

    req.pump_id = pumps[0].id;

    const { rows: progress } = await pool.query(
      `SELECT * FROM setup_wizard_progress WHERE pump_id = $1`,
      [req.pump_id]
    );

    if (!progress.length) {
      await pool.query(
        `INSERT INTO setup_wizard_progress (pump_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (pump_id) DO NOTHING`,
        [req.pump_id, owner_id]
      );
      req.wizard = { wizard_complete: false, current_step: 1 };
    } else {
      req.wizard = progress[0];
    }

    next();
  } catch (err) {
    console.error('attachWizardContext error:', err.message, err.stack);
    return res.status(500).json({
      error:  'Failed to load wizard context.',
      detail: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

// ── auditLog helper ───────────────────────────────────────────────
export async function auditLog(client, { user_id, pump_id, action, status = 'success', meta }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, pump_id, action, status, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [user_id, pump_id || null, action, status, meta ? JSON.stringify(meta) : null]
  );
}

// ── markStepComplete helper ───────────────────────────────────────
export async function markStepComplete(client, pump_id, step) {
  const col       = `step${step}_complete`;
  const next_step = step + 1 <= 5 ? step + 1 : 5;

  await client.query(
    `UPDATE setup_wizard_progress
     SET ${col}       = TRUE,
         current_step = GREATEST(current_step, $1),
         updated_at   = now()
     WHERE pump_id = $2`,
    [next_step, pump_id]
  );
}