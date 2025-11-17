/**
 * Article Persistence Service
 *
 * Handles storage and retrieval of research articles in PostgreSQL
 * Provides caching to avoid duplicate searches and enables research history
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import type { FlowEnrichedArticle } from '../types/index.js';

export interface PersistedArticle {
  id: number;
  researchId: number;
  externalId: string | null;
  doi: string | null;
  title: string;
  abstract: string | null;
  year: number | null;
  authors: any[];
  citations: number;
  fulltext: string | null;
  pdfUrl: string | null;
  hasFulltext: boolean;
  source: string;
  score: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class ArticlePersistenceService {
  /**
   * Save articles to database
   * Uses UPSERT to avoid duplicates based on external_id
   */
  async saveArticles(
    researchId: number,
    articles: FlowEnrichedArticle[]
  ): Promise<number[]> {
    if (!articles || articles.length === 0) {
      return [];
    }

    const client = await pool.connect();
    const savedIds: number[] = [];

    try {
      await client.query('BEGIN');

      for (const article of articles) {
        // Generate external_id (prefer DOI, then article.id)
        const externalId =
          article.doi ||
          article.id ||
          `${article.source}_${article.title.substring(0, 50)}`;

        const result = await client.query(
          `
          INSERT INTO research_articles (
            research_id,
            external_id,
            doi,
            title,
            abstract,
            year,
            authors,
            citations,
            fulltext,
            pdf_url,
            has_fulltext,
            source,
            score,
            metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14
          )
          ON CONFLICT (external_id) DO UPDATE SET
            research_id = EXCLUDED.research_id,
            fulltext = COALESCE(EXCLUDED.fulltext, research_articles.fulltext),
            has_fulltext = COALESCE(EXCLUDED.has_fulltext, research_articles.has_fulltext),
            score = GREATEST(EXCLUDED.score, research_articles.score),
            updated_at = NOW()
          RETURNING id
          `,
          [
            researchId,
            externalId,
            article.doi || null,
            article.title,
            article.abstract || null,
            article.year || null,
            JSON.stringify(article.authors || []),
            article.citationCount || 0,
            article.fullContent || null,
            article.pdfUrl || null,
            article.hasFulltext || false,
            article.source,
            typeof article.score === 'object' ? article.score.score : article.score || 0,
            JSON.stringify({
              url: article.url,
              format: article.format,
              sections: article.sections || {}
            })
          ]
        );

        savedIds.push(result.rows[0].id);
      }

      await client.query('COMMIT');

      logger.info('Articles saved to database', {
        researchId,
        count: articles.length,
        savedIds: savedIds.length
      });

      return savedIds;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to save articles to database', {
        error: error.message,
        researchId,
        articleCount: articles.length
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get articles by research ID
   */
  async getArticlesByResearchId(
    researchId: number,
    options?: {
      limit?: number;
      minScore?: number;
      hasFulltext?: boolean;
      sortBy?: 'score' | 'year' | 'citations';
    }
  ): Promise<PersistedArticle[]> {
    const {
      limit,
      minScore = 0,
      hasFulltext,
      sortBy = 'score'
    } = options || {};

    const orderBy =
      sortBy === 'score'
        ? 'score DESC'
        : sortBy === 'year'
          ? 'year DESC NULLS LAST'
          : 'citations DESC';

    const query = `
      SELECT * FROM research_articles
      WHERE research_id = $1
        AND score >= $2
        ${hasFulltext !== undefined ? 'AND has_fulltext = $3' : ''}
      ORDER BY ${orderBy}
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    const params = hasFulltext !== undefined
      ? [researchId, minScore, hasFulltext]
      : [researchId, minScore];

    try {
      const result = await pool.query(query, params);
      return result.rows.map(this.mapRowToPersistedArticle);
    } catch (error: any) {
      logger.error('Failed to get articles from database', {
        error: error.message,
        researchId
      });
      return [];
    }
  }

  /**
   * Check if article already exists (by external_id)
   */
  async articleExists(externalId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM research_articles WHERE external_id = $1 LIMIT 1',
        [externalId]
      );
      return result.rows.length > 0;
    } catch (error: any) {
      logger.error('Failed to check article existence', {
        error: error.message,
        externalId
      });
      return false;
    }
  }

  /**
   * Get article by external_id
   */
  async getArticleByExternalId(
    externalId: string
  ): Promise<PersistedArticle | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM research_articles WHERE external_id = $1 LIMIT 1',
        [externalId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPersistedArticle(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to get article by external_id', {
        error: error.message,
        externalId
      });
      return null;
    }
  }

  /**
   * Map database row to PersistedArticle
   */
  private mapRowToPersistedArticle(row: any): PersistedArticle {
    return {
      id: row.id,
      researchId: row.research_id,
      externalId: row.external_id,
      doi: row.doi,
      title: row.title,
      abstract: row.abstract,
      year: row.year,
      authors: row.authors || [],
      citations: row.citations || 0,
      fulltext: row.fulltext,
      pdfUrl: row.pdf_url,
      hasFulltext: row.has_fulltext || false,
      source: row.source,
      score: row.score || 0,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get statistics about stored articles
   */
  async getStats(researchId?: number): Promise<{
    total: number;
    withFulltext: number;
    bySource: Record<string, number>;
    avgScore: number;
  }> {
    try {
      const whereClause = researchId
        ? 'WHERE research_id = $1'
        : '';
      const params = researchId ? [researchId] : [];

      const result = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE has_fulltext = true) as with_fulltext,
          AVG(score) as avg_score,
          jsonb_object_agg(source, count) as by_source
        FROM (
          SELECT
            source,
            COUNT(*) as count,
            has_fulltext,
            score
          FROM research_articles
          ${whereClause}
          GROUP BY source, has_fulltext, score
        ) subquery
        `,
        params
      );

      const row = result.rows[0];

      return {
        total: parseInt(row.total || '0'),
        withFulltext: parseInt(row.with_fulltext || '0'),
        bySource: row.by_source || {},
        avgScore: parseFloat(row.avg_score || '0')
      };
    } catch (error: any) {
      logger.error('Failed to get article stats', {
        error: error.message,
        researchId
      });
      return {
        total: 0,
        withFulltext: 0,
        bySource: {},
        avgScore: 0
      };
    }
  }

  /**
   * Delete articles for a research
   */
  async deleteArticlesByResearchId(researchId: number): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM research_articles WHERE research_id = $1',
        [researchId]
      );

      logger.info('Articles deleted', {
        researchId,
        count: result.rowCount
      });

      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Failed to delete articles', {
        error: error.message,
        researchId
      });
      return 0;
    }
  }
}

export const articlePersistenceService = new ArticlePersistenceService();
