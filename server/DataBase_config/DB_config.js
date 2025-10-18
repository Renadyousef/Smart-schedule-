import pkg from 'pg'; // ES module import for pg
const { Pool } = pkg;
import 'dotenv/config';

// Use the single DATABASE_URL for Session Pooler
const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default pool; // keep default export
