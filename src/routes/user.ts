/**
 * User Routes
 * Rotas para perfil e dados do usuário autenticado
 */

import express, { Request, Response } from 'express';
import { smileaiAuthRequired } from '../middleware/smileaiAuth.js';
import { smileaiAuth } from '../services/smileaiAuth.js';
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

export default router;
