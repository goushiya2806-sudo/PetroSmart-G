

import pool from '../../db.js';
import { auditLog, markStepComplete } from '../../middleware/setupWizard.js';

// ── VALIDATION ─────────────────────────────────────────
function validateFuel(fuel, index) {
  const errors = {};
  const p = `fuels[${index}]`;

  if (!fuel.fuel_name?.trim())
    errors[`${p}.fuel_name`] = 'Fuel name is required';

  if (!fuel.short_code?.trim())
    errors[`${p}.short_code`] = 'Short code is required';
  else if (!/^[A-Z0-9]{1,5}$/.test(fuel.short_code.toUpperCase()))
    errors[`${p}.short_code`] = 'Invalid short code';

  if (!fuel.unit || !['litre', 'kg'].includes(fuel.unit))
    errors[`${p}.unit`] = 'Invalid unit';

  if (!fuel.current_price || parseFloat(fuel.current_price) <= 0)
    errors[`${p}.current_price`] = 'Invalid price';

  if (fuel.opening_stock < 0)
    errors[`${p}.opening_stock`] = 'Invalid stock';

  return errors;
}

// ── GET STEP 2 ─────────────────────────────────────────
export async function getStep2(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM fuel_types
       WHERE pump_id = $1 AND deleted_at IS NULL
       ORDER BY display_order ASC`,
      [req.pump_id]
    );

    return res.json({ data: rows });
  } catch (err) {
    console.error("❌ getStep2 error:", err);
    return res.status(500).json({ error: 'Failed to load fuel types' });
  }
}

// ── SAVE STEP 2 (FINAL FIXED VERSION) ──────────────────
export async function saveStep2(req, res) {
  const { fuels } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── GET EXISTING FUELS ─────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, short_code FROM fuel_types WHERE pump_id = $1`,
      [req.pump_id]
    );

    const existingMap = new Map();
    existing.forEach(f => existingMap.set(f.short_code, f.id));

    const incomingCodes = fuels.map(f => f.short_code.toUpperCase());

    // ── UPDATE OR INSERT ───────────────────────
    for (let i = 0; i < fuels.length; i++) {
      const f = fuels[i];
      const code = f.short_code.toUpperCase();
   if (existingMap.has(code)) {
  const fuelId = existingMap.get(code);

  // 🔥 GET OLD PRICE
  const { rows: oldFuel } = await client.query(
    `SELECT current_price FROM fuel_types WHERE id = $1`,
    [fuelId]
  );

  const oldPrice = oldFuel[0]?.current_price;

  // 🔥 UPDATE fuel_types
  await client.query(
    `UPDATE fuel_types
     SET fuel_name = $1,
         unit = $2,
         current_price = $3,
         opening_stock = $4,
         current_stock = $5,
         display_order = $6,
         updated_at = now()
     WHERE id = $7`,
    [
      f.fuel_name,
      f.unit,
      parseFloat(f.current_price),
      parseFloat(f.opening_stock || 0),
      parseFloat(f.opening_stock || 0),
      i + 1,
      fuelId
    ]
  );

  // 🔥 INSERT INTO HISTORY (VERY IMPORTANT)
  if (oldPrice !== parseFloat(f.current_price)) {
    await client.query(
      `INSERT INTO fuel_price_history (
        fuel_type_id,
        pump_id,
        old_price,
        new_price,
        changed_by,
        reason
      )
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        fuelId,
        req.pump_id,
        oldPrice,
        parseFloat(f.current_price),
        req.user.id,
        'price_revision'
      ]
    );
  }
} else {
        // INSERT new
        await client.query(
          `INSERT INTO fuel_types (
            pump_id, fuel_name, short_code, unit,
            current_price, opening_stock, current_stock, display_order
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            req.pump_id,
            f.fuel_name,
            code,
            f.unit,
            parseFloat(f.current_price),
            parseFloat(f.opening_stock || 0),
            parseFloat(f.opening_stock || 0),
            i + 1
          ]
        );
      }
    }

    // ── SOFT DELETE REMOVED FUELS ──────────────
    for (const old of existing) {
      if (!incomingCodes.includes(old.short_code)) {
        await client.query(
          `UPDATE fuel_types
           SET deleted_at = now(), is_active = false
           WHERE id = $1`,
          [old.id]
        );
      }
    }

    // ── MARK STEP 2 COMPLETE ───────────────────
    await markStepComplete(client, req.pump_id, 2);

    await client.query('COMMIT');

    return res.json({ message: "Fuel types updated successfully" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ FINAL ERROR:", err);

    return res.status(500).json({
      error: "Failed to save fuel types",
      detail: err.message
    });
  } finally {
    client.release();
  }
}