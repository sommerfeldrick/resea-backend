import { Router, Request, Response } from 'express';
import { fullTextExtractor } from '../services/fullTextExtractor.service.js';
import { FullPaper, ExtractionConfig } from '../types/fullPaper.js';

const router = Router();

/**
 * POST /api/fulltext/extract
 * Extrai texto completo de um paper
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const paper: Partial<FullPaper> = req.body.paper;
    const config: Partial<ExtractionConfig> = req.body.config || {};

    if (!paper || !paper.title) {
      return res.status(400).json({
        error: 'Paper data required (must include at least title)'
      });
    }

    console.log(`🔍 Extracting full text for: ${paper.title}`);

    const result = await fullTextExtractor.extractFullText(paper, config);

    if (result.success) {
      return res.json({
        success: true,
        paper: result.paper,
        metadata: result.metadata
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        metadata: result.metadata
      });
    }

  } catch (error) {
    console.error('Error in /extract:', error);
    return res.status(500).json({
      error: 'Internal server error during extraction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/fulltext/extract-batch
 * Extrai texto completo de múltiplos papers
 */
router.post('/extract-batch', async (req: Request, res: Response) => {
  try {
    const papers: Partial<FullPaper>[] = req.body.papers;
    const config: Partial<ExtractionConfig> = req.body.config || {};
    const concurrency: number = req.body.concurrency || 3;

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return res.status(400).json({
        error: 'Papers array required'
      });
    }

    console.log(`🔍 Extracting full text for ${papers.length} papers (concurrency: ${concurrency})`);

    const results = await fullTextExtractor.extractBatch(papers, config, concurrency);

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return res.json({
      total: results.length,
      successful,
      failed,
      results
    });

  } catch (error) {
    console.error('Error in /extract-batch:', error);
    return res.status(500).json({
      error: 'Internal server error during batch extraction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/fulltext/health
 * Verifica status do serviço de extração (GROBID)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const grobidUrl = process.env.GROBID_URL || 'http://localhost:8070';
    const axios = (await import('axios')).default;
    
    const response = await axios.get(`${grobidUrl}/api/isalive`, {
      timeout: 5000
    });

    return res.json({
      status: 'healthy',
      grobid: {
        url: grobidUrl,
        available: response.status === 200,
        message: response.data
      }
    });

  } catch (error) {
    return res.json({
      status: 'degraded',
      grobid: {
        url: process.env.GROBID_URL || 'http://localhost:8070',
        available: false,
        message: 'GROBID not available, will use pdf-parse fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
