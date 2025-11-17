/**
 * Research Persistence Service
 *
 * Manages research sessions in PostgreSQL
 * Links queries, strategies, articles, and generated content
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import type { FlowSearchStrategy, ContentOutline } from '../types/index.js';

export interface Research {
  id: number;
  userId: number | null;
  topic: string;
  originalQuery: string;
  workType: string | null;
  section: string | null;
  strategyData: FlowSearchStrategy | null;
  contentOutline: ContentOutline | null;
  status: 'active' | 'completed' | 'archived';
  currentPhase: 'search' | 'analysis' | 'generation';
  totalArticlesFound: number;
  articlesWithFulltext: number;
  knowledgeGraphGenerated: boolean;
  contentGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

class ResearchPersistenceService {
  /**
   * Create a new research session
   */
  async createResearch(params: {
    userId?: number;
    topic: string;
    originalQuery: string;
    workType?: string;
    section?: string;
    strategyData?: FlowSearchStrategy;
    contentOutline?: ContentOutline;
  }): Promise<Research> {
    const {
      userId = null,
      topic,
      originalQuery,
      workType = null,
      section = null,
      strategyData = null,
      contentOutline = null
    } = params;

    try {
      const result = await pool.query(
        `
        INSERT INTO researches (
          user_id,
          topic,
          original_query,
          work_type,
          section,
          strategy_data,
          content_outline
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          userId,
          topic,
          originalQuery,
          workType,
          section,
          JSON.stringify(strategyData),
          JSON.stringify(contentOutline)
        ]
      );

      logger.info('Research created', {
        researchId: result.rows[0].id,
        topic,
        userId
      });

      return this.mapRowToResearch(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create research', {
        error: error.message,
        topic
      });
      throw error;
    }
  }

  /**
   * Update research statistics
   */
  async updateResearchStats(
    researchId: number,
    stats: {
      totalArticlesFound?: number;
      articlesWithFulltext?: number;
      knowledgeGraphGenerated?: boolean;
      contentGenerated?: boolean;
      currentPhase?: 'search' | 'analysis' | 'generation';
      status?: 'active' | 'completed' | 'archived';
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (stats.totalArticlesFound !== undefined) {
      updates.push(`total_articles_found = $${paramIndex++}`);
      values.push(stats.totalArticlesFound);
    }

    if (stats.articlesWithFulltext !== undefined) {
      updates.push(`articles_with_fulltext = $${paramIndex++}`);
      values.push(stats.articlesWithFulltext);
    }

    if (stats.knowledgeGraphGenerated !== undefined) {
      updates.push(`knowledge_graph_generated = $${paramIndex++}`);
      values.push(stats.knowledgeGraphGenerated);
    }

    if (stats.contentGenerated !== undefined) {
      updates.push(`content_generated = $${paramIndex++}`);
      values.push(stats.contentGenerated);
    }

    if (stats.currentPhase) {
      updates.push(`current_phase = $${paramIndex++}`);
      values.push(stats.currentPhase);
    }

    if (stats.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(stats.status);

      if (stats.status === 'completed') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      return;
    }

    values.push(researchId);

    try {
      await pool.query(
        `UPDATE researches SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      logger.debug('Research stats updated', { researchId, stats });
    } catch (error: any) {
      logger.error('Failed to update research stats', {
        error: error.message,
        researchId
      });
    }
  }

  /**
   * Get research by ID
   */
  async getResearchById(researchId: number): Promise<Research | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM researches WHERE id = $1',
        [researchId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToResearch(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to get research by ID', {
        error: error.message,
        researchId
      });
      return null;
    }
  }

  /**
   * Get researches by user ID
   */
  async getResearchesByUserId(
    userId: number,
    options?: {
      limit?: number;
      status?: 'active' | 'completed' | 'archived';
    }
  ): Promise<Research[]> {
    const { limit = 50, status } = options || {};

    try {
      const query = `
        SELECT * FROM researches
        WHERE user_id = $1
        ${status ? 'AND status = $2' : ''}
        ORDER BY created_at DESC
        LIMIT $${status ? 3 : 2}
      `;

      const params = status ? [userId, status, limit] : [userId, limit];

      const result = await pool.query(query, params);

      return result.rows.map(this.mapRowToResearch);
    } catch (error: any) {
      logger.error('Failed to get researches by user ID', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Archive old researches
   */
  async archiveOldResearches(daysOld: number = 30): Promise<number> {
    try {
      const result = await pool.query(
        `
        UPDATE researches
        SET status = 'archived'
        WHERE status = 'completed'
        AND completed_at < NOW() - INTERVAL '${daysOld} days'
        `,
        []
      );

      logger.info('Old researches archived', {
        count: result.rowCount,
        daysOld
      });

      return result.rowCount || 0;
    } catch (error: any) {
      logger.error('Failed to archive old researches', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Delete research and all related articles
   */
  async deleteResearch(researchId: number): Promise<void> {
    try {
      // Cascade delete will remove all articles automatically
      await pool.query('DELETE FROM researches WHERE id = $1', [researchId]);

      logger.info('Research deleted', { researchId });
    } catch (error: any) {
      logger.error('Failed to delete research', {
        error: error.message,
        researchId
      });
      throw error;
    }
  }

  /**
   * Map database row to Research object
   */
  private mapRowToResearch(row: any): Research {
    return {
      id: row.id,
      userId: row.user_id,
      topic: row.topic,
      originalQuery: row.original_query,
      workType: row.work_type,
      section: row.section,
      strategyData: row.strategy_data,
      contentOutline: row.content_outline,
      status: row.status,
      currentPhase: row.current_phase,
      totalArticlesFound: row.total_articles_found || 0,
      articlesWithFulltext: row.articles_with_fulltext || 0,
      knowledgeGraphGenerated: row.knowledge_graph_generated || false,
      contentGenerated: row.content_generated || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }
}

export const researchPersistenceService = new ResearchPersistenceService();
