/**
 * Postgres Service
 * Relational database for metadata, sessions, and article content
 * Stores research sessions and structured article content
 */

import { Pool, PoolClient } from 'pg';
import type { EnrichedArticle } from '../../types/article.types.js';
import type { StructuredContent } from '../../types/content.types.js';
import { Logger } from '../../utils/simple-logger.js';

export class PostgresService {
  private pool: Pool;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PostgresService');

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      this.logger.error('DATABASE_URL environment variable not set');
      throw new Error('DATABASE_URL is required for PostgresService');
    }

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // 30s timeout para conexões cloud (Render)
    });

    this.logger.info('Postgres client initialized');
    this.initialize();
  }

  /**
   * Initialize database tables
   */
  private async initialize(): Promise<void> {
    try {
      await this.createTables();
      this.logger.info('Postgres initialized successfully');
    } catch (error: any) {
      this.logger.error(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * Create necessary tables
   */
  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Research sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS research_sessions (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          query TEXT NOT NULL,
          section VARCHAR(100),
          target_count INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Articles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES research_sessions(id) ON DELETE CASCADE,
          doi VARCHAR(255),
          title TEXT NOT NULL,
          authors TEXT[],
          year INTEGER,
          journal VARCHAR(500),
          abstract TEXT,
          priority INTEGER,
          quality_score FLOAT,
          has_full_text BOOLEAN,
          best_format VARCHAR(50),
          source VARCHAR(50),
          pdf_url TEXT,
          url TEXT,
          is_open_access BOOLEAN,
          citation_count INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(session_id, doi)
        );
      `);

      // Article content table
      await client.query(`
        CREATE TABLE IF NOT EXISTS article_content (
          id SERIAL PRIMARY KEY,
          article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
          section_type VARCHAR(100),
          content_text TEXT,
          word_count INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_doi ON articles(doi);
        CREATE INDEX IF NOT EXISTS idx_articles_session ON articles(session_id);
        CREATE INDEX IF NOT EXISTS idx_articles_priority ON articles(priority);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON research_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_content_article ON article_content(article_id);
      `);

      await client.query('COMMIT');
      this.logger.info('Database tables created/verified successfully');
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create tables: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new research session
   */
  async createSession(
    userId: string,
    query: string,
    section: string,
    targetCount: number
  ): Promise<number> {
    try {
      const result = await this.pool.query(
        `INSERT INTO research_sessions (user_id, query, section, target_count)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, query, section, targetCount]
      );

      const sessionId = result.rows[0].id;
      this.logger.info(`Created research session: ${sessionId}`);

      return sessionId;
    } catch (error: any) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: number) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM research_sessions WHERE id = $1`,
        [sessionId]
      );

      return result.rows[0] || null;
    } catch (error: any) {
      this.logger.error(`Failed to get session: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM research_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error: any) {
      this.logger.error(`Failed to get user sessions: ${error.message}`);
      return [];
    }
  }

  /**
   * Save articles for a session
   */
  async saveArticles(sessionId: number, articles: EnrichedArticle[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      for (const article of articles) {
        await client.query(
          `INSERT INTO articles
           (session_id, doi, title, authors, year, journal, abstract,
            priority, quality_score, has_full_text, best_format, source,
            pdf_url, url, is_open_access, citation_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (session_id, doi)
           DO UPDATE SET
             priority = EXCLUDED.priority,
             quality_score = EXCLUDED.quality_score,
             has_full_text = EXCLUDED.has_full_text,
             best_format = EXCLUDED.best_format`,
          [
            sessionId,
            article.doi || null,
            article.title,
            article.authors || [],
            article.year || null,
            article.journal || null,
            article.abstract || null,
            article.priority,
            article.metrics.qualityScore,
            !!(article.pdfUrl || article.availableFormats?.length),
            article.metrics.bestFormat || null,
            article.source,
            article.pdfUrl || null,
            article.url || null,
            article.isOpenAccess,
            article.citationCount || 0,
          ]
        );
      }

      await client.query('COMMIT');
      this.logger.info(`Saved ${articles.length} articles for session ${sessionId}`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to save articles: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get articles for a session
   */
  async getSessionArticles(sessionId: number): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM articles
         WHERE session_id = $1
         ORDER BY quality_score DESC, priority ASC`,
        [sessionId]
      );

      return result.rows;
    } catch (error: any) {
      this.logger.error(`Failed to get session articles: ${error.message}`);
      return [];
    }
  }

  /**
   * Save structured content for an article
   */
  async saveContent(articleDoi: string, content: StructuredContent): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Find article by DOI
      const articleResult = await client.query(
        `SELECT id FROM articles WHERE doi = $1 LIMIT 1`,
        [articleDoi]
      );

      if (articleResult.rows.length === 0) {
        throw new Error(`Article not found with DOI: ${articleDoi}`);
      }

      const articleId = articleResult.rows[0].id;

      // Delete existing content for this article
      await client.query(
        `DELETE FROM article_content WHERE article_id = $1`,
        [articleId]
      );

      // Insert content sections
      for (const [sectionName, sectionData] of Object.entries(content.sections)) {
        if (sectionData && sectionData.content) {
          const wordCount = sectionData.content.split(/\s+/).length;

          await client.query(
            `INSERT INTO article_content (article_id, section_type, content_text, word_count)
             VALUES ($1, $2, $3, $4)`,
            [articleId, sectionName, sectionData.content, wordCount]
          );
        }
      }

      await client.query('COMMIT');
      this.logger.info(`Saved content for article: ${articleDoi}`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to save content: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get content for an article
   */
  async getArticleContent(articleId: number) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM article_content WHERE article_id = $1 ORDER BY id`,
        [articleId]
      );

      return result.rows;
    } catch (error: any) {
      this.logger.error(`Failed to get article content: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a session and all related data
   */
  async deleteSession(sessionId: number): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM research_sessions WHERE id = $1`,
        [sessionId]
      );

      this.logger.info(`Deleted session: ${sessionId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: number) {
    try {
      const result = await this.pool.query(
        `SELECT
          COUNT(*) as total_articles,
          COUNT(CASE WHEN priority = 1 THEN 1 END) as p1_count,
          COUNT(CASE WHEN priority = 2 THEN 1 END) as p2_count,
          COUNT(CASE WHEN priority = 3 THEN 1 END) as p3_count,
          AVG(quality_score) as avg_quality,
          COUNT(CASE WHEN has_full_text = true THEN 1 END) as with_full_text
         FROM articles
         WHERE session_id = $1`,
        [sessionId]
      );

      return result.rows[0];
    } catch (error: any) {
      this.logger.error(`Failed to get session stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database connection pool closed');
  }
}
