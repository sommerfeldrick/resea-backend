import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { getCache } from '../utils/cache.js';
import { getSearchStats } from '../services/academicSearch.js';
import * as gemini from '../services/geminiService.js';
import { getActiveProvider, getAvailableProviders, getProviderStats } from '../services/aiProvider.js';
import {
  GenerateTaskPlanRequestSchema,
  TaskPlanSchema,
  ResearchStepRequestSchema
} from '../types/index.js';

const router = Router();

/**
 * POST /api/generate-plan
 * Generate a research task plan from user query
 */
router.post('/generate-plan', async (req: Request, res: Response) => {
  try {
    const validated = GenerateTaskPlanRequestSchema.parse(req.body);
    const { query } = validated;

    logger.info('API: Generate plan request', { query });

    const plan = await gemini.generateTaskPlan(query);

    res.json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    logger.error('API: Generate plan failed', { error: error.message });

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Dados de entrada inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar plano'
    });
  }
});

/**
 * POST /api/generate-mindmap
 * Generate mind map from task plan
 */
router.post('/generate-mindmap', async (req: Request, res: Response) => {
  try {
    const plan = TaskPlanSchema.parse(req.body);

    logger.info('API: Generate mindmap request', { title: plan.taskTitle });

    const mindMapData = await gemini.generateMindMap(plan);

    res.json({
      success: true,
      data: mindMapData
    });
  } catch (error: any) {
    logger.error('API: Generate mindmap failed', { error: error.message });

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Plano de tarefa inválido',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar mapa mental'
    });
  }
});

/**
 * POST /api/research-step
 * Perform a single research step
 */
router.post('/research-step', async (req: Request, res: Response) => {
  try {
    const validated = ResearchStepRequestSchema.parse(req.body);
    const { step, originalQuery, filters } = validated;

    logger.info('API: Research step request', { step });

    const result = await gemini.performResearchStep(step, originalQuery, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('API: Research step failed', { error: error.message });

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Dados de entrada inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao realizar pesquisa'
    });
  }
});

/**
 * POST /api/generate-outline
 * Generate document outline
 */
router.post('/generate-outline', async (req: Request, res: Response) => {
  try {
    const { plan, researchResults } = req.body;

    if (!plan || !researchResults) {
      return res.status(400).json({
        success: false,
        error: 'Plano e resultados de pesquisa são obrigatórios'
      });
    }

    logger.info('API: Generate outline request');

    const outline = await gemini.generateOutline(plan, researchResults);

    res.json({
      success: true,
      data: { outline }
    });
  } catch (error: any) {
    logger.error('API: Generate outline failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar esboço'
    });
  }
});

/**
 * POST /api/generate-content
 * Generate final document with streaming
 */
router.post('/generate-content', async (req: Request, res: Response) => {
  try {
    const { plan, researchResults } = req.body;

    if (!plan || !researchResults) {
      return res.status(400).json({
        success: false,
        error: 'Plano e resultados de pesquisa são obrigatórios'
      });
    }

    logger.info('API: Generate content stream request');

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Start streaming
    const stream = gemini.generateContentStream(plan, researchResults);

    for await (const chunk of stream) {
      // Send as Server-Sent Events
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    logger.info('API: Content stream completed');
  } catch (error: any) {
    logger.error('API: Generate content failed', { error: error.message });

    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Falha ao gerar conteúdo'
      });
    } else {
      // Send error event if streaming already started
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/ai-stats
 * Get AI provider statistics
 */
router.get('/ai-stats', (req: Request, res: Response) => {
  try {
    const activeProvider = getActiveProvider();
    const availableProviders = getAvailableProviders();
    const stats = getProviderStats();

    res.json({
      success: true,
      data: {
        active: activeProvider,
        available: availableProviders,
        stats,
        webScrapingEnabled: process.env.ENABLE_WEB_SCRAPING === 'true'
      }
    });
  } catch (error: any) {
    logger.error('API: AI stats failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Falha ao obter estatísticas de IA'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  const cache = getCache();
  const searchStats = getSearchStats();
  const activeProvider = getActiveProvider();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiProvider: activeProvider,
    cache: 'getStats' in cache ? cache.getStats() : { type: 'redis' },
    searchStats
  });
});

/**
 * GET /api/server-ip
 * Get server public IP for Cloudflare whitelist
 */
router.get('/server-ip', async (req: Request, res: Response) => {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get('https://api.ipify.org?format=json');
    res.json({
      success: true,
      ip: response.data.ip,
      service: 'ipify.org',
      timestamp: new Date().toISOString(),
      note: 'Add this IP to Cloudflare whitelist for SmileAI API access'
    });
  } catch (error: any) {
    logger.error('API: Get server IP failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get server IP',
      message: error.message
    });
  }
});

/**
 * POST /api/cache/clear
 * Clear cache (admin endpoint)
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    const cache = getCache();
    await cache.clear();

    logger.info('API: Cache cleared');

    res.json({
      success: true,
      message: 'Cache limpo com sucesso'
    });
  } catch (error: any) {
    logger.error('API: Cache clear failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Falha ao limpar cache'
    });
  }
});

export default router;
