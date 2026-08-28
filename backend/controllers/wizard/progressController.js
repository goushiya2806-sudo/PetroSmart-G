// controllers/wizard/progressController.js
// GET /api/wizard/progress — returns full wizard progress for the UI progress bar

import pool from '../../db.js';

export async function getProgress(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM v_wizard_progress WHERE pump_id = $1`,
      [req.pump_id]
    );

    if (!rows.length) {
      return res.status(200).json({
        progress_pct:   0,
        steps_completed: 0,
        total_steps:    5,
        current_step:   1,
        wizard_complete: false,
        step1_complete: false,
        step2_complete: false,
        step3_complete: false,
        step4_complete: false,
        step5_complete: false,
        next_step:      1,
      });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error('getProgress error:', err);
    return res.status(500).json({ error: 'Failed to load wizard progress.' });
  }
}