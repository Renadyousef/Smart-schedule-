import pkg from 'pg'; // ES module import for pg
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:Ela@911911@db.rezcixrdprtvpfkvbaxw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }, // needed for Supabase
});

export default pool;
