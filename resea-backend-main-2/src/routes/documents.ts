import { Router, Request, Response } from 'express';
import { DocumentHistoryService } from '../services/documentHistoryService.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /api/documents
 * Obter histórico de documentos do usuário
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const documents = await DocumentHistoryService.getUserDocuments(userId, limit, offset);

    res.json({
      success: true,
      data: documents,
      pagination: { limit, offset }
    });
  } catch (error) {
    logger.error('Erro ao buscar histórico:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar histórico' });
  }
});

/**
 * GET /api/documents/:id
 * Obter um documento específico
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const documentId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const document = await DocumentHistoryService.getDocument(documentId, userId);

    res.json({ success: true, data: document });
  } catch (error) {
    logger.error('Erro ao buscar documento:', error);
    res.status(404).json({ success: false, error: 'Documento não encontrado' });
  }
});

/**
 * POST /api/documents
 * Salvar um novo documento no histórico
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { title, content, document_type, template_id, research_query, word_count } = req.body;

    if (!title || !content || !document_type) {
      return res.status(400).json({
        success: false,
        error: 'Título, conteúdo e tipo de documento são obrigatórios'
      });
    }

    const document = await DocumentHistoryService.saveDocument({
      user_id: userId,
      title,
      content,
      document_type,
      template_id,
      research_query,
      word_count: word_count || content.split(' ').length,
      status: 'completed'
    });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    logger.error('Erro ao salvar documento:', error);
    res.status(500).json({ success: false, error: 'Erro ao salvar documento' });
  }
});

/**
 * DELETE /api/documents/:id
 * Deletar um documento
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const documentId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await DocumentHistoryService.deleteDocument(documentId, userId);

    res.json({ success: true, message: 'Documento deletado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar documento:', error);
    res.status(404).json({ success: false, error: 'Documento não encontrado' });
  }
});

/**
 * GET /api/documents/stats/user
 * Obter estatísticas do usuário
 */
router.get('/stats/user', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const stats = await DocumentHistoryService.getUserStats(userId);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * POST /api/documents/search/save
 * Salvar uma query de busca
 */
router.post('/search/save', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { query, results_count } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query obrigatória' });
    }

    await DocumentHistoryService.saveSearchQuery(userId, query, results_count || 0);

    res.json({ success: true, message: 'Busca salva com sucesso' });
  } catch (error) {
    logger.error('Erro ao salvar busca:', error);
    res.status(500).json({ success: false, error: 'Erro ao salvar busca' });
  }
});

/**
 * GET /api/documents/search/history
 * Obter histórico de buscas
 */
router.get('/search/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const history = await DocumentHistoryService.getSearchHistory(userId, limit);

    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Erro ao buscar histórico de buscas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar histórico' });
  }
});

export default router;
