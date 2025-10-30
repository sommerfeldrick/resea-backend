import { query } from '../config/database.js';

export async function initializeDatabase() {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not configured - skipping database initialization');
      console.log('   Server will use in-memory cache only');
      return false;
    }

    console.log('📚 Initializing PostgreSQL database...');

    // Criar tabela de usuários
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        oauth_id VARCHAR(255) UNIQUE,
        credits INT DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "users" criada/verificada');

    // Criar tabela de documentos gerados
    await query(`
      CREATE TABLE IF NOT EXISTS generated_documents (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        document_type VARCHAR(100),
        template_id VARCHAR(255),
        research_query TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        word_count INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "generated_documents" criada/verificada');

    // Criar índices para melhor performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id 
      ON generated_documents(user_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_created_at 
      ON generated_documents(created_at DESC);
    `);
    console.log('✅ Índices criados');

    // Criar tabela de histórico de buscas
    await query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        results_count INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "search_history" criada/verificada');

    // Criar índice para histórico
    await query(`
      CREATE INDEX IF NOT EXISTS idx_search_user_created 
      ON search_history(user_id, created_at DESC);
    `);

    console.log('✨ Banco de dados inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}
