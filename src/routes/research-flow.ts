/**
 * Rotas para o novo fluxo de pesquisa de 8 fases
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import {
  generateClarificationQuestions,
  processClarificationAnswers,
  generateSearchStrategy,
  executeExhaustiveSearch,
  analyzeArticles,
  generateAcademicContent,
  processEditRequest,
  verifyDocumentQuality
} from '../services/researchFlowService.js';
import type {
  ClarificationAnswer,
  FlowSearchProgress
} from '../types/index.js';

const router = Router();

/**
 * Função utilitária para limpar strings antes de JSON.stringify
 * Remove/escapa caracteres problemáticos que podem quebrar JSON no SSE
 */
function cleanStringForJSON(str: any): string {
  if (!str) return '';

  // Se é objeto/array, tentar extrair informação útil
  if (typeof str === 'object') {
    if (str.name) return cleanStringForJSON(str.name);  // Objeto autor com campo name
    if (str.title) return cleanStringForJSON(str.title);
    return '';  // Objeto sem campos relevantes
  }

  // Garantir que é string antes de aplicar .replace()
  const stringValue = typeof str === 'string' ? str : String(str);

  return stringValue
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove caracteres de controle
    .replace(/\\/g, '\\\\')  // Escapa backslashes
    .replace(/"/g, '\\"')    // Escapa aspas duplas
    .replace(/\n/g, ' ')     // Substitui quebras de linha por espaços
    .replace(/\r/g, ' ')     // Substitui carriage returns por espaços
    .replace(/\t/g, ' ')     // Substitui tabs por espaços
    .trim();
}

// ============================================
// FASE 2: AI CLARIFICATION
// ============================================

/**
 * POST /api/research-flow/clarification/generate
 * Gera perguntas de clarificação baseadas na query do usuário
 */
router.post('/clarification/generate', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query é obrigatória'
      });
    }

    logger.info('API: Generate clarification questions', { query });

    const session = await generateClarificationQuestions(query);

    res.json({
      success: true,
      data: session
    });
  } catch (error: any) {
    logger.error('API: Generate clarification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar perguntas de clarificação'
    });
  }
});

/**
 * POST /api/research-flow/clarification/process
 * Processa as respostas do usuário
 */
router.post('/clarification/process', async (req: Request, res: Response) => {
  try {
    const { sessionId, answers } = req.body;

    if (!sessionId || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'sessionId e answers são obrigatórios'
      });
    }

    logger.info('API: Process clarification answers', { sessionId, answerCount: answers.length });

    const result = await processClarificationAnswers(sessionId, answers as ClarificationAnswer[]);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('API: Process clarification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar respostas'
    });
  }
});

// ============================================
// FASE 3: SEARCH STRATEGY
// ============================================

/**
 * POST /api/research-flow/strategy/generate
 * Gera estratégia de busca otimizada
 */
router.post('/strategy/generate', async (req: Request, res: Response) => {
  try {
    const { query, clarificationSummary } = req.body;

    if (!query || !clarificationSummary) {
      return res.status(400).json({
        success: false,
        error: 'query e clarificationSummary são obrigatórios'
      });
    }

    logger.info('API: Generate search strategy', { query });

    const strategy = await generateSearchStrategy(query, clarificationSummary);

    res.json({
      success: true,
      data: strategy
    });
  } catch (error: any) {
    logger.error('API: Generate strategy failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar estratégia'
    });
  }
});

// ============================================
// FASE 4: EXHAUSTIVE SEARCH
// ============================================

/**
 * POST /api/research-flow/search/execute
 * Executa busca exaustiva com streaming de progresso
 */
