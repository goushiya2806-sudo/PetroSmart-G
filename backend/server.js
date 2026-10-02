// backend/server.js
// PASTE LOCATION: backend/server.js  (replace entire file)
// REQUIRES: npm install helmet
import express   from 'express';
import cors      from 'cors';
import helmet    from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv    from 'dotenv';

import authRoutes   from './routes/auth.js';
import wizardRoutes from './routes/wizard.js';
import purchaseRoutes from "./routes/purchases.js";
import supplierRoutes from './routes/suppliers.js';


dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Trust proxy (needed for rate-limiter behind nginx / Render) ──
app.set('trust proxy', 1);

// ── Helmet: security headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────
const ALLOWED = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());

app.use(cors({
  origin(origin, cb) {
    if (!origin && process.env.NODE_ENV !== 'production') return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Global rate limiter ───────────────────────────────────────────
app.use(rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// ── Body parsing ──────────────────────────────────────────────────
// 10mb allows base64 logo images during wizard setup.
// Reduce to 100kb once you move logos to Supabase Storage.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────

app.use('/api/auth',   authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request too large. Keep images under 7 MB.' });
  if (err.message?.startsWith('CORS'))
    return res.status(403).json({ error: err.message });
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  PetroSmart backend → http://localhost:${PORT}`);
  console.log(`    Mode: ${process.env.NODE_ENV || 'development'}`);
});