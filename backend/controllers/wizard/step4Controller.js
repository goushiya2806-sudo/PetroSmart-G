// controllers/wizard/step4Controller.js
// FIX: Before soft-deleting dispensing_pumps and nozzles,
// NULL OUT the unique columns so re-inserts work cleanly.
// dispensing_pumps: UNIQUE(pump_id, pump_number), UNIQUE(pump_id, pump_machine_name)
// nozzles:          UNIQUE(dispensing_pump_id, nozzle_number)

import pool from '../../db.js';
import { auditLog, markStepComplete } from '../../middleware/setupWizard.js';

function validateNozzle(nozzle, pumpIdx, nozzleIdx) {
  const errors = {};
  const p = `pumps[${pumpIdx}].nozzles[${nozzleIdx}]`;
  if (!nozzle.fuel_type_id) errors[`${p}.fuel_type_id`] = 'Fuel type is required for each nozzle';
  if (!nozzle.tank_id)       errors[`${p}.tank_id`]      = 'Source tank is required for each nozzle';
  return errors;
}

function validatePump(pump, index) {
  const errors = {};
  const p = `pumps[${index}]`;

  if (!pump.pump_machine_name?.trim())
    errors[`${p}.pump_machine_name`] = 'Pump name is required';
  else if (pump.pump_machine_name.trim().length < 2 || pump.pump_machine_name.trim().length > 50)
    errors[`${p}.pump_machine_name`] = 'Pump name must be 2–50 characters';

  const nozzleCount = parseInt(pump.nozzle_count);
  if (isNaN(nozzleCount) || nozzleCount < 1 || nozzleCount > 4)
    errors[`${p}.nozzle_count`] = 'Each pump must have 1–4 nozzles';

  if (!Array.isArray(pump.nozzles) || pump.nozzles.length === 0) {
    errors[`${p}.nozzles`] = 'Nozzle configuration is required';
  } else if (pump.nozzles.length !== nozzleCount) {
    errors[`${p}.nozzles`] = `Configure exactly ${nozzleCount} nozzle(s)`;
  } else {
    pump.nozzles.forEach((n, ni) => Object.assign(errors, validateNozzle(n, index, ni)));
  }

  return errors;
}

// ── GET /api/wizard/step4 ─────────────────────────────────────────
export async function getStep4(req, res) {
  try {
    const { rows: pumps } = await pool.query(
      `SELECT dp.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id',            n.id,
               'nozzle_number', n.nozzle_number,
               'nozzle_label',  n.nozzle_label,
               'fuel_type_id',  n.fuel_type_id,
               'tank_id',       n.tank_id,
               'fuel_name',     ft.fuel_name,
               'short_code',    ft.short_code,
               'tank_name',     t.tank_name
             ) ORDER BY n.nozzle_number
           ) FILTER (WHERE n.id IS NOT NULL),
           '[]'::json
         ) AS nozzles
       FROM dispensing_pumps dp
       LEFT JOIN nozzles n     ON n.dispensing_pump_id = dp.id AND n.deleted_at IS NULL
       LEFT JOIN fuel_types ft ON ft.id = n.fuel_type_id
       LEFT JOIN tanks t       ON t.id  = n.tank_id
       WHERE dp.pump_id = $1 AND dp.deleted_at IS NULL
       GROUP BY dp.id
       ORDER BY dp.pump_number ASC`,
      [req.pump_id]
    );

    const { rows: fuels } = await pool.query(
      `SELECT id, fuel_name, short_code, unit
       FROM fuel_types
       WHERE pump_id = $1 AND is_active = TRUE AND deleted_at IS NULL
       ORDER BY display_order ASC`,
      [req.pump_id]
    );

    const { rows: tanks } = await pool.query(
      `SELECT t.id, t.tank_name, t.tank_number, t.fuel_type_id,
              t.capacity_litres, t.current_stock,
              ft.fuel_name, ft.short_code
       FROM tanks t
       JOIN fuel_types ft ON ft.id = t.fuel_type_id
       WHERE t.pump_id = $1 AND t.is_active = TRUE AND t.deleted_at IS NULL
       ORDER BY t.tank_number ASC`,
      [req.pump_id]
    );

    const { rows: progress } = await pool.query(
      `SELECT * FROM v_wizard_progress WHERE pump_id = $1`,
      [req.pump_id]
    );

    return res.status(200).json({ data: pumps, fuels, tanks, progress: progress[0] || null });
  } catch (err) {
    console.error('getStep4 error:', err);
    return res.status(500).json({ error: 'Failed to load pump/nozzle data.' });
  }
}

