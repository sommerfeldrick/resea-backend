/**
 * AI Health and Stats Routes
 * Monitora saúde dos provedores de IA
 */

import express, { Request, Response } from 'express';
import { getAIServiceHealth, resetDailyStats } from '../services/ai/index.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/ai/health
 * Retorna saúde de todos os provedores
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await getAIServiceHealth();

    res.json({
      success: true,
      ...health
    });
  } catch (error: any) {
    logger.error('Failed to get AI health', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get AI health status',
      details: error.message
    });
  }
});

/**
 * POST /api/ai/reset-stats
 * Reseta estatísticas diárias (admin only)
 */
router.post('/reset-stats', async (req: Request, res: Response) => {
  try {
    // TODO: Adicionar check de admin
    resetDailyStats();

    res.json({
      success: true,
      message: 'Daily statistics reset',
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to reset AI stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reset statistics'
    });
  }
});

export default router;
