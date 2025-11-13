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

    // Criar tabela de tracking de uso do Resea (créditos)
    // Nota: words_consumed_today agora conta DOCUMENTOS (não palavras)
    await query(`
      CREATE TABLE IF NOT EXISTS resea_usage (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        words_consumed_today INTEGER DEFAULT 0,
        smileai_remaining_words INTEGER DEFAULT 0,
        plan_name VARCHAR(50) DEFAULT 'básico',
        plan_purchase_date TIMESTAMP DEFAULT NOW(),
        last_reset_date TIMESTAMP DEFAULT NOW(),
        last_smileai_sync TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log('✅ Tabela "resea_usage" criada/verificada');

    // Adicionar novos campos em resea_usage se não existirem
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='resea_usage' AND column_name='plan_name') THEN
          ALTER TABLE resea_usage ADD COLUMN plan_name VARCHAR(50) DEFAULT 'básico';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='resea_usage' AND column_name='plan_purchase_date') THEN
          ALTER TABLE resea_usage ADD COLUMN plan_purchase_date TIMESTAMP DEFAULT NOW();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='resea_usage' AND column_name='last_reset_date') THEN
          ALTER TABLE resea_usage ADD COLUMN last_reset_date TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;
    `);
    console.log('✅ Campos de plano adicionados à tabela resea_usage');

    // Criar tabela de histórico de créditos
    await query(`
      CREATE TABLE IF NOT EXISTS credit_history (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_id INT REFERENCES generated_documents(id) ON DELETE SET NULL,
        words_used INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "credit_history" criada/verificada');

    // Criar índices para performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_resea_usage_user_id
      ON resea_usage(user_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_credit_history_user_id
      ON credit_history(user_id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_credit_history_created_at
      ON credit_history(created_at DESC);
    `);
    console.log('✅ Índices de créditos criados');

    // Adicionar campos de storage S3/R2 na tabela generated_documents (se não existirem)
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='generated_documents' AND column_name='s3_key') THEN
          ALTER TABLE generated_documents ADD COLUMN s3_key VARCHAR(500);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='generated_documents' AND column_name='s3_url') THEN
          ALTER TABLE generated_documents ADD COLUMN s3_url TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='generated_documents' AND column_name='file_format') THEN
          ALTER TABLE generated_documents ADD COLUMN file_format VARCHAR(20) DEFAULT 'html';
        END IF;
      END $$;
    `);
    console.log('✅ Campos de storage R2 adicionados à tabela generated_documents');

    console.log('✨ Banco de dados inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}
