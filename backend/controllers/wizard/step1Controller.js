// backend/controllers/wizard/step1Controller.js
// PASTE LOCATION: backend/controllers/wizard/step1Controller.js  (replace entire file)
//
// BUG FIXED: The DB schema has a CHECK constraint on logo_url:
//   logo_url ~ '^https?://.+'
// But the frontend sends base64 data: URIs.
// Fix: strip the base64 before saving (store as NULL) until you
// set up Supabase Storage. The frontend preview still works
// because the image is held in component state — it's only the
// DB write that needed fixing.
//
// FUTURE: when you add Supabase Storage, upload the image there
// and save the returned https:// URL instead.

import pool from '../../db.js';
import { auditLog, markStepComplete } from '../../middleware/setupWizard.js';

// ── Indian states (same list as DB CHECK constraint) ─────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi',
  'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ── Input validation ──────────────────────────────────────────────
function validate(data) {
  const errors = {};

  if (!data.pump_name?.trim())
    errors.pump_name = 'Station name is required';
  else if (data.pump_name.trim().length < 2 || data.pump_name.trim().length > 100)
    errors.pump_name = 'Station name must be 2–100 characters';

  if (!data.owner_name?.trim())
    errors.owner_name = 'Owner name is required';
  else if (data.owner_name.trim().length < 2 || data.owner_name.trim().length > 100)
    errors.owner_name = 'Owner name must be 2–100 characters';

  if (!data.mobile?.trim())
    errors.mobile = 'Mobile number is required';
  else if (!/^[6-9][0-9]{9}$/.test(data.mobile.trim()))
    errors.mobile = 'Enter a valid 10-digit Indian mobile number';

  if (!data.email?.trim())
    errors.email = 'Email is required';
  else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(data.email.trim()))
    errors.email = 'Enter a valid email address';

  if (!data.full_address?.trim())
    errors.full_address = 'Address is required';
  else if (data.full_address.trim().length < 5 || data.full_address.trim().length > 500)
    errors.full_address = 'Address must be 5–500 characters';

  if (!data.city?.trim())
    errors.city = 'City is required';
  else if (data.city.trim().length < 2 || data.city.trim().length > 100)
    errors.city = 'City must be 2–100 characters';

  if (!data.state?.trim())
    errors.state = 'State is required';
  else if (!INDIAN_STATES.includes(data.state.trim()))
    errors.state = 'Select a valid Indian state';

  if (!data.pincode?.trim())
    errors.pincode = 'Pincode is required';
  else if (!/^\d{6}$/.test(data.pincode.trim()))
    errors.pincode = 'Enter a valid 6-digit pincode';

  // Optional legal fields — validate format only if provided
  if (data.gst_number?.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.gst_number.trim()))
    errors.gst_number = 'Invalid GST format (e.g. 36AABCT1332L1ZV)';

  if (data.pan?.trim() &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(data.pan.trim()))
    errors.pan = 'Invalid PAN format (e.g. ABCDE1234F)';

  if (data.tan?.trim() &&
      !/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/.test(data.tan.trim()))
    errors.tan = 'Invalid TAN format (e.g. ABCD12345E)';

  return errors;
}

// ── Detect base64 data URI ────────────────────────────────────────
function isBase64DataUri(str) {
  return typeof str === 'string' && str.startsWith('data:');
}

