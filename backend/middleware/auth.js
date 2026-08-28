import jwt from 'jsonwebtoken';
import pool from '../db.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate session is still active in DB
    const { rows } = await pool.query(
      `SELECT id, user_id, pump_id, role_id, revoked, expires_at
       FROM sessions WHERE jti = $1`,
      [decoded.jti]
    );

    if (!rows.length || rows[0].revoked) {
      return res.status(401).json({ error: 'Session revoked or invalid' });
    }

    if (new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = {
      id: decoded.sub,
      jti: decoded.jti,
      pump_id: decoded.pump_id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}