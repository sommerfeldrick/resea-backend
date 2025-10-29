import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[Database Error]', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const initDatabase = async () => {
  try {
    const result = await query('SELECT NOW()');
    console.log('[✓] Database connected:', result.rows[0]);
    
    // Criar tabelas
    await createTables();
  } catch (error) {
    console.error('[✗] Database connection failed:', error);
    process.exit(1);
  }
};

const createTables = async () => {
  try {
    // Tabela de usuários
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        credits INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de documentos gerados
    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50), -- 'research', 'essay', 'summary', etc
        template_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'completed', -- 'processing', 'completed', 'failed'
        sources JSONB, -- Array de fontes usadas
        metadata JSONB, -- Dados extras
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id),
        INDEX (created_at)
      );
    `);

    // Tabela de buscas
    await query(`
      CREATE TABLE IF NOT EXISTS searches (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query VARCHAR(500) NOT NULL,
        results_count INT,
        execution_time INT, -- em ms
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id),
        INDEX (created_at)
      );
    `);

    console.log('[✓] Database tables initialized');
  } catch (error) {
    console.error('[✗] Error creating tables:', error);
    throw error;
  }
};

export default pool;
