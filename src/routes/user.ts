/**
 * User Routes
 * Rotas para perfil e dados do usuário autenticado
 */

import express, { Request, Response } from 'express';
import { smileaiAuthRequired } from '../middleware/smileaiAuth.js';
import { smileaiAuth } from '../services/smileaiAuth.js';
import { creditsService } from '../services/creditsService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/user/profile
 * Obter perfil completo do usuário autenticado
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { ... perfil completo ... }
 * }
 */
router.get(
  '/profile',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const profile = await smileaiAuth.getUserProfile(req.smileaiToken!);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Perfil não encontrado',
        });
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('User: Get profile failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter perfil',
      });
    }
  }
);

/**
 * GET /api/user
 * Obter informações básicas do usuário autenticado (alias para /me)
 */
router.get(
  '/',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const userInfo = await smileaiAuth.getUserInfo(req.smileaiToken!);

      res.json({
        success: true,
        data: userInfo,
      });
    } catch (error: any) {
      logger.error('User: Get user failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter informações do usuário',
      });
    }
  }
);

/**
 * GET /api/user/credits
 * Obter créditos e limite de documentos do usuário (sistema local Resea)
 *
 * Retorna os dados do sistema de créditos local (tabela resea_usage),
 * sincronizado com o plano do SmileAI Platform.
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "words_left": 15,              // Documentos restantes no mês
 *     "total_words": 20,              // Limite do plano
 *     "words_consumed_today": 5,      // Documentos gerados este mês
 *     "plan_name": "Premium",
 *     "plan_status": "active",
 *     "plan_purchase_date": "2025-11-01T00:00:00.000Z",
 *     "next_reset_date": "2025-12-01T00:00:00.000Z",
 *     "smileai_remaining_words": 88000  // Palavras restantes no SmileAI
 *   }
 * }
 */
router.get(
  '/credits',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      // Busca ou cria os dados de uso do usuário
      const usage = await creditsService.getUserUsage(userId);

      if (!usage) {
        return res.status(404).json({
          success: false,
          error: 'Dados de uso não encontrados',
        });
      }

      // Calcula documentos restantes
      const documentsRemaining = Math.max(0, usage.monthly_limit - usage.words_consumed_today);

      // Calcula data do próximo reset (próximo aniversário da compra)
      const purchaseDate = new Date(usage.plan_purchase_date);
      const nextResetDate = new Date(purchaseDate);
      const now = new Date();

      // Avança mês a mês até encontrar a próxima data de reset
      while (nextResetDate <= now) {
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      }

      // Retorna dados no formato esperado pelo frontend
      res.json({
        success: true,
        data: {
          words_left: documentsRemaining,
          total_words: usage.monthly_limit,
          words_consumed_today: usage.words_consumed_today,
          plan_name: usage.plan_name || 'Básico',
          plan_status: 'active',
          plan_purchase_date: usage.plan_purchase_date,
          next_reset_date: nextResetDate.toISOString(),
          smileai_remaining_words: usage.smileai_remaining_words || 0,
        },
      });
    } catch (error: any) {
      logger.error('User: Get credits failed', { error: error.message, stack: error.stack });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter créditos',
      });
    }
  }
);

export default router;
