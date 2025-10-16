import pkg from 'pg'; // ES module import for pg
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Supabase
});

export default pool;
