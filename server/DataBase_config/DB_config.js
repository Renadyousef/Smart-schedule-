import pkg from 'pg'; // ES module import for pg
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

export default pool; // keep default export