// ── GET /api/wizard/step1 ─────────────────────────────────────────
export async function getStep1(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM pump_details WHERE pump_id = $1`,
      [req.pump_id]
    );

    const { rows: progress } = await pool.query(
      `SELECT * FROM v_wizard_progress WHERE pump_id = $1`,
      [req.pump_id]
    );

    return res.status(200).json({
      data:     rows[0] || null,
      progress: progress[0] || null,
    });
  } catch (err) {
    console.error('getStep1 error:', err.message);
    return res.status(500).json({ error: 'Failed to load step 1 data.' });
  }
}

// ── POST /api/wizard/step1 ────────────────────────────────────────
export async function saveStep1(req, res) {
  const {
    pump_name, owner_name, mobile, email,
    full_address, city, state, pincode,
    gst_number, license_number, pan, tan,
    logo_url, logo_filename, logo_size_bytes,
  } = req.body;

  // Validate
  const errors = validate(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  // ── LOGO URL FIX ──────────────────────────────────────────────────
  // The DB CHECK constraint only allows https:// URLs.
  // If the frontend sends a base64 data: URI, strip it to NULL.
  // The image will re-show from React component state until the
  // page reloads, at which point no logo is shown (acceptable
  // until Supabase Storage is wired up).
  //
  // FUTURE UPGRADE: Upload to Supabase Storage first, then save
  // the returned https:// URL here instead of stripping it.
  let safe_logo_url      = null;
  let safe_logo_filename = null;
  let safe_logo_size     = null;

  if (logo_url && !isBase64DataUri(logo_url)) {
    // It's already an https:// URL (from Supabase Storage) — safe to save
    safe_logo_url      = logo_url;
    safe_logo_filename = logo_filename || null;
    safe_logo_size     = logo_size_bytes || null;
  } else if (logo_url && isBase64DataUri(logo_url)) {
    // Base64 — save filename/size as metadata, but strip the data URI
    // so the DB constraint doesn't reject the row
    safe_logo_filename = logo_filename || null;
    safe_logo_size     = logo_size_bytes || null;
    // logo_url stays NULL in DB until Storage is implemented
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO pump_details (
        pump_id, pump_name, owner_name, mobile, email,
        full_address, city, state, pincode,
        gst_number, license_number, pan, tan,
        logo_url, logo_filename, logo_size_bytes,
        is_complete, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, TRUE, now())
       ON CONFLICT (pump_id) DO UPDATE SET
        pump_name       = EXCLUDED.pump_name,
        owner_name      = EXCLUDED.owner_name,
        mobile          = EXCLUDED.mobile,
        email           = EXCLUDED.email,
        full_address    = EXCLUDED.full_address,
        city            = EXCLUDED.city,
        state           = EXCLUDED.state,
        pincode         = EXCLUDED.pincode,
        gst_number      = EXCLUDED.gst_number,
        license_number  = EXCLUDED.license_number,
        pan             = EXCLUDED.pan,
        tan             = EXCLUDED.tan,
        logo_url        = EXCLUDED.logo_url,
        logo_filename   = EXCLUDED.logo_filename,
        logo_size_bytes = EXCLUDED.logo_size_bytes,
        is_complete     = TRUE,
        completed_at    = COALESCE(pump_details.completed_at, now()),
        updated_at      = now()
       RETURNING *`,
      [
        req.pump_id,
        pump_name.trim(), owner_name.trim(),
        mobile.trim(), email.trim().toLowerCase(),
        full_address.trim(), city.trim(), state.trim(), pincode.trim(),
        gst_number?.trim().toUpperCase() || null,
        license_number?.trim()           || null,
        pan?.trim().toUpperCase()        || null,
        tan?.trim().toUpperCase()        || null,
        safe_logo_url, safe_logo_filename, safe_logo_size,
      ]
    );

    // Keep pumps.name in sync
    await client.query(
      `UPDATE pumps SET name = $1, updated_at = now() WHERE id = $2`,
      [pump_name.trim(), req.pump_id]
    );

    await markStepComplete(client, req.pump_id, 1);

    await auditLog(client, {
      user_id: req.user.id,
      pump_id: req.pump_id,
      action:  'wizard_step1_saved',
      meta:    { pump_name: pump_name.trim(), has_logo: !!safe_logo_url },
    });

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Step 1 saved successfully.',
      data:    rows[0],
      // Tell frontend if logo was stored in DB or only in state
      logo_saved_to_db: !!safe_logo_url,
      logo_note: isBase64DataUri(logo_url)
        ? 'Logo preview is in your browser. Upload to Supabase Storage to persist it.'
        : undefined,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('saveStep1 error:', err.message, err.detail || '');

    // Surface DB constraint violations clearly
    if (err.code === '23514') {
      return res.status(400).json({
        error: `Data validation failed: ${err.constraint || err.message}`,
      });
    }
    if (err.constraint) {
      return res.status(400).json({ error: `Constraint violation: ${err.constraint}` });
    }
    return res.status(500).json({ error: 'Failed to save step 1. Please try again.' });
  } finally {
    client.release();
  }
}