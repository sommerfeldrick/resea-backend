import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { getCache } from '../utils/cache.js';

const router = Router();
const cache = getCache();

// --- Helpers ---
const getFavorites = async (userId: string): Promise<any[]> => {
  const favs = await cache.get<any[]>(`favorites:${userId}`);
  return favs || [];
};

const getHistory = async (userId: string): Promise<any[]> => {
  const hist = await cache.get<any[]>(`history:${userId}`);
  return hist || [];
};

/**
 * POST /api/templates/favorites
 * Adicionar template aos favoritos
 */
router.post('/favorites', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.body;
    const userId = (req as any).smileaiUser?.id || 'guest';

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId é obrigatório'
      });
    }

    const userFavorites = await getFavorites(userId);

    const favorite = {
      id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      userId,
      addedAt: new Date()
    };

    userFavorites.push(favorite);
    await cache.set(`favorites:${userId}`, userFavorites, null); // null TTL for persistence

    logger.info('Template added to favorites', { userId, templateId });

    res.json({
      success: true,
      data: favorite
    });
  } catch (error: any) {
    logger.error('Add favorite failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/templates/favorites
 * Listar favoritos do usuário
 */
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).smileaiUser?.id || 'guest';
    const userFavorites = await getFavorites(userId);

    res.json({
      success: true,
      data: userFavorites
    });
  } catch (error: any) {
    logger.error('Get favorites failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/templates/favorites/:templateId
 * Remover template dos favoritos
 */
router.delete('/favorites/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = (req as any).smileaiUser?.id || 'guest';

    const userFavorites = await getFavorites(userId);
    const filtered = userFavorites.filter(f => f.templateId !== templateId);
    await cache.set(`favorites:${userId}`, filtered, null); // null TTL for persistence

    logger.info('Template removed from favorites', { userId, templateId });

    res.json({
      success: true,
      message: 'Favorito removido'
    });
  } catch (error: any) {
    logger.error('Remove favorite failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/templates/history
 * Adicionar uso de template ao histórico
 */
router.post('/history', async (req: Request, res: Response) => {
  try {
    const { templateId, filledData, generatedPrompt } = req.body;
    const userId = (req as any).smileaiUser?.id || 'guest';

    if (!templateId || !generatedPrompt) {
      return res.status(400).json({
        success: false,
        error: 'templateId e generatedPrompt são obrigatórios'
      });
    }

    const usage = {
      id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      userId,
      usedAt: new Date(),
      filledData: filledData || {},
      generatedPrompt
    };

    const userHistory = await getHistory(userId);
    userHistory.unshift(usage);

    // Limitar a 100 últimos
    if (userHistory.length > 100) {
      userHistory.pop();
    }

    await cache.set(`history:${userId}`, userHistory, null); // null TTL for persistence

    logger.info('Template usage saved to history', { userId, templateId });

    res.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    logger.error('Save history failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/templates/history
 * Obter histórico de uso
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).smileaiUser?.id || 'guest';
    const limit = parseInt(req.query.limit as string) || 50;

    const userHistory = await getHistory(userId);
    const limited = userHistory.slice(0, limit);

    res.json({
      success: true,
      data: limited
    });
  } catch (error: any) {
    logger.error('Get history failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/templates/history
 * Limpar histórico
 */
router.delete('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).smileaiUser?.id || 'guest';
    await cache.delete(`history:${userId}`);

    logger.info('History cleared', { userId });

    res.json({
      success: true,
      message: 'Histórico limpo'
    });
  } catch (error: any) {
    logger.error('Clear history failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/templates/custom
 * Criar template personalizado
 */
router.post('/custom', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId || userId === 'guest') {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária'
      });
    }

    const template = {
      ...req.body,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      likes: 0
    };

    // Salva o template individualmente e adiciona o ID à lista do usuário
    await cache.set(`custom_template:${template.id}`, template, null);
    const userTemplateIds = await cache.get<string[]>(`custom_templates_list:${userId}`) || [];
    userTemplateIds.push(template.id);
    await cache.set(`custom_templates_list:${userId}`, userTemplateIds, null);

    logger.info('Custom template created', { userId, templateId: template.id });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error: any) {
    logger.error('Create custom template failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/templates/custom
 * Listar templates personalizados do usuário
 */
router.get('/custom', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId || userId === 'guest') {
      return res.json({
        success: true,
        data: []
      });
    }

    const userTemplateIds = await cache.get<string[]>(`custom_templates_list:${userId}`) || [];
    const userTemplates = [];
    for (const id of userTemplateIds) {
        const template = await cache.get<any>(`custom_template:${id}`);
        if(template) userTemplates.push(template);
    }

    res.json({
      success: true,
      data: userTemplates
    });
  } catch (error: any) {
    logger.error('Get custom templates failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/templates/custom/:id
 * Obter template personalizado por ID
 */
router.get('/custom/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await cache.get<any>(`custom_template:${id}`);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    logger.error('Get custom template failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/templates/custom/:id
 * Atualizar template personalizado
 */
router.put('/custom/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const template = await cache.get<any>(`custom_template:${id}`);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    if (template.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este template'
      });
    }

    const updated = {
      ...template,
      ...req.body,
      id: template.id,
      userId: template.userId,
      createdAt: template.createdAt,
      updatedAt: new Date()
    };

    await cache.set(`custom_template:${id}`, updated, null);

    logger.info('Custom template updated', { userId, templateId: id });

    res.json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    logger.error('Update custom template failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/templates/custom/:id
 * Deletar template personalizado
 */
router.delete('/custom/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const template = await cache.get<any>(`custom_template:${id}`);

    if (!template) {
      // Se não existir, apenas retorne sucesso para idempotência
      return res.status(200).json({ success: true, message: 'Template já deletado' });
    }

    if (template.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para deletar este template'
      });
    }

    // Remove o template individual e da lista do usuário
    await cache.delete(`custom_template:${id}`);
    const userTemplateIds = await cache.get<string[]>(`custom_templates_list:${userId}`) || [];
    const filteredIds = userTemplateIds.filter(tid => tid !== id);
    await cache.set(`custom_templates_list:${userId}`, filteredIds, null);

    logger.info('Custom template deleted', { userId, templateId: id });

    res.json({
      success: true,
      message: 'Template deletado'
    });
  } catch (error: any) {
    logger.error('Delete custom template failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/templates/analytics/:id
 * Obter analytics de um template
 */
router.get('/analytics/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Esta é uma operação potencialmente lenta e pode ser otimizada
    // com estruturas de dados mais complexas no Redis se necessário.
    const allHistory = [];
    // Simulação, pois não temos como pegar todas as chaves de histórico eficientemente aqui.
    // Para uma implementação real, seria necessário um índice secundário.
    const userHistory = await getHistory((req as any).smileaiUser?.id || 'guest');
    const templateHistory = userHistory.filter(h => h.templateId === id);

    const analytics = {
      templateId: id,
      totalUses: templateHistory.length, // Apenas para o usuário atual
      uniqueUsers: templateHistory.length > 0 ? 1 : 0, // Apenas para o usuário atual
      lastUsed: templateHistory[0]?.usedAt || null,
      popularityTrend: 'stable' as const
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Get template analytics failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
