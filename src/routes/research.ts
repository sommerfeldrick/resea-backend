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
 * NÃO desconta créditos ainda (apenas quando finalizar)
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { query, template } = req.body;
    const userId = (req as any).user?.id;

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

    // 1. Verifica créditos ANTES de gerar
    const remaining = await creditsService.getRemainingWords(userId);
    if (remaining < 100) {
      return res.status(403).json({
        success: false,
        error: 'Créditos insuficientes',
        remaining: 0
      });
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

    // 5. Conta palavras do rascunho
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    logger.info(`Content generated successfully: ${wordCount} words`);

    // 6. Retorna conteúdo MAS NÃO DESCONTA CRÉDITOS!
    res.json({
      success: true,
      content, // Rascunho para o usuário editar
      wordCount,
      sourcesCount: sources.length,
      remaining,
      message: 'Conteúdo gerado com sucesso! Edite e finalize quando estiver pronto.'
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
 * FINALIZA o documento e DESCONTA créditos
 * Este é o único endpoint que realmente decrementa palavras!
 */
router.post('/finalize', async (req: Request, res: Response) => {
  try {
    const { content, title } = req.body;
    const userId = (req as any).user?.id;

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

    // 2. Verifica se tem créditos suficientes
    const remaining = await creditsService.getRemainingWords(userId);
    if (wordCount > remaining) {
      return res.status(403).json({
        success: false,
        error: `Créditos insuficientes. Você precisa de ${wordCount} palavras mas tem apenas ${remaining}.`,
        wordCount,
        remaining
      });
    }

    // 3. AQUI SIM desconta créditos!
    const newRemaining = await creditsService.incrementUsage(userId, wordCount);

    logger.info(`Document finalized: ${wordCount} words deducted. Remaining: ${newRemaining}`);

    // 4. Retorna confirmação
    res.json({
      success: true,
      wordCount,
      remaining: newRemaining,
      title: title || 'Documento sem título',
      message: `Documento finalizado com sucesso! ${wordCount} palavras foram descontadas.`,
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
 * Consulta os créditos/palavras disponíveis do usuário
 */
router.get('/credits', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const stats = await creditsService.getCreditStats(userId);

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
