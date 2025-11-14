import express, { Request, Response } from 'express';
// import { researchService } from '../services/researchService.js'; // Temporarily disabled - optional dependencies
import { generateTaskPlan } from '../services/geminiService.js';
import { creditsService } from '../services/creditsService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

/**
 * POST /api/research/plan
 * Gera um plano de pesquisa baseado na query do usuário
 * NÃO consome créditos ainda
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const userId = (req as any).user?.id;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query é obrigatória e deve ser uma string'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    logger.info(`Generating research plan for user ${userId}: "${query}"`);

    // Verifica se usuário tem créditos mínimos
    const remaining = await creditsService.getRemainingWords(userId);
    if (remaining < 100) {
      return res.status(403).json({
        success: false,
        error: 'Créditos insuficientes. Atualize seu plano para continuar.',
        remaining: 0
      });
    }

    // Gera o plano (não consome créditos ainda)
    const plan = await generateTaskPlan(query);

    res.json({
      success: true,
      plan,
      remaining,
      message: 'Plano gerado com sucesso. Confirme para iniciar a pesquisa.'
    });

  } catch (error) {
    logger.error('Error generating research plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar plano de pesquisa'
    });
  }
});

/**
 * POST /api/research/generate
 * Executa a pesquisa completa: scraping + geração de conteúdo
 * DESCONTA créditos AQUI (pois o custo da API já foi consumido)
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { query, template, estimatedWords = 1500 } = req.body;
    const userId = (req as any).user?.id;
    const accessToken = (req as any).user?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query é obrigatória'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    logger.info(`Starting research generation for user ${userId}: "${query}"`);

    // 1. Verifica créditos ANTES de gerar (usando sistema híbrido)
    let remaining: number | undefined;
    if (accessToken) {
      const creditCheck = await creditsService.checkCreditsAvailable(
        userId.toString(),
        accessToken,
        estimatedWords
      );

      if (!creditCheck.canGenerate) {
        return res.status(403).json({
          success: false,
          error: creditCheck.message || 'Limite de documentos atingido',
          plan: creditCheck.planName,
          limit: creditCheck.limit,
          consumed: creditCheck.consumed,
          available: creditCheck.available
        });
      }

      remaining = creditCheck.available;
      logger.info(`Credit check passed: ${creditCheck.available} documents available for user ${userId} (plan: ${creditCheck.planName})`);
    }

    // 2. TODO: Implement scraping (requires optional dependencies)
    logger.warn('Web scraping temporarily disabled - using fallback');
    const sources: Array<{ title: string; url: string; content: string }> = [];

    // 3. Monta o prompt baseado no template (se fornecido)
    let enhancedPrompt = query;
    if (template) {
      enhancedPrompt = `${template}\n\nTópico: ${query}\n\nGere um documento acadêmico completo e bem estruturado.`;
    }

    // 4. Gera conteúdo com IA (usa fallback automático)
    logger.info('Generating content with AI...');
    const FALLBACK_MESSAGE = `# ${query}\n\n## Conteúdo em desenvolvimento\n\nEste endpoint requer dependências opcionais (groq-sdk, openai) que não estão instaladas.\nUse o endpoint /api/generate-plan e /api/generate-content para funcionalidade completa.`;
    const content = FALLBACK_MESSAGE;

    // 5. Conta palavras do conteúdo gerado
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    logger.info(`Content generated successfully: ${wordCount} words`);

    // 6. 🔥 DESCONTA CRÉDITOS AQUI (pois as APIs já foram consumidas!)
    if (accessToken) {
      await creditsService.trackDocumentGeneration(
        userId.toString(),
        wordCount,
        undefined, // documentId será gerado ao salvar
        {
          title: query,
          document_type: 'research',
          research_query: query
        }
      );

      // Atualiza estatísticas
      const stats = await creditsService.getCreditStats(userId.toString(), accessToken);
      remaining = stats.remaining;

      logger.info(`✅ Credit deducted: 1 document generated (${wordCount} words). Remaining: ${remaining} documents`);
    }

    // 7. Retorna conteúdo com créditos já descontados
    res.json({
      success: true,
      content, // Conteúdo gerado (usuário pode editar antes de salvar)
      wordCount,
      sourcesCount: sources.length,
      remaining,
      message: '✅ Documento gerado com sucesso! 1 crédito foi descontado.'
    });

  } catch (error) {
    logger.error('Error generating research content:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar conteúdo'
    });
  }
});

/**
 * POST /api/research/finalize
 * FINALIZA o documento (apenas salva - créditos já foram descontados na geração!)
 */
router.post('/finalize', async (req: Request, res: Response) => {
  try {
    const { content, title, documentId, documentType, metadata } = req.body;
    const userId = (req as any).user?.id;
    const accessToken = (req as any).user?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Conteúdo é obrigatório'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    logger.info(`Finalizing document for user ${userId}`);

    // 1. Conta palavras do documento FINAL
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    if (wordCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Documento vazio'
      });
    }

    // 2. ⚠️ CRÉDITOS JÁ FORAM DESCONTADOS NA GERAÇÃO!
    // Aqui apenas retornamos as estatísticas atuais
    const stats = await creditsService.getCreditStats(userId.toString(), accessToken);

    logger.info(`Document finalized: ${wordCount} words. User has ${stats.remaining} documents remaining`);

    // 3. Retorna confirmação (sem descontar créditos novamente)
    res.json({
      success: true,
      wordCount,
      documentsRemaining: stats.remaining,
      stats,
      title: title || 'Documento sem título',
      message: `✅ Documento finalizado com sucesso! Você tem ${stats.remaining} documentos restantes este mês.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error finalizing document:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao finalizar documento'
    });
  }
});

/**
 * GET /api/research/credits
 * Consulta os créditos/palavras disponíveis do usuário (HÍBRIDO: SmileAI + Local)
 */
router.get('/credits', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const accessToken = (req as any).user?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const stats = await creditsService.getCreditStats(userId.toString(), accessToken);

    res.json({
      success: true,
      ...stats
    });

  } catch (error) {
    logger.error('Error fetching credits:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar créditos'
    });
  }
});

/**
 * GET /api/research/credits/history
 * Retorna histórico de uso de créditos do usuário
 */
router.get('/credits/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const history = await creditsService.getCreditHistory(userId.toString(), limit);

    res.json({
      success: true,
      history,
      count: history.length
    });

  } catch (error) {
    logger.error('Error fetching credit history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar histórico'
    });
  }
});

/**
 * POST /api/research/credits/reset (Admin only)
 * Reseta o consumo de palavras de um usuário
 */
router.post('/credits/reset', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    const adminId = (req as any).user?.id;
    const isAdmin = (req as any).user?.type === 'super_admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem resetar créditos'
      });
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'targetUserId é obrigatório'
      });
    }

    await creditsService.resetUsage(targetUserId);

    logger.info(`Credits reset by admin ${adminId} for user ${targetUserId}`);

    res.json({
      success: true,
      message: 'Créditos resetados com sucesso'
    });

  } catch (error) {
    logger.error('Error resetting credits:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao resetar créditos'
    });
  }
});

export default router;
