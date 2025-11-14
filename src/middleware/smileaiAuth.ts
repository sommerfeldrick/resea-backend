/**
 * SmileAI SSO Authentication Middleware
 *
 * Middleware para autenticação via SmileAI Platform OAuth2
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { smileaiAuth, extractTokenFromHeader } from '../services/smileaiAuth.js';
import { UserSyncService } from '../services/userSyncService.js';

// Extend Express Request to include SmileAI user
declare global {
  namespace Express {
    interface Request {
      smileaiUser?: any;
      smileaiToken?: string;
    }
  }
}

/**
 * Middleware: Autenticação obrigatória via SmileAI
 *
 * Uso:
 * router.get('/protected', smileaiAuthRequired, (req, res) => {
 *   res.json({ user: req.smileaiUser });
 * });
 */
export async function smileaiAuthRequired(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extrair token do header Authorization
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido',
        code: 'AUTH_TOKEN_MISSING',
      });
      return;
    }

    // Validar token e obter usuário
    const smileaiUser = await smileaiAuth.getUserInfo(token);

    if (!smileaiUser) {
      res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
        code: 'AUTH_TOKEN_INVALID',
      });
      return;
    }

    // 🔥 SINCRONIZAR USUÁRIO COM BANCO LOCAL
    // Isso garante que o user_id existe na tabela users (para foreign keys)
    const localUserId = await UserSyncService.syncUser(smileaiUser);

    // Anexar usuário e token ao request
    req.smileaiUser = smileaiUser;
    req.smileaiToken = token;

    // Compatibilidade: também definir req.user para rotas que usam req.user
    // IMPORTANTE: req.user.id agora é o ID LOCAL (da tabela users), não o ID do SmileAI
    (req as any).user = {
      ...smileaiUser,
      id: localUserId,           // ID local (PostgreSQL)
      smileaiId: smileaiUser.id, // ID original do SmileAI
      accessToken: token
    };

    logger.debug('SmileAI Auth: User authenticated and synced', {
      localUserId: localUserId,
      smileaiId: smileaiUser.id,
      email: smileaiUser.email,
    });

    next();
  } catch (error: any) {
    logger.error('SmileAI Auth: Middleware error', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao validar autenticação',
      code: 'AUTH_VALIDATION_ERROR',
    });
  }
}

/**
 * Middleware: Autenticação opcional via SmileAI
 *
 * Se houver token válido, anexa o usuário ao request
 * Se não houver ou for inválido, continua sem autenticação
 *
 * Uso:
 * router.get('/public', smileaiAuthOptional, (req, res) => {
 *   if (req.smileaiUser) {
 *     // Usuário autenticado
 *   } else {
 *     // Usuário anônimo
 *   }
 * });
 */
export async function smileaiAuthOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const smileaiUser = await smileaiAuth.getUserInfo(token);
      if (smileaiUser) {
        // Sincronizar usuário com banco local
        const localUserId = await UserSyncService.syncUser(smileaiUser);

        req.smileaiUser = smileaiUser;
        req.smileaiToken = token;

        // Compatibilidade: também definir req.user para rotas que usam req.user
        (req as any).user = {
          ...smileaiUser,
          id: localUserId,           // ID local (PostgreSQL)
          smileaiId: smileaiUser.id, // ID original do SmileAI
          accessToken: token
        };

        logger.debug('SmileAI Auth: Optional auth successful and synced', {
          localUserId: localUserId,
          smileaiId: smileaiUser.id,
        });
      }
    }

    next();
  } catch (error: any) {
    logger.error('SmileAI Auth: Optional auth error', {
      error: error.message,
    });
    // Continua mesmo com erro
    next();
  }
}

/**
 * Middleware: Verificar se usuário tem permissão específica
 *
 * Uso:
 * router.delete('/admin/users/:id',
 *   smileaiAuthRequired,
 *   requireRole(['admin', 'super_admin']),
 *   (req, res) => { ... }
 * );
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.smileaiUser) {
      res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const userRole = req.smileaiUser.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      logger.warn('SmileAI Auth: Insufficient permissions', {
        userId: req.smileaiUser.id,
        requiredRoles: allowedRoles,
        userRole,
      });

      res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Verificar se usuário é o dono do recurso
 *
 * Uso:
 * router.delete('/documents/:id',
 *   smileaiAuthRequired,
 *   requireOwnership('id', 'user_id'),
 *   (req, res) => { ... }
 * );
 */
export function requireOwnership(
  paramName: string,
  ownerField: string = 'userId'
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.smileaiUser) {
      res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const resourceId = req.params[paramName];
    const userId = req.smileaiUser.id;

    // Aqui você precisaria buscar o recurso e verificar o dono
    // Exemplo simplificado - adapte conforme seu banco de dados
    // const resource = await getResourceById(resourceId);
    // if (resource[ownerField] !== userId) { ... }

    logger.debug('SmileAI Auth: Ownership check', {
      resourceId,
      userId,
    });

    // Por enquanto, apenas passa - implemente a lógica real
    next();
  };
}

export default {
  smileaiAuthRequired,
  smileaiAuthOptional,
  requireRole,
  requireOwnership,
};
