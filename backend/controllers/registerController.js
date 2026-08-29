import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { generateOTP, sendOTPEmail } from '../utils/email.js';

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 5;
const UNVERIFIED_WINDOW_HOURS = 24;

// ─── Helper: log audit event ───────────────────────────────────────────────
async function auditLog(client, { user_id, action, status = 'success', meta, ip, ua }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, status, meta, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, action, status, meta ? JSON.stringify(meta) : null, ip, ua]
  );
}

// ─── POST /api/auth/register ────────────────────────────────────────────────
export async function register(req, res) {
  const { full_name, email, username, password } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  // Basic validation
  if (!full_name || !email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[a-zA-Z0-9]+$/.test(password) === false) {
    // Allow any chars but enforce min length above
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email exists
    const { rows: existing } = await client.query(
      `SELECT id, is_verified, created_at, username, otp_window_start, otp_resend_count
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (existing.length > 0) {
      const user = existing[0];

      // Already verified → duplicate
      if (user.is_verified) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Unverified & within 24hrs → handle re-registration cases
      const createdAt = new Date(user.created_at);
      const hoursSince = (Date.now() - createdAt) / 36e5;

      if (hoursSince < UNVERIFIED_WINDOW_HOURS) {
        // Same email + same username → just resend OTP
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return await resendOTPInternal(client, user.id, email, full_name, ip, ua, res, 'same_user');
        }

        // Same email + new username → update username + resend OTP
        const { rows: uCheck } = await client.query(
          `SELECT id FROM users WHERE username = $1 AND id != $2`, [username, user.id]
        );
        if (uCheck.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Username is already taken' });
        }

        // Same email + new password → update password + resend OTP
        const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const otp = generateOTP();
        const otp_hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
        const otp_expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

        await client.query(
          `UPDATE users SET username=$1, password_hash=$2,
           otp_hash=$3, otp_type='registration', otp_expires_at=$4,
           otp_attempts=0, otp_resend_count=otp_resend_count+1,
           otp_window_start=COALESCE(otp_window_start, now()),
           updated_at=now()
           WHERE id=$5`,
          [username, password_hash, otp_hash, otp_expires_at, user.id]
        );

        console.log("Reached sendOTPEmail()");
await sendOTPEmail(email, full_name, otp, "registration");
console.log("Returned from sendOTPEmail()");
        await auditLog(client, { user_id: user.id, action: 'otp_sent', meta: { reason: 'reregister_update' }, ip, ua });
        await client.query('COMMIT');
        return res.status(200).json({ message: 'OTP resent. Check your email.', user_id: user.id });
      }

      // Outside 24hrs → account would have been deleted by cron; treat as new
    }

    // Check username uniqueness
    const { rows: uExists } = await client.query(
      `SELECT id FROM users WHERE username = $1`, [username]
    );
    if (uExists.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username is already taken' });
    }

    // Hash password & OTP
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp = generateOTP();
    const otp_hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const otp_expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    // Create user
    const { rows: newUser } = await client.query(
  `INSERT INTO users
   (full_name, email, username, password_hash, otp_hash, otp_type, otp_expires_at,
    otp_resend_count, otp_window_start, created_by)
   VALUES ($1, $2, $3, $4, $5, 'registration', $6, 1, now(), NULL)
   RETURNING id`,
  [full_name, email.toLowerCase(), username, password_hash, otp_hash, otp_expires_at]
);

    const user_id = newUser[0].id;

    await sendOTPEmail(email, full_name, otp, 'registration');
    await auditLog(client, { user_id, action: 'register', ip, ua });
    await auditLog(client, { user_id, action: 'otp_sent', ip, ua });

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Registration started. Check your email for OTP.', user_id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  } finally {
    client.release();
  }
}

// ─── POST /api/auth/verify-otp ──────────────────────────────────────────────
export async function verifyOTP(req, res) {
  const { user_id, otp } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (!user_id || !otp) {
    return res.status(400).json({ error: 'user_id and otp are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, full_name, email, otp_hash, otp_type, otp_expires_at, otp_attempts, is_verified
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [user_id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];

    if (user.is_verified && user.otp_type === 'registration') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Account already verified' });
    }

    if (!user.otp_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No OTP pending. Please request a new one.' });
    }

    // Check expiry
    if (new Date(user.otp_expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.', code: 'OTP_EXPIRED' });
    }

    // Check attempts
    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.', code: 'OTP_BLOCKED' });
    }

    // Verify OTP
    const valid = await bcrypt.compare(otp, user.otp_hash);

    if (!valid) {
      await client.query(
        `UPDATE users SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE id = $1`,
        [user_id]
      );
      await auditLog(client, { user_id, action: 'otp_failed', status: 'failure', ip, ua });
      await client.query('COMMIT');

      const remaining = OTP_MAX_ATTEMPTS - (user.otp_attempts + 1);
      return res.status(400).json({
        error: remaining > 0
          ? `Wrong OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many wrong attempts. Please request a new OTP.',
        code: 'WRONG_OTP',
        remaining,
      });
    }

    // OTP valid → clear OTP fields
    await client.query(
      `UPDATE users SET
         is_verified = TRUE,
         verified_at = now(),
         otp_hash = NULL,
         otp_type = NULL,
         otp_expires_at = NULL,
         otp_attempts = 0,
         otp_resend_count = 0,
         otp_window_start = NULL,
         updated_at = now()
       WHERE id = $1`,
      [user_id]
    );

    await auditLog(client, { user_id, action: 'otp_verified', ip, ua });
    await auditLog(client, { user_id, action: 'register', status: 'success', meta: { completed: true }, ip, ua });

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Email verified! Account created successfully.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
}

// ─── POST /api/auth/resend-otp ──────────────────────────────────────────────
export async function resendOTP(req, res) {
  const { user_id } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, full_name, email, otp_type, otp_resend_count, otp_window_start, is_verified
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [user_id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const result = await resendOTPInternal(client, user.id, user.email, user.full_name, ip, ua, res, 'resend');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resend OTP error:', err);
    return res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
}

// ─── Internal resend helper ─────────────────────────────────────────────────
async function resendOTPInternal(client, user_id, email, full_name, ip, ua, res, reason) {
  const { rows } = await client.query(
    `SELECT otp_type, otp_resend_count, otp_window_start FROM users WHERE id = $1`,
    [user_id]
  );
  const user = rows[0];

  // Check resend rate limit (5 per hour)
  const windowStart = user.otp_window_start ? new Date(user.otp_window_start) : null;
  const hourAgo = new Date(Date.now() - 3600000);

  let resendCount = user.otp_resend_count || 0;
  if (windowStart && windowStart > hourAgo) {
    if (resendCount >= OTP_MAX_RESENDS) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many OTP requests. Try again in an hour.', code: 'RESEND_LIMIT' });
    }
  } else {
    // Reset window
    resendCount = 0;
    await client.query(
      `UPDATE users SET otp_window_start = now(), otp_resend_count = 0 WHERE id = $1`, [user_id]
    );
  }

  const otp = generateOTP();
  const otp_hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const otp_expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

  await client.query(
    `UPDATE users SET otp_hash=$1, otp_expires_at=$2, otp_attempts=0,
     otp_resend_count=otp_resend_count+1, updated_at=now() WHERE id=$3`,
    [otp_hash, otp_expires_at, user_id]
  );

  await sendOTPEmail(email, full_name, otp, user.otp_type || 'registration');
  await auditLog(client, { user_id, action: 'otp_sent', meta: { reason }, ip, ua });
  await client.query('COMMIT');

  return res.status(200).json({ message: 'New OTP sent to your email.' });
}