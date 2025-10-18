import pkg from 'pg'; // ES module import for pg
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  host: "db.rezcixrdprtvpfkvbaxw.supabase.co", // ensure host
  port: 5432,
  family: 4, // force IPv4
});

export default pool; // <--- default export
