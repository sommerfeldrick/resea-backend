/**
 * Rotas para Incremental Indexing e Query Expansion
 */

import { Router, Request, Response } from 'express';
import { incrementalIndexingService } from '../services/incrementalIndexing.service.js';
import { queryExpansionService } from '../services/queryExpansion.service.js';

const router = Router();

/**
 * GET /api/sync/status
 * Retorna status do sync incremental
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = incrementalIndexingService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/start
 * Inicia o sync automático
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    incrementalIndexingService.start();
    res.json({
      success: true,
      message: 'Incremental sync started',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/stop
 * Para o sync automático
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    incrementalIndexingService.stop();
    res.json({
      success: true,
      message: 'Incremental sync stopped',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/force
 * Força um sync manual imediato
 */
router.post('/force', async (req: Request, res: Response) => {
  try {
    await incrementalIndexingService.forceSyncNow();
    const status = incrementalIndexingService.getStatus();
    
    res.json({
      success: true,
      message: 'Manual sync completed',
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/sync/config
 * Atualiza configuração do sync
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { sources, interval, batchSize, maxPapersPerSync } = req.body;
    
    incrementalIndexingService.updateConfig({
      sources,
      interval,
      batchSize,
      maxPapersPerSync,
    });
    
    res.json({
      success: true,
      message: 'Configuration updated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/expand-query
 * Expande uma query para melhorar recall
 */
router.post('/expand-query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string',
      });
    }
    
    const expanded = await queryExpansionService.expandQuery(query);
    
    res.json({
      success: true,
      data: expanded,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/query-variations
 * Gera múltiplas variações de uma query
 */
router.post('/query-variations', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string',
      });
    }
    
    const variations = await queryExpansionService.generateQueryVariations(query);
    
    res.json({
      success: true,
      data: {
        original: query,
        variations,
        count: variations.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sync/expansion-stats
 * Estatísticas do cache de expansão
 */
router.get('/expansion-stats', async (req: Request, res: Response) => {
  try {
    const stats = queryExpansionService.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
