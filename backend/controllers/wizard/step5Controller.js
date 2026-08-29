import pool from '../../db.js';
import bcrypt from 'bcrypt';
import { markStepComplete } from '../../middleware/setupWizard.js';
export async function getStep5(req, res) {
  try {
    // 🧾 get operation settings
    const { rows: settings } = await pool.query(
      `SELECT * FROM operation_settings WHERE pump_id = $1`,
      [req.pump_id]
    );

    // 🕒 get shifts
    const { rows: shifts } = await pool.query(
      `SELECT * FROM shifts
       WHERE pump_id = $1 AND deleted_at IS NULL
       ORDER BY shift_order ASC`,
      [req.pump_id]
    );

    // 👥 get users (staff)
    const { rows: users } = await pool.query(
      `SELECT u.id, u.full_name, u.username, r.name AS role
       FROM users u
       JOIN user_pump_roles upr ON upr.user_id = u.id
       JOIN roles r ON r.id = upr.role_id
       WHERE upr.pump_id = $1 AND upr.is_active = TRUE`,
      [req.pump_id]
    );

    return res.json({
      data: {
        operation_settings: settings[0] || null,
        shifts,
        users
      }
    });

  } catch (err) {
    console.error("getStep5 error:", err);
    return res.status(500).json({ error: "Failed to load Step 5" });
  }
}

export async function saveStep5(req, res) {
  const {
    operation_mode,
    payment_modes,
    omc_name,
    dealer_code,
    shifts = [],
    custom_roles = [],
    rbac_enabled = false,
    users = []   // ✅ NEW
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────
    // 1. SAVE OPERATION SETTINGS (EXISTING)
    // ─────────────────────────────────────────
    await client.query(
      `INSERT INTO operation_settings (pump_id, operation_mode, omc_name, dealer_code, payment_modes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (pump_id) DO UPDATE SET
         operation_mode = EXCLUDED.operation_mode,
         omc_name = EXCLUDED.omc_name,
         dealer_code = EXCLUDED.dealer_code,
         payment_modes = EXCLUDED.payment_modes,
         updated_at = now()`,
      [
        req.pump_id,
        operation_mode,
        omc_name || null,
        dealer_code || null,
        payment_modes
      ]
    );

    // ─────────────────────────────────────────
    // 2. ENABLE RBAC
    // ─────────────────────────────────────────
    await client.query(
      `UPDATE pumps SET rbac_enabled = $1 WHERE id = $2`,
      [rbac_enabled, req.pump_id]
    );

    // ─────────────────────────────────────────
    // 3. SAVE SHIFTS
    // ─────────────────────────────────────────
    await client.query(
      `UPDATE shifts
       SET deleted_at = now()
       WHERE pump_id = $1 AND deleted_at IS NULL`,
      [req.pump_id]
    );

    for (let i = 0; i < shifts.length; i++) {
      const s = shifts[i];

      await client.query(
        `INSERT INTO shifts (pump_id, shift_name, start_time, end_time, shift_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          req.pump_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          i + 1
        ]
      );
    }

    // ─────────────────────────────────────────
    // 4. CREATE STAFF USERS (MAIN FEATURE)
    // ─────────────────────────────────────────
    for (const u of users) {

      if (!u.username || !u.password || !u.role) continue;

      // 🔐 HASH PASSWORD
      const hashed = await bcrypt.hash(u.password, 10);

      // 👤 CREATE USER
      const { rows } = await client.query(
        `INSERT INTO users (
          full_name,
          email,
          username,
          password_hash,
          created_by,
          is_verified
        )
        VALUES ($1,$2,$3,$4,$5,TRUE)
        RETURNING id`,
        [
          u.full_name || u.username,
          `${u.username}@temp.local`, // required by DB
          u.username.toLowerCase(),
          hashed,
          req.user.id
        ]
      );

      const userId = rows[0].id;

      // 🎭 GET ROLE
      const { rows: roleRows } = await client.query(
        `SELECT id FROM roles WHERE name = $1`,
        [u.role.toLowerCase()]
      );

      if (!roleRows.length) continue;

      const roleId = roleRows[0].id;

      // 🔗 MAP USER TO PUMP
      await client.query(
        `INSERT INTO user_pump_roles (
          user_id,
          pump_id,
          role_id,
          assigned_by
        )
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id, pump_id) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          updated_at = now()`,
        [
          userId,
          req.pump_id,
          roleId,
          req.user.id
        ]
      );
    }

    // ─────────────────────────────────────────
    // 4b. ENSURE OWNER HAS A ROLE ON THEIR OWN PUMP
    // ─────────────────────────────────────────
    // Without this, req.pump_id exists (created in attachWizardContext)
    // but the owner has no row in user_pump_roles — so login's
    // JOIN against user_pump_roles returns 0 rows and the owner
    // gets locked out with "No active pump is assigned to this account."
    const { rows: ownerRoleRows } = await client.query(
      `SELECT id FROM roles WHERE name = 'owner'`
    );

    if (ownerRoleRows.length) {
      await client.query(
        `INSERT INTO user_pump_roles (user_id, pump_id, role_id, assigned_by, is_active)
         VALUES ($1, $2, $3, $1, TRUE)
         ON CONFLICT (user_id, pump_id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           is_active = TRUE,
           updated_at = now()`,
        [req.user.id, req.pump_id, ownerRoleRows[0].id]
      );
    } else {
      console.error(`STEP 5: no 'owner' role found in roles table — owner ${req.user.id} not linked to pump ${req.pump_id}`);
    }

    // ─────────────────────────────────────────
    // 4c. MARK WIZARD DONE ON THE USER
    // ─────────────────────────────────────────
    // Nothing else in the codebase sets this — without it, login
    // always redirects back to setup_wizard even after Step 5.
    await client.query(
      `UPDATE users SET setup_wizard_done = TRUE, updated_at = now() WHERE id = $1`,
      [req.user.id]
    );

    // ─────────────────────────────────────────
    // 5. MARK STEP COMPLETE
    // ─────────────────────────────────────────
    await markStepComplete(client, req.pump_id, 5);

    await client.query('COMMIT');

    return res.json({
      message: "Step 5 saved successfully (RBAC enabled)"
    });
    // ─────────────────────────────────────────
// 6. MARK OWNER'S SETUP WIZARD AS COMPLETE
// ─────────────────────────────────────────
await client.query(
  `UPDATE users SET setup_wizard_done = TRUE, updated_at = now() WHERE id = $1`,
  [req.user.id]
);

await markStepComplete(client, req.pump_id, 5);
await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');

    console.error("STEP 5 ERROR:", err);

    return res.status(500).json({
      error: "Failed to save Step 5",
      detail: err.message
    });


  } finally {
    client.release();
  }
}