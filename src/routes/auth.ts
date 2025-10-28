/**
 * Authentication Routes - SmileAI Integration
 *
 * Endpoints para autenticação via SmileAI Platform
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { smileaiAuth } from '../services/smileaiAuth.js';
import {
  smileaiAuthRequired,
  smileaiAuthOptional,
} from '../middleware/smileaiAuth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login usando credenciais SmileAI (Password Grant)
 *
 * Request:
 * {
 *   "email": "user@example.com",
 *   "password": "senha123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { ... },
 *     "token": {
 *       "access_token": "...",
 *       "refresh_token": "...",
 *       "expires_in": 31536000,
 *       "token_type": "Bearer"
 *     }
 *   }
 * }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios',
      });
    }

    logger.info('Auth: Login attempt', { email });

    const result = await smileaiAuth.loginWithPassword(email, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Credenciais inválidas',
      });
    }

    logger.info('Auth: Login successful', {
      userId: result.user?.id,
      email: result.user?.email,
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error: any) {
    logger.error('Auth: Login failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar login',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Renovar access token usando refresh token
 *
 * Request:
 * {
 *   "refresh_token": "..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "access_token": "...",
 *     "refresh_token": "...",
 *     "expires_in": 31536000,
 *     "token_type": "Bearer"
 *   }
 * }
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token é obrigatório',
      });
    }

    logger.info('Auth: Token refresh attempt');

    const newToken = await smileaiAuth.refreshToken(refresh_token);

    if (!newToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token inválido ou expirado',
      });
    }

    logger.info('Auth: Token refreshed successfully');

    res.json({
      success: true,
      data: newToken,
    });
  } catch (error: any) {
    logger.error('Auth: Token refresh failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Erro ao renovar token',
    });
  }
});

/**
 * GET /api/auth/me
 * Obter informações do usuário autenticado
 *
 * Headers:
 * Authorization: Bearer {access_token}
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "name": "João Silva",
 *     "email": "joao@example.com",
 *     ...
 *   }
 * }
 */
router.get('/me', smileaiAuthRequired, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: req.smileaiUser,
    });
  } catch (error: any) {
    logger.error('Auth: Get user info failed', { error: error.message });

    res.status(500).json({
      success: false,
      error: 'Erro ao obter informações do usuário',
    });
  }
});

/**
 * GET /api/auth/profile
 * Obter perfil completo do usuário autenticado
 *
 * Headers:
 * Authorization: Bearer {access_token}
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
      logger.error('Auth: Get profile failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter perfil',
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Fazer logout (revogar token)
 *
 * Headers:
 * Authorization: Bearer {access_token}
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Logout realizado com sucesso"
 * }
 */
router.post(
  '/logout',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const success = await smileaiAuth.logout(req.smileaiToken!);

      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao fazer logout',
        });
      }

      logger.info('Auth: User logged out', {
        userId: req.smileaiUser?.id,
      });

      res.json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error: any) {
      logger.error('Auth: Logout failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout',
      });
    }
  }
);

/**
 * POST /api/auth/validate
 * Validar token de acesso
 *
 * Headers:
 * Authorization: Bearer {access_token}
 *
 * Response:
 * {
 *   "success": true,
 *   "valid": true,
 *   "user": { ... }
 * }
 */
router.post(
  '/validate',
  smileaiAuthOptional,
  async (req: Request, res: Response) => {
    try {
      if (req.smileaiUser) {
        res.json({
          success: true,
          valid: true,
          user: req.smileaiUser,
        });
      } else {
        res.json({
          success: true,
          valid: false,
        });
      }
    } catch (error: any) {
      logger.error('Auth: Validate failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao validar token',
      });
    }
  }
);

/**
 * GET /api/auth/smileai/documents
 * Obter documentos do usuário na plataforma SmileAI
 *
 * Headers:
 * Authorization: Bearer {access_token}
 */
router.get(
  '/smileai/documents',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const documents = await smileaiAuth.getDocuments(req.smileaiToken!);

      res.json({
        success: true,
        data: documents,
      });
    } catch (error: any) {
      logger.error('Auth: Get documents failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter documentos',
      });
    }
  }
);

/**
 * GET /api/auth/smileai/templates
 * Obter templates de chat do usuário na plataforma SmileAI
 *
 * Headers:
 * Authorization: Bearer {access_token}
 */
router.get(
  '/smileai/templates',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const templates = await smileaiAuth.getChatTemplates(req.smileaiToken!);

      res.json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      logger.error('Auth: Get templates failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter templates',
      });
    }
  }
);

/**
 * GET /api/auth/smileai/brand-voice
 * Obter configurações de Brand Voice do usuário na plataforma SmileAI
 *
 * Headers:
 * Authorization: Bearer {access_token}
 */
router.get(
  '/smileai/brand-voice',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const brandVoice = await smileaiAuth.getBrandVoice(req.smileaiToken!);

      res.json({
        success: true,
        data: brandVoice,
      });
    } catch (error: any) {
      logger.error('Auth: Get brand voice failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter brand voice',
      });
    }
  }
);

/**
 * GET /api/auth/usage-data
 * Obter dados de uso e créditos do usuário
 *
 * Headers:
 * Authorization: Bearer {access_token}
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "words_left": 5000,
 *     "images_left": 10,
 *     "plan_name": "Premium",
 *     "plan_status": "active",
 *     "total_words": 10000,
 *     "total_images": 20,
 *     "words_used": 5000,
 *     "images_used": 10
 *   }
 * }
 */
router.get(
  '/usage-data',
  smileaiAuthRequired,
  async (req: Request, res: Response) => {
    try {
      const usageData = await smileaiAuth.getUserUsageData(req.smileaiToken!);

      if (!usageData) {
        return res.status(404).json({
          success: false,
          error: 'Dados de uso não encontrados',
        });
      }

      res.json({
        success: true,
        data: usageData,
      });
    } catch (error: any) {
      logger.error('Auth: Get usage data failed', { error: error.message });

      res.status(500).json({
        success: false,
        error: 'Erro ao obter dados de uso',
      });
    }
  }
);

export default router;
