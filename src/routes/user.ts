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
      const accessToken = req.smileaiToken;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
        });
      }

      // Busca estatísticas de crédito do usuário
      const stats = await creditsService.getCreditStats(userId.toString(), accessToken);

      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'Dados de uso não encontrados',
        });
      }

      // Retorna dados no formato esperado pelo frontend
      res.json({
        success: true,
        data: {
          words_left: stats.remaining,
          total_words: stats.limit,
          words_consumed_today: stats.consumed,
          plan_name: stats.plan || 'Básico',
          plan_status: stats.is_active ? 'active' : 'inactive',
          plan_purchase_date: stats.purchase_date,
          next_reset_date: stats.next_reset,
          smileai_remaining_words: 0, // Placeholder, pode ser implementado depois se necessário
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
