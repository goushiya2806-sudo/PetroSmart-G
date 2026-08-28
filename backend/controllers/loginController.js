import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';


const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function auditLog(client, { user_id, pump_id, action, status = 'success', meta, ip, ua }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, pump_id, action, status, meta, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [user_id, pump_id || null, action, status, meta ? JSON.stringify(meta) : null, ip, ua]
  );
}

function mintToken(user_id, jti, pump_id, role, rememberMe) {
  const expiresIn = rememberMe ? '365d' : '12h';
  return jwt.sign(
    { sub: user_id, jti, pump_id, role },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

// ─── POST /api/auth/login ────────────────────────────────────────────────────
export async function login(req, res) {
  const { identifier, password, remember_me = false } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find user by email OR username
    const isEmail = identifier.includes('@');
    const { rows } = await client.query(
      `SELECT id, full_name, email, username, password_hash, is_verified,
              failed_login_count, locked_until, created_by, setup_wizard_done
       FROM users
       WHERE ${isEmail ? 'email' : 'username'} = $1
         AND deleted_at IS NULL`,
      [identifier.toLowerCase()]
    );

    // Log attempt
    const user = rows[0] || null;

    if (!user) {
      await auditLog(client, { action: 'login_failed', status: 'failure', meta: { reason: 'user_not_found', identifier }, ip, ua });
      await client.query('COMMIT');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      await auditLog(client, { user_id: user.id, action: 'login_failed', status: 'failure', meta: { reason: 'account_locked' }, ip, ua });

      // Log to login_attempts
      await client.query(
        `INSERT INTO login_attempts (user_id, ip_address, success, failure_reason)
         VALUES ($1, $2, FALSE, 'account_locked')`,
        [user.id, ip]
      );

      await client.query('COMMIT');
      return res.status(423).json({
        error: `Account locked. Try again in ${remaining} minute${remaining === 1 ? '' : 's'}.`,
        code: 'ACCOUNT_LOCKED',
        locked_until: user.locked_until,
      });
    }

    // Check verification
    if (!user.is_verified) {
      await client.query('COMMIT');
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        code: 'UNVERIFIED',
        user_id: user.id,
      });
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      const newCount = user.failed_login_count + 1;
      const locked = newCount >= LOCKOUT_ATTEMPTS;
      const lockedUntil = locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null;

      await client.query(
        `UPDATE users SET failed_login_count=$1, locked_until=$2, updated_at=now() WHERE id=$3`,
        [locked ? 0 : newCount, lockedUntil, user.id]
      );

      await client.query(
        `INSERT INTO login_attempts (user_id, ip_address, success, failure_reason)
         VALUES ($1, $2, FALSE, 'wrong_password')`,
        [user.id, ip]
      );

      await auditLog(client, { user_id: user.id, action: 'login_failed', status: 'failure', meta: { reason: 'wrong_password', attempt: newCount }, ip, ua });

      if (locked) {
        await auditLog(client, { user_id: user.id, action: 'login_locked', ip, ua });
        await client.query('COMMIT');
        return res.status(423).json({
          error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
      }

      await client.query('COMMIT');
      const remaining = LOCKOUT_ATTEMPTS - newCount;
      return res.status(401).json({
        error: `Wrong password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
        code: 'WRONG_PASSWORD',
        remaining,
      });
    }

    // ── Password correct → reset failed count ──────────────────────────────
    await client.query(
      `UPDATE users SET failed_login_count=0, locked_until=NULL, updated_at=now() WHERE id=$1`,
      [user.id]
    );

    await client.query(
      `INSERT INTO login_attempts (user_id, ip_address, success) VALUES ($1, $2, TRUE)`,
      [user.id, ip]
    );

    // ── Check created_by: NULL = owner, UUID = staff ───────────────────────
    const isOwner = user.created_by === null;

    if (isOwner) {
      // Check setup wizard
      if (!user.setup_wizard_done) {
        // Get or create pump for this owner
        const { rows: pumps } = await client.query(
          `SELECT id FROM pumps WHERE owner_id = $1 LIMIT 1`, [user.id]
        );

        const pumpId = pumps[0]?.id || null;

        // Mint token without pump (setup not done)
        const jti = uuidv4();
        const expiresAt = new Date(Date.now() + (remember_me ? 365 * 86400000 : 12 * 3600000));

        await client.query(
          `INSERT INTO sessions (user_id, pump_id, jti, expires_at, remember_me, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, pumpId, jti, expiresAt, remember_me, ip, ua]
        );

        const token = mintToken(user.id, jti, pumpId, 'owner', remember_me);
        await auditLog(client, { user_id: user.id, action: 'login_success', meta: { redirect: 'setup_wizard' }, ip, ua });
        await client.query('COMMIT');

        return res.status(200).json({
          token,
          redirect: 'setup_wizard',
          user: { id: user.id, full_name: user.full_name, email: user.email, role: 'owner' },
        });
      }

      // Owner with setup done → check pumps
      const { rows: pumps } = await client.query(
        `SELECT p.id, p.name, upr.role_id, r.name as role_name
         FROM pumps p
         JOIN user_pump_roles upr ON upr.pump_id = p.id AND upr.user_id = $1
         JOIN roles r ON r.id = upr.role_id
         WHERE p.owner_id = $1 AND p.is_active = TRUE AND upr.is_active = TRUE`,
        [user.id]
      );

      if (pumps.length === 1) {
        // Single pump → go straight in
        return await issueSession(client, user, pumps[0].id, pumps[0].role_id, pumps[0].role_name, remember_me, ip, ua, res);
      }

      // Multiple pumps → pump selection required
      await auditLog(client, { user_id: user.id, action: 'login_success', meta: { redirect: 'pump_selection' }, ip, ua });
      await client.query('COMMIT');
      return res.status(200).json({
        redirect: 'pump_selection',
        pumps,
        user: { id: user.id, full_name: user.full_name, email: user.email, role: 'owner' },
        temp_token: jwt.sign({ sub: user.id, phase: 'pump_select' }, process.env.JWT_SECRET, { expiresIn: '10m' }),
      });

    } else {
      // ── Staff / admin user ─────────────────────────────────────────────
      const { rows: assignments } = await client.query(
        `SELECT upr.pump_id, p.name as pump_name, upr.role_id, r.name as role_name
         FROM user_pump_roles upr
         JOIN pumps p ON p.id = upr.pump_id
         JOIN roles r ON r.id = upr.role_id
         WHERE upr.user_id = $1 AND upr.is_active = TRUE AND p.is_active = TRUE`,
        [user.id]
      );

      if (!assignments.length) {
        await client.query('COMMIT');
        return res.status(403).json({ error: 'No active pump assignments. Contact your administrator.' });
      }

      if (assignments.length === 1) {
        return await issueSession(client, user, assignments[0].pump_id, assignments[0].role_id, assignments[0].role_name, remember_me, ip, ua, res);
      }

      await auditLog(client, { user_id: user.id, action: 'login_success', meta: { redirect: 'pump_selection' }, ip, ua });
      await client.query('COMMIT');
      return res.status(200).json({
        redirect: 'pump_selection',
        pumps: assignments,
        user: { id: user.id, full_name: user.full_name, email: user.email },
        temp_token: jwt.sign({ sub: user.id, phase: 'pump_select' }, process.env.JWT_SECRET, { expiresIn: '10m' }),
      });
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  } finally {
    client.release();
  }
}

// ─── POST /api/auth/select-pump ──────────────────────────────────────────────
export async function selectPump(req, res) {
  const { temp_token, pump_id, remember_me = false } = req.body;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  try {
    const decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
    if (decoded.phase !== 'pump_select') {
      return res.status(401).json({ error: 'Invalid token phase' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT u.id, u.full_name, u.email, upr.role_id, r.name as role_name
         FROM users u
         JOIN user_pump_roles upr ON upr.user_id = u.id AND upr.pump_id = $1
         JOIN roles r ON r.id = upr.role_id
         WHERE u.id = $2 AND upr.is_active = TRUE`,
        [pump_id, decoded.sub]
      );

      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No access to this pump' });
      }

      const user = rows[0];
      return await issueSession(client, user, pump_id, user.role_id, user.role_name, remember_me, ip, ua, res);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Select pump error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
export async function logout(req, res) {
  const { jti } = req.user;
  await pool.query(
    `UPDATE sessions SET revoked=TRUE, revoked_at=now(), revoked_reason='logout' WHERE jti=$1`,
    [jti]
  );
  return res.status(200).json({ message: 'Logged out successfully' });
}

// ─── Internal: issue a full session + token ──────────────────────────────────
async function issueSession(client, user, pump_id, role_id, role_name, rememberMe, ip, ua, res) {
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + (rememberMe ? 365 * 86400000 : 12 * 3600000));

  await client.query(
    `INSERT INTO sessions (user_id, pump_id, role_id, jti, expires_at, remember_me, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [user.id, pump_id, role_id, jti, expiresAt, rememberMe, ip, ua]
  );

  const token = mintToken(user.id, jti, pump_id, role_name, rememberMe);
  await client.query(
    `INSERT INTO audit_logs (user_id, pump_id, action, status, ip_address, user_agent)
     VALUES ($1, $2, 'login_success', 'success', $3, $4)`,
    [user.id, pump_id, ip, ua]
  );

  await client.query('COMMIT');

  return res.status(200).json({
    token,
    redirect: 'dashboard',
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: role_name,
      pump_id,
    },
  });
}