router.post('/search/execute', async (req: Request, res: Response) => {
  try {
    const { strategy } = req.body;

    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'strategy é obrigatória'
      });
    }

    logger.info('API: Execute exhaustive search', { topic: strategy.topic });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Progress callback que envia eventos SSE
    const onProgress = (progress: FlowSearchProgress) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`);
    };

    // Executa a busca
    const articles = await executeExhaustiveSearch(strategy, onProgress);

    // Envia artigos em lotes - SEM ABSTRACT para JSON leve
    const batchSize = 5;  // Pode ser maior agora (sem abstract = JSON 80% menor)
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      // SSE: Apenas campos essenciais (abstract removido = JSON muito menor)
      const safeBatch = batch.map(article => {
        const truncatedTitle = article.title && article.title.length > 120
          ? article.title.substring(0, 120) + '...'
          : article.title;

        return {
          id: article.id,
          title: cleanStringForJSON(truncatedTitle),
          authors: Array.isArray(article.authors)
            ? article.authors.slice(0, 3).map(a => cleanStringForJSON(a))
            : article.authors,
          year: article.year,
          source: cleanStringForJSON(article.source),
          citationCount: article.citationCount,
          // ABSTRACT REMOVIDO - Não necessário para exibição na lista
          // AI usa artigos COMPLETOS na análise/geração
          score: article.score,
          hasFulltext: article.hasFulltext
        };
      });

      res.write(`data: ${JSON.stringify({
        type: 'articles_batch',
        data: safeBatch,
        batchIndex: Math.floor(i / batchSize),
        totalBatches: Math.ceil(articles.length / batchSize),
        totalArticles: articles.length
      })}\n\n`);
    }

    // Envia evento de conclusão
    res.write(`data: ${JSON.stringify({ type: 'complete', totalArticles: articles.length })}\n\n`);
    res.end();

    logger.info('API: Exhaustive search completed', { articlesFound: articles.length });
  } catch (error: any) {
    logger.error('API: Execute search failed', { error: error.message });

    // Se headers não foram enviados, enviar erro normal
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Falha na busca exaustiva'
      });
    } else {
      // Se streaming já começou, enviar erro via SSE
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================
// FASE 5: ARTICLE ANALYSIS
// ============================================

/**
 * POST /api/research-flow/analysis/analyze
 * Analisa artigos e gera grafo de conhecimento
 */
router.post('/analysis/analyze', async (req: Request, res: Response) => {
  try {
    const { articles, query } = req.body;

    if (!articles || !Array.isArray(articles) || !query) {
      return res.status(400).json({
        success: false,
        error: 'articles (array) e query são obrigatórios'
      });
    }

    logger.info('API: Analyze articles', { articleCount: articles.length, query });

    const knowledgeGraph = await analyzeArticles(articles, query);

    res.json({
      success: true,
      data: knowledgeGraph
    });
  } catch (error: any) {
    logger.error('API: Analyze articles failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao analisar artigos'
    });
  }
});

// ============================================
// FASE 6: CONTENT GENERATION
// ============================================

/**
 * POST /api/research-flow/generation/generate
 * Gera conteúdo acadêmico com streaming
 */
router.post('/generation/generate', async (req: Request, res: Response) => {
  try {
    const { config, articles, query } = req.body;

    if (!config || !articles || !query) {
      return res.status(400).json({
        success: false,
        error: 'config, articles e query são obrigatórios'
      });
    }

    logger.info('API: Generate academic content', { section: config.section, articleCount: articles.length });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream content generation
    const stream = generateAcademicContent(config, articles, query);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    res.end();

    logger.info('API: Content generation completed');
  } catch (error: any) {
    logger.error('API: Generate content failed', { error: error.message });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Falha ao gerar conteúdo'
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================
// FASE 7: INTERACTIVE EDITING
// ============================================

/**
 * POST /api/research-flow/editing/process
 * Processa requisição de edição interativa
 */
router.post('/editing/process', async (req: Request, res: Response) => {
  try {
    const { request, currentContent, articles } = req.body;

    if (!request || !currentContent || !articles) {
      return res.status(400).json({
        success: false,
        error: 'request, currentContent e articles são obrigatórios'
      });
    }

    logger.info('API: Process edit request', { action: request.action });

    const editedText = await processEditRequest(request, currentContent, articles);

    res.json({
      success: true,
      data: { editedText }
    });
  } catch (error: any) {
    logger.error('API: Process edit failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar edição'
    });
  }
});

// ============================================
// FASE 8: EXPORT & CITATION
// ============================================

/**
 * POST /api/research-flow/export/verify
 * Verifica qualidade do documento
 */
router.post('/export/verify', async (req: Request, res: Response) => {
  try {
    const { content, articles } = req.body;

    if (!content || !articles) {
      return res.status(400).json({
        success: false,
        error: 'content e articles são obrigatórios'
      });
    }

    logger.info('API: Verify document quality');

    const verification = await verifyDocumentQuality(content, articles);

    res.json({
      success: true,
      data: verification
    });
  } catch (error: any) {
    logger.error('API: Verify quality failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao verificar qualidade'
    });
  }
});

export default router;