// ── POST /api/wizard/step4 ────────────────────────────────────────
export async function saveStep4(req, res) {
  const { pumps } = req.body;

  if (!Array.isArray(pumps) || pumps.length === 0)
    return res.status(400).json({ error: 'At least one dispensing pump is required.' });

  let allErrors = {};
  pumps.forEach((pump, i) => Object.assign(allErrors, validatePump(pump, i)));
  if (Object.keys(allErrors).length > 0)
    return res.status(400).json({ errors: allErrors });

  const machineNames = pumps.map(p => p.pump_machine_name.trim().toLowerCase());
  if (new Set(machineNames).size !== machineNames.length)
    return res.status(400).json({ error: 'Duplicate pump machine names are not allowed.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate fuel_type_ids and tank_ids
    const { rows: validFuels } = await client.query(
      `SELECT id FROM fuel_types WHERE pump_id = $1 AND deleted_at IS NULL`, [req.pump_id]
    );
    const { rows: validTanks } = await client.query(
      `SELECT id, fuel_type_id FROM tanks WHERE pump_id = $1 AND deleted_at IS NULL`, [req.pump_id]
    );

    const validFuelIds = new Set(validFuels.map(f => f.id));
    const validTankMap = new Map(validTanks.map(t => [t.id, t.fuel_type_id]));

    for (let pi = 0; pi < pumps.length; pi++) {
      for (let ni = 0; ni < pumps[pi].nozzles.length; ni++) {
        const nz = pumps[pi].nozzles[ni];
        if (!validFuelIds.has(nz.fuel_type_id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Pump ${pi+1}, Nozzle ${ni+1}: fuel type not found. Go back to Step 2.` });
        }
        if (!validTankMap.has(nz.tank_id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Pump ${pi+1}, Nozzle ${ni+1}: tank not found. Go back to Step 3.` });
        }
        if (validTankMap.get(nz.tank_id) !== nz.fuel_type_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Pump ${pi+1}, Nozzle ${ni+1}: nozzle fuel must match the tank's fuel type.` });
        }
      }
    }

    // ── FIX: NULL OUT unique columns on nozzles FIRST ──────────────
    await client.query(
      `UPDATE nozzles
       SET nozzle_number       = NULL,
           dispensing_pump_id  = NULL,
           deleted_at          = now(),
           deleted_by          = $1,
           is_active           = FALSE,
           updated_at          = now()
       WHERE pump_id = $2 AND deleted_at IS NULL`,
      [req.user.id, req.pump_id]
    );

    // ── FIX: NULL OUT unique columns on dispensing_pumps ───────────
    await client.query(
      `UPDATE dispensing_pumps
       SET pump_machine_name = NULL,
           pump_number       = NULL,
           deleted_at        = now(),
           deleted_by        = $1,
           is_active         = FALSE,
           updated_at        = now()
       WHERE pump_id = $2 AND deleted_at IS NULL`,
      [req.user.id, req.pump_id]
    );

    // Insert dispensing pumps + nozzles
    const insertedPumps = [];
    for (let pi = 0; pi < pumps.length; pi++) {
      const pm = pumps[pi];

      const { rows: dpRows } = await client.query(
        `INSERT INTO dispensing_pumps (
           pump_id, pump_machine_name, serial_number, pump_number, nozzle_count, is_active
         ) VALUES ($1,$2,$3,$4,$5,TRUE)
         RETURNING *`,
        [req.pump_id, pm.pump_machine_name.trim(), pm.serial_number?.trim() || null, pi + 1, parseInt(pm.nozzle_count)]
      );

      const dp = dpRows[0];
      const insertedNozzles = [];

      for (let ni = 0; ni < pm.nozzles.length; ni++) {
        const nz = pm.nozzles[ni];
        const { rows: nzRows } = await client.query(
          `INSERT INTO nozzles (
             pump_id, dispensing_pump_id, tank_id, fuel_type_id,
             nozzle_number, nozzle_label, opening_reading, current_reading, is_active
           ) VALUES ($1,$2,$3,$4,$5,$6,0,0,TRUE)
           RETURNING *`,
          [req.pump_id, dp.id, nz.tank_id, nz.fuel_type_id, ni + 1, `NOZ ${String(ni+1).padStart(2,'0')}`]
        );
        insertedNozzles.push(nzRows[0]);
      }

      insertedPumps.push({ ...dp, nozzles: insertedNozzles });
    }

    await markStepComplete(client, req.pump_id, 4);

    await auditLog(client, {
      user_id: req.user.id, pump_id: req.pump_id,
      action: 'wizard_step4_saved',
      meta: { pump_count: pumps.length, nozzle_count: pumps.reduce((s, p) => s + p.nozzles.length, 0) },
    });

    await client.query('COMMIT');

    return res.status(200).json({
      message: `${pumps.length} pump(s) and nozzles saved successfully.`,
      data: insertedPumps,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('saveStep4 error:', err.message, err.detail || '');
    if (err.code === '23505')
      return res.status(400).json({ error: 'Duplicate pump name or nozzle number. Please refresh and try again.' });
    return res.status(500).json({ error: 'Failed to save pumps and nozzles.' });
  } finally {
    client.release();
  }
}