// backend/db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase requires SSL
  ssl: {
    rejectUnauthorized: false,
  },

  // Pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});

// Prevent process crash on idle client error
pool.on("error", (err) => {
  console.error("❌ Database pool error:", err.message);
});

// Test database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to Supabase PostgreSQL");
    client.release();
  } catch (err) {
    console.error("❌ Failed to connect to Supabase:");
    console.error(err.message);
  }
})();

export default pool;