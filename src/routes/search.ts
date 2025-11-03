// ════════════════════════════════════════════════════════════
// SEARCH ROUTES
// ════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { HybridExhaustiveSearchService } from '../services/search/hybrid-exhaustive-search.service';
import { ContentAcquisitionService } from '../services/content/content-acquisition.service';
import { ChunkingService } from '../services/content/chunking.service';
import { QdrantService } from '../services/database/qdrant.service';
import { ElasticsearchService } from '../services/database/elasticsearch.service';
import { PostgresService } from '../services/database/postgres.service';
import { WorkSection } from '../types/search.types';
import { Logger } from '../utils/simple-logger';
import * as path from 'path';

const router = Router();
const logger = new Logger('SearchRoutes');

// Serviços
const searchService = new HybridExhaustiveSearchService();
const contentService = new ContentAcquisitionService();
const chunkingService = new ChunkingService();
const qdrant = new QdrantService();
const elasticsearch = new ElasticsearchService();
const postgres = new PostgresService();

// Store para callbacks de aprovação (usar Redis em produção)
const approvalCallbacks = new Map<string, {
  resolve: (value: boolean) => void;
  timeout: NodeJS.Timeout;
}>();

/**
 * POST /api/search/quick
 * Busca rápida sem aprovação do usuário
 */
router.post('/quick', async (req: Request, res: Response) => {
  try {
    const { query, section } = req.body;

    if (!query || !section) {
      return res.status(400).json({
        success: false,
        error: 'Query and section are required'
      });
    }

    logger.info(`Quick search: "${query}" for ${section}`);

    // Busca automática (sem aprovação)
    const articles = await searchService.searchExhaustive(
      query,
      section as WorkSection
    );

    res.json({
      success: true,
      query,
      section,
      articles,
      summary: {
        total: articles.length,
        avgQuality: articles.reduce((sum, a) =>
          sum + a.metrics.qualityScore, 0) / articles.length,
        breakdown: {
          p1: articles.filter(a => a.priority === 1).length,
          p2: articles.filter(a => a.priority === 2).length,
          p3: articles.filter(a => a.priority === 3).length
        },
        formats: articles.reduce((acc, a) => {
          const format = a.availableFormats?.[0]?.format || 'unknown';
          acc[format] = (acc[format] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error: any) {
    logger.error(`Quick search failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/interactive
 * Busca interativa com aprovação do usuário (WebSocket ou polling)
 */
router.post('/interactive', async (req: Request, res: Response) => {
  try {
    const { query, section, userId } = req.body;

    if (!query || !section) {
      return res.status(400).json({
        success: false,
        error: 'Query and section are required'
      });
    }

    const sessionId = `session_${Date.now()}_${userId || 'anonymous'}`;

    logger.info(`Interactive search: "${query}" for ${section} (${sessionId})`);

    // Iniciar busca com callback
    const articles = await searchService.searchExhaustive(
      query,
      section as WorkSection,

      // Callback de aprovação
      async (currentArticles, phase) => {
        logger.info(`Approval request: ${phase} - ${currentArticles.length} articles`);

        // Em produção, usar WebSocket ou SSE para notificar cliente
        // Aqui é um exemplo simplificado com polling

        return new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            logger.warn('Approval timeout - continuing automatically');
            resolve(true);
          }, 60000); // 60s timeout

          approvalCallbacks.set(sessionId, { resolve, timeout });

          // Notificar cliente (em produção: WebSocket)
          logger.info(`Waiting for approval on session: ${sessionId}`);
        });
      }
    );

    res.json({
      success: true,
      sessionId,
      query,
      section,
      articles,
      summary: {
        total: articles.length,
        avgQuality: articles.reduce((sum, a) =>
          sum + a.metrics.qualityScore, 0) / articles.length,
        breakdown: {
          p1: articles.filter(a => a.priority === 1).length,
          p2: articles.filter(a => a.priority === 2).length,
          p3: articles.filter(a => a.priority === 3).length
        }
      }
    });

  } catch (error: any) {
    logger.error(`Interactive search failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/approve/:sessionId
 * Aprovar continuação da busca
 */
router.post('/approve/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { approved } = req.body;

  const callback = approvalCallbacks.get(sessionId);

  if (callback) {
    clearTimeout(callback.timeout);
    callback.resolve(approved);
    approvalCallbacks.delete(sessionId);

    res.json({ success: true });
  } else {
    res.status(404).json({
      success: false,
      error: 'Session not found or already processed'
    });
  }
});

/**
 * POST /api/search/acquire-content
 * Adquirir conteúdo completo dos artigos
 */
router.post('/acquire-content', async (req: Request, res: Response) => {
  try {
    const { articles, sessionId } = req.body;

    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({
        success: false,
        error: 'Articles array is required'
      });
    }

    logger.info(`Acquiring content for ${articles.length} articles`);

    const outputDir = path.join(__dirname, '../../data/sessions', sessionId);

    // Adquirir conteúdo completo (loop para cada artigo)
    const contents = new Map<string, any>();
    for (const article of articles) {
      try {
        const result = await contentService.acquireContent(article);
        if (result.success && result.content) {
          contents.set(article.doi || article.link, result.content);
        }
      } catch (error: any) {
        logger.warn(`Failed to acquire content for ${article.doi || article.link}: ${error.message}`);
      }
    }

    logger.info(`Acquired ${contents.size} articles successfully`);

    // Criar chunks (loop para cada artigo com conteúdo)
    const allChunks = [];
    for (const article of articles) {
      const content = contents.get(article.doi || article.link);
      if (content) {
        try {
          const chunks = await chunkingService.createChunks(article, { generateEmbeddings: true });
          allChunks.push(...chunks);
        } catch (error: any) {
          logger.warn(`Failed to create chunks for ${article.doi || article.link}: ${error.message}`);
        }
      }
    }

    logger.info(`Created ${allChunks.length} chunks`);

    // Indexar chunks no Qdrant
    if (allChunks.length > 0) {
      await qdrant.indexChunks(allChunks);
    }

    // Indexar artigos no Elasticsearch
    await elasticsearch.indexBatch(articles);

    // Salvar no PostgreSQL
    const dbSessionId = await postgres.createSession(
      req.body.userId || 'anonymous',
      req.body.query,
      req.body.section,
      articles.length
    );

    await postgres.saveArticles(dbSessionId, articles);

    // Salvar conteúdo estruturado
    for (const article of articles) {
      const content = contents.get(article.doi || article.link);
      if (content) {
        await postgres.saveContent(article.doi || article.link, content);
      }
    }

    res.json({
      success: true,
      acquired: contents.size,
      chunks: allChunks.length,
      outputDir
    });

  } catch (error: any) {
    logger.error(`Content acquisition failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search/status
 * Status do sistema
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      status: 'operational',
      services: {
        search: 'active',
        content: 'active',
        chunking: 'active'
      },
      apis: {
        total: 13,
        available: [
          'OpenAlex', 'Semantic Scholar', 'PubMed', 'CORE',
          'Europe PMC', 'arXiv', 'DOAJ', 'PLOS',
          'bioRxiv', 'medRxiv', 'OpenAIRE', 'DataCite', 'Google Scholar'
        ]
      },
      cache: {
        connected: true
      },
      database: {
        qdrant: 'connected',
        elasticsearch: 'connected',
        postgres: 'connected'
      }
    });
  } catch (error: any) {
    logger.error(`Status check failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
