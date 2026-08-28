import bcrypt from 'bcrypt';
import pool from '../db.js';
import { generateOTP, sendOTPEmail } from '../utils/email.js';

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_RESENDS = 5;

async function auditLog(client, { user_id, action, status = 'success', meta, ip, ua }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, status, meta, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, action, status, meta ? JSON.stringify(meta) : null, ip, ua]
  );
}

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
export async function forgotPassword(req, res) {
  const { email } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, full_name, email, is_verified, otp_resend_count, otp_window_start
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (!rows.length || !rows[0].is_verified) {
      await client.query('COMMIT');
      return res.status(200).json({ message: 'If this email exists, a reset code has been sent.' });
    }

    const user = rows[0];

    // Rate limit check
    const windowStart = user.otp_window_start ? new Date(user.otp_window_start) : null;
    const hourAgo = new Date(Date.now() - 3600000);
    let resendCount = user.otp_resend_count || 0;

    if (windowStart && windowStart > hourAgo && resendCount >= OTP_MAX_RESENDS) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many requests. Try again in an hour.', code: 'RESEND_LIMIT' });
    }

    if (!windowStart || windowStart <= hourAgo) {
      resendCount = 0;
    }

    const otp = generateOTP();
    const otp_hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const otp_expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

    await client.query(
      `UPDATE users SET
         otp_hash=$1, otp_type='password_reset', otp_expires_at=$2,
         otp_attempts=0, otp_resend_count=$3,
         otp_window_start=CASE WHEN $4 THEN now() ELSE otp_window_start END,
         updated_at=now()
       WHERE id=$5`,
      [otp_hash, otp_expires_at, resendCount + 1, !windowStart || windowStart <= hourAgo, user.id]
    );

    await sendOTPEmail(user.email, user.full_name, otp, 'password_reset');
    await auditLog(client, { user_id: user.id, action: 'otp_sent', meta: { type: 'password_reset' }, ip, ua });

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Reset code sent to your email.', user_id: user.id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
}

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
export async function resetPassword(req, res) {
  const { user_id, otp, new_password } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (!user_id || !otp || !new_password) {
    return res.status(400).json({ error: 'user_id, otp and new_password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, otp_hash, otp_type, otp_expires_at, otp_attempts FROM users WHERE id=$1 AND deleted_at IS NULL`,
      [user_id]
    );

    if (!rows.length || rows[0].otp_type !== 'password_reset') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No password reset OTP pending.' });
    }

    const user = rows[0];

    if (new Date(user.otp_expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'OTP has expired.', code: 'OTP_EXPIRED' });
    }

    if (user.otp_attempts >= 5) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many wrong attempts. Request a new code.', code: 'OTP_BLOCKED' });
    }

    const valid = await bcrypt.compare(otp, user.otp_hash);
    if (!valid) {
      await client.query(`UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=$1`, [user_id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'Wrong OTP.', code: 'WRONG_OTP' });
    }

    // Check password history (last 5)
    const { rows: history } = await client.query(
      `SELECT password_hash FROM password_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
      [user_id]
    );

    for (const h of history) {
      const reused = await bcrypt.compare(new_password, h.password_hash);
      if (reused) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot reuse one of your last 5 passwords.', code: 'PASSWORD_REUSED' });
      }
    }

    const new_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

    // Store old password in history
    const { rows: currentPw } = await client.query(`SELECT password_hash FROM users WHERE id=$1`, [user_id]);
    await client.query(
      `INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)`,
      [user_id, currentPw[0].password_hash]
    );

    // Update password, clear OTP, revoke all sessions
    await client.query(
      `UPDATE users SET password_hash=$1, otp_hash=NULL, otp_type=NULL,
       otp_expires_at=NULL, otp_attempts=0, otp_resend_count=0,
       otp_window_start=NULL, failed_login_count=0, locked_until=NULL, updated_at=now()
       WHERE id=$2`,
      [new_hash, user_id]
    );

    // Revoke all active sessions
    await client.query(
      `UPDATE sessions SET revoked=TRUE, revoked_at=now(), revoked_reason='password_reset'
       WHERE user_id=$1 AND revoked=FALSE`,
      [user_id]
    );

    await auditLog(client, { user_id, action: 'password_reset', ip, ua });
    await client.query('COMMIT');

    return res.status(200).json({ message: 'Password reset successfully. Please log in.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
}