/**
 * Rotas para o novo fluxo de pesquisa de 8 fases
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import {
  generateClarificationQuestions,
  processClarificationAnswers,
  generateSearchStrategy,
  executeExhaustiveSearch
} from '../services/researchFlowService.js';
import type {
  ClarificationAnswer,
  FlowSearchProgress
} from '../types/index.js';

const router = Router();

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

    // Envia resultado final
    res.write(`data: ${JSON.stringify({ type: 'complete', data: articles })}\n\n`);
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

// TODO: Adicionar rotas para FASE 5, 6, 7, 8

export default router;
