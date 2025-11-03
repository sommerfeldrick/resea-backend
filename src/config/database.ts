import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

let pool: any = null;

// Only create pool if DATABASE_URL is provided
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // 30s timeout para conexões cloud (Render)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('[Database Pool Error]', err);
  });
}

export const query = async (text: string, params?: any[]) => {
  if (!pool) {
    console.warn('⚠️  Database not configured - query ignored');
    return { rows: [] };
  }
  return pool.query(text, params);
};

export const getClient = async () => {
  if (!pool) {
    throw new Error('Database not configured');
  }
  return pool.connect();
};

export const isConnected = () => !!pool;

export { pool };
export default pool;
