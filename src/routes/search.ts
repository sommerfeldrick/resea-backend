import { Router, Request, Response } from 'express';
import { hybridSearchService } from '../services/hybridSearch.service.js';
import { rerankerService } from '../services/reranker.service.js';
import { metricsService, measureDuration } from '../services/metrics.service.js';
import { FullPaper } from '../types/fullPaper.js';

const router = Router();

/**
 * POST /api/search/hybrid
 * Busca híbrida (Vector 70% + BM25 30%) com reranking
 */
router.post('/hybrid', async (req: Request, res: Response) => {
  try {
    const { query, limit = 20, useReranker = true } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔍 Hybrid search: "${query}" (limit: ${limit}, reranker: ${useReranker})`);

    metricsService.incrementActiveRequests('search');

    try {
      // 1. Busca híbrida
      const { result: searchResults, durationSeconds: searchDuration } = 
        await measureDuration(() => hybridSearchService.search(query, limit * 5));

      metricsService.recordSearch('hybrid', searchDuration, true);

      console.log(`📊 Found ${searchResults.length} results in ${searchDuration.toFixed(2)}s`);

      // 2. Reranking (opcional)
      let finalResults = searchResults;
      let rerankDuration = 0;

      if (useReranker && searchResults.length > 0) {
        const { result: reranked, durationSeconds } = 
          await measureDuration(() => rerankerService.rerank(query, searchResults, limit));
        
        finalResults = reranked;
        rerankDuration = durationSeconds;
        metricsService.recordRerank(rerankDuration);

        console.log(`🎯 Reranked to top ${finalResults.length} in ${rerankDuration.toFixed(2)}s`);
      } else {
        finalResults = searchResults.slice(0, limit);
      }

      return res.json({
        query,
        totalFound: searchResults.length,
        returned: finalResults.length,
        results: finalResults,
        timing: {
          searchSeconds: searchDuration,
          rerankSeconds: rerankDuration,
          totalSeconds: searchDuration + rerankDuration,
        },
      });

    } finally {
      metricsService.decrementActiveRequests('search');
    }

  } catch (error) {
    console.error('Error in hybrid search:', error);
    metricsService.recordError('search', 'hybrid_search_failed');
    metricsService.recordSearch('hybrid', 0, false);
    
    return res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/search/index
 * Indexa papers para busca
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const { papers } = req.body as { papers: FullPaper[] };

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({ error: 'Papers array is required' });
    }

    console.log(`📚 Indexing ${papers.length} papers...`);

    metricsService.incrementActiveRequests('index');

    try {
      const { result, durationSeconds } = 
        await measureDuration(() => hybridSearchService.indexBatch(papers));

      metricsService.recordIndexing(durationSeconds, true);

      // Atualiza contador de papers indexados
      const stats = await hybridSearchService.getStats();
      metricsService.setIndexedPapersCount(stats.totalPapers || 0);

      return res.json({
        message: 'Papers indexed successfully',
        count: papers.length,
        durationSeconds,
        stats,
      });

    } finally {
      metricsService.decrementActiveRequests('index');
    }

  } catch (error) {
    console.error('Error indexing papers:', error);
    metricsService.recordError('search', 'indexing_failed');
    metricsService.recordIndexing(0, false);
    
    return res.status(500).json({
      error: 'Indexing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/search/initialize
 * Inicializa a coleção do Qdrant
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { vectorSize = 384 } = req.body;

    console.log(`🚀 Initializing Qdrant collection (vector size: ${vectorSize})`);

    await hybridSearchService.initializeCollection(vectorSize);

    return res.json({
      message: 'Collection initialized successfully',
      vectorSize,
    });

  } catch (error) {
    console.error('Error initializing collection:', error);
    return res.status(500).json({
      error: 'Initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/search/stats
 * Estatísticas da busca
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await hybridSearchService.getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error getting search stats:', error);
    return res.status(500).json({
      error: 'Failed to get stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/search/clear
 * Limpa toda a coleção
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    console.log('🗑️ Clearing search collection...');
    
    await hybridSearchService.clearCollection();
    
    metricsService.setIndexedPapersCount(0);

    return res.json({
      message: 'Collection cleared successfully',
    });

  } catch (error) {
    console.error('Error clearing collection:', error);
    return res.status(500).json({
      error: 'Failed to clear collection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
