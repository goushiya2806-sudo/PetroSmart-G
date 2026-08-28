// controllers/wizard/step3Controller.js

import pool from '../../db.js';
import { auditLog, markStepComplete } from '../../middleware/setupWizard.js';

// ── GET STEP 3 (FIXED) ─────────────────────────────────────────
export async function getStep3(req, res) {
  try {
    // ✅ GET TANKS
    const { rows: tanks } = await pool.query(
      `SELECT * FROM tanks
       WHERE pump_id = $1 AND deleted_at IS NULL
       ORDER BY tank_number ASC`,
      [req.pump_id]
    );

    // ✅ 🔥 ADD THIS (VERY IMPORTANT)
    const { rows: fuels } = await pool.query(
      `SELECT id, fuel_name, short_code
       FROM fuel_types
       WHERE pump_id = $1 AND deleted_at IS NULL
       ORDER BY display_order ASC NULLS LAST`,
      [req.pump_id]
    );

    // ✅ RETURN BOTH (MANDATORY FORMAT)
    return res.json({
      data: tanks,
      fuels: fuels
    });

  } catch (err) {
    console.error("❌ getStep3 error:", err);
    return res.status(500).json({ error: "Failed to load tanks" });
  }
}

// ── SAVE STEP 3 (UNCHANGED - ALREADY GOOD) ──────────────────
export async function saveStep3(req, res) {
  const { tanks } = req.body;

  if (!Array.isArray(tanks) || tanks.length === 0) {
    return res.status(400).json({ error: "At least one tank is required" });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── GET EXISTING TANKS ───────────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, tank_number FROM tanks WHERE pump_id = $1`,
      [req.pump_id]
    );

    const existingMap = new Map();
    existing.forEach(t => existingMap.set(t.tank_number, t.id));

    const incomingNumbers = tanks.map((_, i) => i + 1);

    // ── INSERT OR UPDATE ─────────────────────────────
    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i];

      const tankName = t.tank_name?.trim() || `Tank ${i + 1}`;
      const tankNumber = i + 1;

      if (existingMap.has(tankNumber)) {
        // UPDATE
        await client.query(
          `UPDATE tanks
           SET fuel_type_id = $1,
               tank_name = $2,
               shape = $3,
               capacity_litres = $4,
               opening_stock = $5,
               current_stock = $6,
               min_stock_alert = $7,
               updated_at = now()
           WHERE id = $8`,
          [
            t.fuel_type_id,
            tankName,
            t.shape,
            parseFloat(t.capacity_litres),
            parseFloat(t.opening_stock || 0),
            parseFloat(t.opening_stock || 0),
            parseFloat(t.min_stock_alert || 0),
            existingMap.get(tankNumber)
          ]
        );
      } else {
        // INSERT
        await client.query(
          `INSERT INTO tanks (
            pump_id,
            fuel_type_id,
            tank_name,
            tank_number,
            shape,
            capacity_litres,
            opening_stock,
            current_stock,
            min_stock_alert
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            req.pump_id,
            t.fuel_type_id,
            tankName,
            tankNumber,
            t.shape,
            parseFloat(t.capacity_litres),
            parseFloat(t.opening_stock || 0),
            parseFloat(t.opening_stock || 0),
            parseFloat(t.min_stock_alert || 0)
          ]
        );
      }
    }

    // ── SOFT DELETE REMOVED TANKS ────────────────────
    for (const old of existing) {
      if (!incomingNumbers.includes(old.tank_number)) {
        await client.query(
          `UPDATE tanks
           SET deleted_at = now()
           WHERE id = $1`,
          [old.id]
        );
      }
    }

    await markStepComplete(client, req.pump_id, 3);

    await client.query('COMMIT');

    return res.json({ message: "Tanks saved successfully" });

  } catch (err) {
    await client.query('ROLLBACK');

    console.error("❌ SAVE STEP 3 ERROR:", err);

    return res.status(500).json({
      error: "Failed to save tanks",
      detail: err.message
    });

  } finally {
    client.release();
  }
}