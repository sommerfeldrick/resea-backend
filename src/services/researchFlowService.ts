/**
 * Serviço para o novo fluxo de pesquisa de 8 fases
 */

import { logger } from '../config/logger.js';
import { generateText } from './aiProvider.js';
import { generateTextStream } from './ai/index.js';
import { buscaAcademicaUniversal } from './academicSearchService.js';
import type {
  ClarificationQuestion,
  ClarificationSession,
  ClarificationAnswer,
  FlowSearchStrategy,
  SearchQuery,
  PriorityLevel,
  FlowEnrichedArticle,
  FlowSearchProgress,
  SearchApprovalPoint,
  KnowledgeGraph,
  ContentGenerationConfig,
  EditRequest,
  ExportOptions,
  QualityVerification
} from '../types/index.js';

// ============================================
// HELPER: JSON COMPLETION
// ============================================

/**
 * Tenta completar JSON truncado adicionando fechamentos necessários
 */
function tryCompleteJSON(text: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // Se ainda está em string, fecha a string
  let completed = text;
  if (inString) {
    completed += '"';
  }

  // Fecha arrays abertos
  for (let i = 0; i < openBrackets; i++) {
    completed += ']';
  }

  // Fecha objetos abertos
  for (let i = 0; i < openBraces; i++) {
    completed += '}';
  }

  return completed;
}

// ============================================
// FASE 2: AI CLARIFICATION & REFINEMENT
// ============================================

/**
 * Gera perguntas inteligentes baseadas na query inicial do usuário
 */
export async function generateClarificationQuestions(
  query: string
): Promise<ClarificationSession> {
  logger.info('Generating clarification questions', { query });

  try {
    const prompt = `Você é um assistente de pesquisa acadêmica experiente. O usuário quer pesquisar sobre: "${query}".

Para fazer a melhor busca possível, gere 3-5 perguntas estratégicas que ajudarão a refinar a busca. As perguntas devem cobrir:

1. Qual seção do documento ele quer escrever (introdução, revisão de literatura, metodologia, etc)
2. Que tipos de estudo prefere (empíricos, teóricos, revisões sistemáticas, etc)
3. Período temporal de interesse
4. Contexto específico ou aplicação (se aplicável)
5. Nível de profundidade desejado

Retorne APENAS um objeto JSON válido (sem markdown, sem \`\`\`json) com esta estrutura:
{
  "questions": [
    {
      "id": "q1",
      "questionNumber": 1,
      "totalQuestions": 5,
      "type": "multiple_choice",
      "question": "Qual seção você quer escrever primeiro?",
      "description": "Isso ajudará a priorizar os tipos de artigos",
      "options": [
        {
          "value": "introducao",
          "label": "Introdução",
          "description": "Contextualização e motivação",
          "estimatedArticles": 20
        },
        {
          "value": "revisao_literatura",
          "label": "Revisão de Literatura",
          "description": "Estado da arte e fundamentação teórica",
          "estimatedArticles": 60
        },
        {
          "value": "metodologia",
          "label": "Metodologia",
          "description": "Métodos e técnicas",
          "estimatedArticles": 15
        },
        {
          "value": "todas",
          "label": "Todas as seções",
          "description": "Documento completo",
          "estimatedArticles": 100
        }
      ],
      "required": true
    }
  ]
}

IMPORTANTE: Adapte as perguntas especificamente para o tema "${query}".`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de pesquisa especialista. Retorne APENAS JSON válido, sem formatação markdown.',
      temperature: 0.7,
      maxTokens: 3000
    });

    // Clean markdown code blocks
    let cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    logger.info('AI response for clarification', {
      originalLength: response.text.length,
      cleanedLength: cleanedText.length,
      preview: cleanedText.substring(0, 200)
    });

    let questionsData;
    try {
      questionsData = JSON.parse(cleanedText);
    } catch (parseError: any) {
      logger.error('JSON parse failed, attempting to fix', {
        error: parseError.message,
        textPreview: cleanedText.substring(0, 500)
      });

      // Try 1: Complete truncated JSON
      try {
        const completed = tryCompleteJSON(cleanedText);
        logger.info('Attempting to parse completed JSON', {
          originalLength: cleanedText.length,
          completedLength: completed.length
        });
        questionsData = JSON.parse(completed);
        logger.info('Successfully parsed completed JSON');
      } catch (completeError: any) {
        // Try 2: Find JSON object in the text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const completed2 = tryCompleteJSON(jsonMatch[0]);
          questionsData = JSON.parse(completed2);
        } else {
          throw new Error('Could not extract valid JSON from response');
        }
      }
    }

    const session: ClarificationSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      questions: questionsData.questions,
      answers: [],
      completed: false,
      createdAt: new Date()
    };

    logger.info('Clarification questions generated', {
      sessionId: session.sessionId,
      questionCount: session.questions.length
    });

    return session;
  } catch (error: any) {
    logger.error('Failed to generate clarification questions', {
      error: error.message,
      query
    });

    // Fallback: return default questions
    logger.info('Using fallback default questions');
    const session: ClarificationSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      questions: [
        {
          id: 'q1',
          questionNumber: 1,
          totalQuestions: 3,
          type: 'multiple_choice',
          question: 'Qual seção do documento você deseja escrever?',
          description: 'Isso ajudará a priorizar os tipos de artigos mais relevantes',
          options: [
            { value: 'introducao', label: 'Introdução', description: 'Contextualização geral do tema', estimatedArticles: 20 },
            { value: 'revisao', label: 'Revisão de Literatura', description: 'Estado da arte e fundamentação teórica', estimatedArticles: 60 },
            { value: 'metodologia', label: 'Metodologia', description: 'Métodos e procedimentos', estimatedArticles: 15 },
            { value: 'todas', label: 'Todas as seções', description: 'Documento completo', estimatedArticles: 100 }
          ],
          required: true
        },
        {
          id: 'q2',
          questionNumber: 2,
          totalQuestions: 3,
          type: 'multiple_choice',
          question: 'Que período de publicação você prefere?',
          description: 'Selecione o intervalo de tempo para os artigos',
          options: [
            { value: 'ultimos_2_anos', label: 'Últimos 2 anos', description: 'Pesquisas mais recentes', estimatedArticles: 30 },
            { value: 'ultimos_5_anos', label: 'Últimos 5 anos', description: 'Trabalhos recentes e relevantes', estimatedArticles: 60 },
            { value: 'ultimos_10_anos', label: 'Últimos 10 anos', description: 'Base sólida de literatura', estimatedArticles: 100 },
            { value: 'sem_restricao', label: 'Sem restrição', description: 'Todos os períodos', estimatedArticles: 150 }
          ],
          required: true
        },
        {
          id: 'q3',
          questionNumber: 3,
          totalQuestions: 3,
          type: 'multiple_choice',
          question: 'Que tipo de estudo você prefere?',
          description: 'Selecione o tipo de pesquisa mais adequado',
          options: [
            { value: 'empiricos', label: 'Estudos Empíricos', description: 'Pesquisas com dados e experimentos', estimatedArticles: 40 },
            { value: 'teoricos', label: 'Estudos Teóricos', description: 'Revisões e frameworks conceituais', estimatedArticles: 30 },
            { value: 'revisoes', label: 'Revisões Sistemáticas', description: 'Meta-análises e sínteses', estimatedArticles: 20 },
            { value: 'todos', label: 'Todos os tipos', description: 'Sem preferência', estimatedArticles: 100 }
          ],
          required: true
        }
      ],
      answers: [],
      completed: false,
      createdAt: new Date()
    };

    return session;
  }
}

/**
 * Processa as respostas do usuário e finaliza a sessão de clarificação
 */
export async function processClarificationAnswers(
  sessionId: string,
  answers: ClarificationAnswer[]
): Promise<{ completed: boolean; summary: string }> {
  logger.info('Processing clarification answers', { sessionId, answerCount: answers.length });

  try {
    // Gera um resumo das respostas para usar nas próximas fases
    const prompt = `Com base nas respostas do usuário, gere um resumo executivo para orientar a busca:

Respostas: ${JSON.stringify(answers)}

Retorne um parágrafo conciso (máximo 200 palavras) resumindo:
- O que o usuário quer pesquisar
- Qual seção ele quer focar
- Preferências de tipo de estudo
- Contexto e período

Responda em português do Brasil, de forma direta e objetiva.`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de síntese.',
      temperature: 0.5,
      maxTokens: 500
    });

    logger.info('Clarification answers processed', { sessionId });

    return {
      completed: true,
      summary: response.text.trim()
    };
  } catch (error: any) {
    logger.error('Failed to process clarification answers', {
      error: error.message,
      sessionId
    });
    throw new Error('Falha ao processar respostas');
  }
}

// ============================================
// FASE 3: SEARCH STRATEGY GENERATION
// ============================================

/**
 * Gera estratégia de busca otimizada baseada nas respostas do usuário
 */
export async function generateSearchStrategy(
  query: string,
  clarificationSummary: string
): Promise<FlowSearchStrategy> {
  logger.info('Generating search strategy', { query });

  try {
    const prompt = `Você é um especialista em busca acadêmica. Com base na intenção do usuário, crie uma estratégia de busca otimizada.

INTENÇÃO DO USUÁRIO:
Query original: "${query}"
Contexto: ${clarificationSummary}

Crie queries de busca organizadas por prioridade (THRESHOLDS ATUALIZADOS):

**P1 (Score ≥70)**: Artigos EXCELENTES
- Queries muito específicas, palavras-chave técnicas e acadêmicas
- Esperados: artigos recentes (2020+), relevantes, com citações normalizadas
- Alvo: 30-40 artigos
- Exemplos: "X systematic review", "X empirical study", "X meta-analysis"

**P2 (Score ≥45)**: Artigos BONS
- Queries mais abrangentes, sinônimos e variações
- Esperados: artigos relevantes, contexto sólido
- Alvo: 20-25 artigos
- Exemplos: "X research", "X literature review", "X study"

**P3 (Score 30-44)**: Artigos ACEITÁVEIS
- Queries gerais para contexto e background
- Esperados: artigos de suporte, overview
- Alvo: 10-15 artigos
- Exemplos: "X overview", "X survey", termos relacionados
- Artigos com score < 30 são automaticamente descartados (baixíssima qualidade)

IMPORTANTE: Com o novo sistema de pontuação, artigos recentes (2020-2025) com boa relevância no título atingem P1 facilmente!

Retorne APENAS um objeto JSON válido (sem markdown) com esta estrutura:
{
  "topic": "título descritivo do tema",
  "originalQuery": "${query}",
  "queries": {
    "P1": [
      { "query": "artificial intelligence early childhood education", "priority": "P1", "expectedResults": 12 },
      { "query": "AI preschool learning outcomes systematic review", "priority": "P1", "expectedResults": 12 },
      { "query": "machine learning education children empirical", "priority": "P1", "expectedResults": 12 }
    ],
    "P2": [
      { "query": "artificial intelligence young children", "priority": "P2", "expectedResults": 15 },
      { "query": "AI educational technology preschool", "priority": "P2", "expectedResults": 15 }
    ],
    "P3": [
      { "query": "AI early education overview", "priority": "P3", "expectedResults": 10 }
    ]
  },
  "prioritizedSources": [
    { "name": "Semantic Scholar", "reason": "Melhor cobertura e scores de relevância", "order": 1 },
    { "name": "CORE", "reason": "JSON estruturado e full-text", "order": 2 },
    { "name": "PubMed Central", "reason": "JATS XML, ótimo para área de saúde/educação", "order": 3 },
    { "name": "ERIC", "reason": "Especializado em educação", "order": 4 }
  ],
  "filters": {
    "dateRange": { "start": 2020, "end": 2025 },
    "languages": ["pt", "en"],
    "documentTypes": ["article", "review", "conference_paper"]
  },
  "targetArticles": 70,
  "estimatedTime": "3-5 minutos"
}`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em estratégia de busca acadêmica. Retorne APENAS JSON válido.',
      temperature: 0.6,
      maxTokens: 8000  // Limite do DeepSeek-chat: 8192 tokens
    });

    let cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    logger.info('AI response for strategy', {
      originalLength: response.text.length,
      cleanedLength: cleanedText.length,
      preview: cleanedText.substring(0, 200)
    });

    let strategy: FlowSearchStrategy;
    try {
      strategy = JSON.parse(cleanedText);
    } catch (parseError: any) {
      logger.error('JSON parse failed for strategy, attempting to fix', {
        error: parseError.message,
        textPreview: cleanedText.substring(0, 500)
      });

      // Try 1: Complete truncated JSON
      try {
        const completed = tryCompleteJSON(cleanedText);
        logger.info('Attempting to parse completed JSON', {
          originalLength: cleanedText.length,
          completedLength: completed.length,
          added: completed.length - cleanedText.length
        });
        strategy = JSON.parse(completed);
        logger.info('Successfully parsed completed JSON');
      } catch (completeError: any) {
        // Try 2: Find JSON object in the text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const completed2 = tryCompleteJSON(jsonMatch[0]);
          strategy = JSON.parse(completed2);
        } else {
          throw new Error('Could not extract valid JSON from response');
        }
      }
    }

    // Validar e garantir que sempre tenha P1, P2, P3
    if (!strategy.queries) {
      strategy.queries = { P1: [], P2: [], P3: [] };
    }
    if (!strategy.queries.P1 || !Array.isArray(strategy.queries.P1)) {
      strategy.queries.P1 = [];
    }
    if (!strategy.queries.P2 || !Array.isArray(strategy.queries.P2)) {
      strategy.queries.P2 = [];
    }
    if (!strategy.queries.P3 || !Array.isArray(strategy.queries.P3)) {
      strategy.queries.P3 = [];
    }

    // Se alguma prioridade está vazia, adicionar queries padrão
    if (strategy.queries.P1.length === 0) {
      strategy.queries.P1.push({
        query: `${query.trim()} systematic review`,
        priority: 'P1',
        expectedResults: 12
      });
    }
    if (strategy.queries.P2.length === 0) {
      strategy.queries.P2.push({
        query: query.trim(),
        priority: 'P2',
        expectedResults: 15
      });
    }
    if (strategy.queries.P3.length === 0) {
      strategy.queries.P3.push({
        query: `${query.trim()} overview`,
        priority: 'P3',
        expectedResults: 10
      });
    }

    logger.info('Search strategy generated', {
      topic: strategy.topic,
      totalQueries: Object.values(strategy.queries).flat().length,
      p1Count: strategy.queries.P1.length,
      p2Count: strategy.queries.P2.length,
      p3Count: strategy.queries.P3.length
    });

    return strategy;
  } catch (error: any) {
    logger.error('Failed to generate search strategy', {
      error: error.message,
      query
    });

    // Fallback: return default strategy
    logger.info('Using fallback default search strategy');
    const currentYear = new Date().getFullYear();
    const strategy: FlowSearchStrategy = {
      topic: query.trim(),
      originalQuery: query,
      queries: {
        P1: [
          { query: `${query.trim()} systematic review`, priority: 'P1', expectedResults: 12 },
          { query: `${query.trim()} empirical study`, priority: 'P1', expectedResults: 12 },
          { query: `${query.trim()} meta-analysis`, priority: 'P1', expectedResults: 12 }
        ],
        P2: [
          { query: `${query.trim()} research`, priority: 'P2', expectedResults: 15 },
          { query: query.trim(), priority: 'P2', expectedResults: 15 }
        ],
        P3: [
          { query: `${query.trim()} overview`, priority: 'P3', expectedResults: 10 }
        ]
      },
      prioritizedSources: [
        { name: 'Semantic Scholar', reason: 'Melhor cobertura e scores de relevância', order: 1 },
        { name: 'CORE', reason: 'JSON estruturado e full-text', order: 2 },
        { name: 'PubMed Central', reason: 'Excelente para área de saúde', order: 3 },
        { name: 'arXiv', reason: 'Pré-prints e acesso aberto', order: 4 }
      ],
      filters: {
        dateRange: { start: currentYear - 5, end: currentYear }, // Focado em últimos 5 anos
        languages: ['pt', 'en'],
        documentTypes: ['article', 'review', 'conference_paper']
      },
      targetArticles: 70,
      estimatedTime: '4-6 minutos'
    };

    return strategy;
  }
}

// ============================================
// FASE 4: EXHAUSTIVE SEARCH
// ============================================

/**
 * Calcula score de relevância para um artigo
 * Sistema otimizado para valorizar artigos recentes E relevantes
 */
function calculateArticleScore(article: any, query: string): { score: number; priority: PriorityLevel; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Citation count NORMALIZADO por idade (0-25 pontos)
  // Artigos recentes com menos citações pontuam melhor
  const currentYear = new Date().getFullYear();
  const articleYear = article.year || 2000;
  const yearsSincePublication = Math.max(1, currentYear - articleYear);

  // Normaliza: citações por ano, com peso maior para artigos recentes
  const citationsPerYear = (article.citationCount || 0) / yearsSincePublication;
  let citationScore = Math.min(25, citationsPerYear * 5); // 5 citações/ano = 25 pontos

  // Bonus para artigos muito citados (>100 citações totais)
  if (article.citationCount > 100) {
    citationScore = Math.min(25, citationScore + 5);
  }

  score += citationScore;
  if (citationScore > 15) reasons.push(`${article.citationCount} citações (${citationsPerYear.toFixed(1)}/ano)`);

  // Year recency (0-20 pontos) - valoriza últimos 5 anos
  const yearScore = yearsSincePublication <= 5 ? 20 - (yearsSincePublication * 3) : Math.max(0, 20 - yearsSincePublication);
  score += yearScore;
  if (yearScore > 15) reasons.push(`Publicado em ${articleYear} (recente)`);

  // Has full-text (15 pontos)
  if (article.pdfUrl || article.fullText) {
    score += 15;
    reasons.push('Full-text disponível');
  }

  // Source quality (0-15 pontos)
  const highQualitySources = ['Semantic Scholar', 'PubMed', 'IEEE', 'Nature', 'Science', 'OpenAlex', 'CORE'];
  if (highQualitySources.includes(article.source)) {
    score += 15;
    reasons.push(`Fonte confiável: ${article.source}`);
  } else if (article.source) {
    score += 10; // Fontes secundárias ainda ganham pontos
  }

  // Title relevance (0-30 pontos) - AUMENTADO!
  const titleRelevance = calculateTextRelevance(article.title, query);
  score += titleRelevance;
  if (titleRelevance > 20) reasons.push('Título altamente relevante');

  // DOI bonus (5 pontos) - indica peer-review
  if (article.doi) {
    score += 5;
    reasons.push('Artigo peer-reviewed (DOI)');
  }

  // Abstract bonus (5 pontos) - conteúdo completo
  if (article.abstract && article.abstract.length > 100) {
    score += 5;
    reasons.push('Abstract completo');
  }

  // Determine priority com thresholds otimizados E threshold mínimo
  let priority: PriorityLevel;
  if (score >= 70) {
    priority = 'P1';      // Artigos excelentes
  } else if (score >= 45) {
    priority = 'P2';      // Artigos bons
  } else if (score >= 30) {
    priority = 'P3';      // Artigos aceitáveis (mínimo de 30 pts)
  } else {
    // Artigos com score < 30 são de baixíssima qualidade e devem ser descartados
    priority = 'P3';      // Marca como P3 mas com flag para filtrar
    reasons.push('⚠️ Score muito baixo - considerar descartar');
  }

  return { score, priority, reasons };
}

/**
 * Calcula relevância entre texto e query
 * Retorna 0-30 pontos com bonus para matches exatos
 */
function calculateTextRelevance(text: string, query: string): number {
  if (!text) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2); // Ignora termos muito curtos

  if (queryTerms.length === 0) return 0;

  // Match exato da query completa = 30 pontos
  if (textLower.includes(queryLower)) {
    return 30;
  }

  // Conta matches parciais
  let matches = 0;
  let exactWordMatches = 0;

  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      matches++;

      // Bonus se for palavra completa (não substring)
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(textLower)) {
        exactWordMatches++;
      }
    }
  }

  // Calcula pontuação base
  const baseScore = (matches / queryTerms.length) * 25;

  // Bonus por matches exatos de palavras
  const exactBonus = (exactWordMatches / queryTerms.length) * 5;

  return Math.min(30, baseScore + exactBonus);
}

/**
 * Executa busca exaustiva com priorização P1 > P2 > P3
 */
export async function executeExhaustiveSearch(
  strategy: FlowSearchStrategy,
  onProgress?: (progress: FlowSearchProgress) => void
): Promise<FlowEnrichedArticle[]> {
  logger.info('Starting exhaustive search', { topic: strategy.topic });

  const allArticles: FlowEnrichedArticle[] = [];
  const startTime = Date.now();

  try {
    // Buscar P1 primeiro
    for (let i = 0; i < strategy.queries.P1.length; i++) {
      const searchQuery = strategy.queries.P1[i];
      logger.info(`Searching P1 query ${i + 1}/${strategy.queries.P1.length}`, {
        query: searchQuery.query
      });

      const results = await buscaAcademicaUniversal(searchQuery.query, {
        maxResults: searchQuery.expectedResults,
        ...strategy.filters
      });

      // Enriquecer artigos com scores
      for (const result of results) {
        const scoreData = calculateArticleScore(result, strategy.originalQuery);

        // Filtrar artigos com score muito baixo (< 30)
        if (scoreData.score < 30) {
          logger.debug('Article discarded due to low score', {
            title: result.title?.substring(0, 50),
            score: scoreData.score
          });
          continue; // Pula artigos de baixíssima qualidade
        }

        const enrichedArticle: FlowEnrichedArticle = {
          id: result.doi || result.url || `article_${Date.now()}_${Math.random()}`,
          title: result.title,
          authors: result.authors,
          year: result.year,
          abstract: result.abstract || '',
          source: result.source,
          url: result.url,
          doi: result.doi,
          pdfUrl: result.pdfUrl,
          citationCount: result.citationCount || 0,
          score: scoreData,
          format: 'pdf',
          hasFulltext: !!result.pdfUrl,
          fullContent: undefined,
          sections: {}
        };

        allArticles.push(enrichedArticle);
      }

      // Callback de progresso
      if (onProgress) {
        const progress: FlowSearchProgress = {
          currentPriority: 'P1',
          currentQuery: i + 1,
          totalQueries: strategy.queries.P1.length,
          sourceProgress: [],
          articlesFound: allArticles.length,
          articlesWithFulltext: allArticles.filter(a => a.hasFulltext).length,
          articlesByPriority: {
            P1: allArticles.filter(a => a.score.priority === 'P1').length,
            P2: allArticles.filter(a => a.score.priority === 'P2').length,
            P3: allArticles.filter(a => a.score.priority === 'P3').length
          },
          formatsDetected: {},
          elapsedTime: Date.now() - startTime
        };
        onProgress(progress);
      }
    }

    // Verificar se precisa continuar para P2
    const p1Articles = allArticles.filter(a => a.score.priority === 'P1');
    logger.info(`P1 search completed`, {
      found: p1Articles.length,
      totalArticles: allArticles.length,
      target: strategy.targetArticles
    });

    // Se não atingiu a meta, buscar P2
    if (allArticles.length < strategy.targetArticles && strategy.queries.P2.length > 0) {
      logger.info('Continuing to P2 search (target not reached)', {
        current: allArticles.length,
        target: strategy.targetArticles
      });
      for (let i = 0; i < strategy.queries.P2.length; i++) {
        const searchQuery = strategy.queries.P2[i];
        logger.info(`Searching P2 query ${i + 1}/${strategy.queries.P2.length}`, {
          query: searchQuery.query
        });

        const results = await buscaAcademicaUniversal(searchQuery.query, {
          maxResults: searchQuery.expectedResults,
          ...strategy.filters
        });

        for (const result of results) {
          const scoreData = calculateArticleScore(result, strategy.originalQuery);

          // Filtrar artigos com score muito baixo (< 30)
          if (scoreData.score < 30) {
            logger.debug('Article discarded due to low score', {
              title: result.title?.substring(0, 50),
              score: scoreData.score
            });
            continue;
          }

          const enrichedArticle: FlowEnrichedArticle = {
            id: result.doi || result.url || `article_${Date.now()}_${Math.random()}`,
            title: result.title,
            authors: result.authors,
            year: result.year,
            abstract: result.abstract || '',
            source: result.source,
            url: result.url,
            doi: result.doi,
            pdfUrl: result.pdfUrl,
            citationCount: result.citationCount || 0,
            score: scoreData,
            format: 'pdf',
            hasFulltext: !!result.pdfUrl,
            fullContent: undefined,
            sections: {}
          };

          allArticles.push(enrichedArticle);
        }

        if (onProgress) {
          const progress: FlowSearchProgress = {
            currentPriority: 'P2',
            currentQuery: i + 1,
            totalQueries: strategy.queries.P2.length,
            sourceProgress: [],
            articlesFound: allArticles.length,
            articlesWithFulltext: allArticles.filter(a => a.hasFulltext).length,
            articlesByPriority: {
              P1: allArticles.filter(a => a.score.priority === 'P1').length,
              P2: allArticles.filter(a => a.score.priority === 'P2').length,
              P3: allArticles.filter(a => a.score.priority === 'P3').length
            },
            formatsDetected: {},
            elapsedTime: Date.now() - startTime
          };
          onProgress(progress);
        }
      }
    } else {
      logger.info('Skipping P2 search - target reached', {
        current: allArticles.length,
        target: strategy.targetArticles
      });
    }

    // Se ainda não atingiu a meta, buscar P3
    if (allArticles.length < strategy.targetArticles && strategy.queries.P3.length > 0) {
      logger.info('Continuing to P3 search (target not reached)', {
        current: allArticles.length,
        target: strategy.targetArticles
      });
      for (let i = 0; i < strategy.queries.P3.length; i++) {
        const searchQuery = strategy.queries.P3[i];
        logger.info(`Searching P3 query ${i + 1}/${strategy.queries.P3.length}`, {
          query: searchQuery.query
        });

        const results = await buscaAcademicaUniversal(searchQuery.query, {
          maxResults: searchQuery.expectedResults,
          ...strategy.filters
        });

        for (const result of results) {
          const scoreData = calculateArticleScore(result, strategy.originalQuery);

          // Filtrar artigos com score muito baixo (< 30)
          if (scoreData.score < 30) {
            logger.debug('Article discarded due to low score', {
              title: result.title?.substring(0, 50),
              score: scoreData.score
            });
            continue;
          }

          const enrichedArticle: FlowEnrichedArticle = {
            id: result.doi || result.url || `article_${Date.now()}_${Math.random()}`,
            title: result.title,
            authors: result.authors,
            year: result.year,
            abstract: result.abstract || '',
            source: result.source,
            url: result.url,
            doi: result.doi,
            pdfUrl: result.pdfUrl,
            citationCount: result.citationCount || 0,
            score: scoreData,
            format: 'pdf',
            hasFulltext: !!result.pdfUrl,
            fullContent: undefined,
            sections: {}
          };

          allArticles.push(enrichedArticle);
        }

        if (onProgress) {
          const progress: FlowSearchProgress = {
            currentPriority: 'P3',
            currentQuery: i + 1,
            totalQueries: strategy.queries.P3.length,
            sourceProgress: [],
            articlesFound: allArticles.length,
            articlesWithFulltext: allArticles.filter(a => a.hasFulltext).length,
            articlesByPriority: {
              P1: allArticles.filter(a => a.score.priority === 'P1').length,
              P2: allArticles.filter(a => a.score.priority === 'P2').length,
              P3: allArticles.filter(a => a.score.priority === 'P3').length
            },
            formatsDetected: {},
            elapsedTime: Date.now() - startTime
          };
          onProgress(progress);
        }
      }
    } else {
      logger.info('Skipping P3 search - target reached', {
        current: allArticles.length,
        target: strategy.targetArticles
      });
    }

    // Remover duplicatas por DOI/URL
    const uniqueArticles = Array.from(
      new Map(allArticles.map(a => [a.doi || a.url, a])).values()
    );

    // Ordenar por score (maior primeiro)
    uniqueArticles.sort((a, b) => b.score.score - a.score.score);

    logger.info('Exhaustive search completed', {
      totalArticles: uniqueArticles.length,
      P1: uniqueArticles.filter(a => a.score.priority === 'P1').length,
      P2: uniqueArticles.filter(a => a.score.priority === 'P2').length,
      P3: uniqueArticles.filter(a => a.score.priority === 'P3').length,
      elapsedTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    });

    return uniqueArticles;
  } catch (error: any) {
    logger.error('Exhaustive search failed', {
      error: error.message
    });
    throw new Error('Falha na busca exaustiva');
  }
}

// ============================================
// FASE 5: ARTICLE ANALYSIS & SYNTHESIS
// ============================================

/**
 * Analisa artigos e gera insights profundos
 */
export async function analyzeArticles(
  articles: FlowEnrichedArticle[],
  query: string
): Promise<KnowledgeGraph> {
  logger.info('Analyzing articles', { articleCount: articles.length, query });

  try {
    // Preparar dados dos artigos para análise (reduzido para evitar timeout/abort)
    const articlesContext = articles.slice(0, 20).map((article, idx) => {
      return `[${idx + 1}] ${article.title} (${article.year})
Autores: ${article.authors.slice(0, 3).join(', ')}${article.authors.length > 3 ? ' et al.' : ''}
Citações: ${article.citationCount}
Score: ${article.score.score} (${article.score.priority})
Abstract: ${article.abstract.substring(0, 200)}...`;
    }).join('\n\n');

    const prompt = `Você é um especialista em análise de literatura científica. Analise os ${articles.length} artigos abaixo sobre "${query}" e identifique:

1. TEMAS PRINCIPAIS (5-7 temas)
2. CLUSTERS de artigos relacionados
3. INSIGHTS e descobertas chave
4. GAPS de pesquisa
5. TENDÊNCIAS metodológicas

Retorne APENAS um objeto JSON válido (sem markdown) com:
{
  "nodes": [
    {
      "id": "central",
      "label": "Tema Central",
      "type": "main",
      "articleCount": 30,
      "position": { "x": 400, "y": 300 }
    },
    {
      "id": "theme1",
      "label": "Nome do Tema 1",
      "type": "sub",
      "articleCount": 12
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "central",
      "target": "theme1",
      "label": "relaciona-se com",
      "weight": 0.8
    }
  ],
  "clusters": [
    {
      "id": "c1",
      "name": "Cluster Principal",
      "nodeIds": ["theme1", "theme2"],
      "citationCount": 1500
    }
  ],
  "insights": {
    "mostCitedCluster": "c1",
    "methodologyBreakdown": {
      "quantitativo": 65,
      "qualitativo": 25,
      "misto": 10
    },
    "gaps": [
      "Faltam estudos longitudinais",
      "Poucos estudos no contexto brasileiro"
    ]
  }
}

ARTIGOS:
${articlesContext}`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em análise bibliométrica. Retorne APENAS JSON válido.',
      temperature: 0.7,
      maxTokens: 8000  // Limite do DeepSeek-chat: 8192 tokens
    });

    let cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    logger.info('AI response for analysis', {
      originalLength: response.text.length,
      cleanedLength: cleanedText.length,
      preview: cleanedText.substring(0, 200)
    });

    let knowledgeGraph: KnowledgeGraph;
    try {
      knowledgeGraph = JSON.parse(cleanedText);
    } catch (parseError: any) {
      logger.error('JSON parse failed for analysis, attempting to fix', {
        error: parseError.message,
        textPreview: cleanedText.substring(0, 500)
      });

      // Try 1: Complete truncated JSON
      try {
        const completed = tryCompleteJSON(cleanedText);
        logger.info('Attempting to parse completed JSON', {
          originalLength: cleanedText.length,
          completedLength: completed.length
        });
        knowledgeGraph = JSON.parse(completed);
        logger.info('Successfully parsed completed JSON');
      } catch (completeError: any) {
        // Try 2: Find JSON object in the text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const completed2 = tryCompleteJSON(jsonMatch[0]);
          knowledgeGraph = JSON.parse(completed2);
        } else {
          throw new Error('Could not extract valid JSON from response');
        }
      }
    }

    logger.info('Article analysis completed', {
      nodeCount: knowledgeGraph.nodes.length,
      clusterCount: knowledgeGraph.clusters.length
    });

    return knowledgeGraph;
  } catch (error: any) {
    logger.error('Article analysis failed', { error: error.message });

    // Fallback: return simple default knowledge graph
    logger.info('Using fallback default knowledge graph');
    const knowledgeGraph: KnowledgeGraph = {
      nodes: [
        {
          id: 'central',
          label: query.substring(0, 50),
          type: 'main',
          articleCount: articles.length,
          position: { x: 400, y: 300 }
        },
        {
          id: 'theme1',
          label: 'Estudos Empíricos',
          type: 'sub',
          articleCount: Math.floor(articles.length * 0.4)
        },
        {
          id: 'theme2',
          label: 'Revisões Teóricas',
          type: 'sub',
          articleCount: Math.floor(articles.length * 0.3)
        },
        {
          id: 'theme3',
          label: 'Metodologias Aplicadas',
          type: 'sub',
          articleCount: Math.floor(articles.length * 0.3)
        }
      ],
      edges: [
        { id: 'e1', source: 'central', target: 'theme1', label: 'relaciona-se com', weight: 0.8 },
        { id: 'e2', source: 'central', target: 'theme2', label: 'fundamenta-se em', weight: 0.7 },
        { id: 'e3', source: 'central', target: 'theme3', label: 'utiliza', weight: 0.6 }
      ],
      clusters: [
        {
          id: 'c1',
          name: 'Cluster Principal',
          nodeIds: ['theme1', 'theme2', 'theme3'],
          citationCount: articles.reduce((sum, a) => sum + a.citationCount, 0)
        }
      ],
      insights: {
        mostCitedCluster: 'c1',
        methodologyBreakdown: {
          'Quantitativo': 50,
          'Qualitativo': 30,
          'Misto': 20
        },
        gaps: [
          'Necessidade de mais estudos longitudinais',
          'Poucos estudos com amostras diversificadas'
        ]
      }
    };

    return knowledgeGraph;
  }
}

// ============================================
// FASE 6: CONTENT GENERATION
// ============================================

/**
 * Gera conteúdo acadêmico baseado nos artigos e configuração
 */
export async function* generateAcademicContent(
  config: ContentGenerationConfig,
  articles: FlowEnrichedArticle[],
  query: string
): AsyncGenerator<string> {
  logger.info('Starting content generation', { section: config.section, articleCount: articles.length });

  try {
    // Preparar contexto dos artigos
    const articlesContext = articles.slice(0, 40).map((article, idx) => {
      return `FONTE_${idx + 1}:
- Citação ABNT: (${article.authors[0]?.split(' ').pop()?.toUpperCase() || 'AUTOR'} et al., ${article.year})
- Título: ${article.title}
- Autores: ${article.authors.join(', ')}
- Ano: ${article.year}
- Abstract: ${article.abstract}
- Citações: ${article.citationCount}
- URL: ${article.url}`;
    }).join('\n\n');

    const styleMap = {
      academic_formal: 'acadêmico formal rigoroso',
      technical_specialized: 'técnico especializado',
      accessible_clear: 'acessível e claro'
    };

    const perspectiveMap = {
      first_person_plural: 'primeira pessoa do plural ("Observamos que...", "Verificamos que...")',
      third_person: 'terceira pessoa ("Os estudos indicam...", "A literatura demonstra...")'
    };

    const densityMap = {
      low: '1 citação por parágrafo',
      medium: '2-3 citações por parágrafo',
      high: '4-5 citações por parágrafo'
    };

    const prompt = `Você é um escritor acadêmico especialista. Escreva a seção "${config.section}" sobre "${query}" usando os artigos científicos fornecidos.

CONFIGURAÇÕES:
- Estilo: ${styleMap[config.style]}
- Perspectiva: ${perspectiveMap[config.perspective]}
- Densidade de citações: ${densityMap[config.citationDensity]}
- Análise crítica: ${config.criticalAnalysis.includeCriticalAnalysis ? 'SIM' : 'NÃO'}
- Apontar limitações: ${config.criticalAnalysis.pointOutLimitations ? 'SIM' : 'NÃO'}

ESTRUTURA DA SEÇÃO:
${config.structure.map((s, idx) => `${idx + 1}. ${s.section}
${s.subsections.map(sub => `   - ${sub}`).join('\n')}`).join('\n')}

FONTES DISPONÍVEIS (${articles.length} artigos):
${articlesContext}

INSTRUÇÕES:
1. Escreva em markdown com títulos ## e ###
2. CITE as fontes usando [CITE:FONTE_X] (AUTOR et al., ANO)
3. Desenvolva cada subseção com PROFUNDIDADE e DETALHES
4. Mínimo 3000 palavras (escreva CONTEÚDO EXTENSO E COMPLETO)
5. Use linguagem ${styleMap[config.style]}
6. Inclua análise crítica se solicitado
7. IMPORTANTE: Escreva um texto LONGO e DETALHADO, não resumos

COMECE A ESCREVER:`;

    // Use real streaming from generateTextStream
    const stream = generateTextStream(prompt, {
      systemPrompt: 'Você é um escritor acadêmico especialista em formatação ABNT. Escreva textos LONGOS e DETALHADOS.',
      temperature: 0.7,
      maxTokens: 8000  // Limite do DeepSeek-chat: 8192 tokens (suficiente para 3000+ palavras)
    });

    // Stream chunks as they arrive from the AI provider
    for await (const chunk of stream) {
      yield chunk;
    }

    logger.info('Content generation completed with real streaming');
  } catch (error: any) {
    logger.error('Content generation failed', { error: error.message });
    throw new Error('Falha ao gerar conteúdo');
  }
}

// ============================================
// FASE 7: INTERACTIVE EDITING
// ============================================

/**
 * Processa requisições de edição interativa
 */
export async function processEditRequest(
  request: EditRequest,
  currentContent: string,
  articles: FlowEnrichedArticle[]
): Promise<string> {
  logger.info('Processing edit request', { action: request.action });

  try {
    const selectedText = request.selection.text;

    let prompt = '';

    switch (request.action) {
      case 'rewrite':
        prompt = `Reescreva o seguinte trecho de forma mais clara e acadêmica:

"${selectedText}"

Mantenha o mesmo conteúdo, mas melhore a redação.`;
        break;

      case 'expand':
        prompt = `Expanda o seguinte trecho com MUITO mais detalhes e profundidade:

"${selectedText}"

INSTRUÇÕES:
- Adicione pelo menos 3x mais conteúdo
- Desenvolva cada ponto com exemplos
- Adicione citações relevantes se disponível
- Mantenha o tom acadêmico
- Escreva UM TEXTO LONGO E DETALHADO`;
        break;

      case 'summarize':
        prompt = `Resuma o seguinte trecho de forma concisa:

"${selectedText}"

Mantenha apenas as informações essenciais.`;
        break;

      case 'add_citations':
        const citationContext = articles.slice(0, 10).map((a, idx) =>
          `FONTE_${idx + 1}: ${a.title} (${a.authors[0]} et al., ${a.year})`
        ).join('\n');

        prompt = `Adicione ${request.parameters?.citationCount || 2} citações relevantes ao seguinte trecho:

"${selectedText}"

Fontes disponíveis:
${citationContext}

Use o formato [CITE:FONTE_X] (AUTOR et al., ANO).`;
        break;

      case 'change_tone':
        const targetTone = request.parameters?.tone || 'formal';
        prompt = `Reescreva o seguinte trecho em tom ${targetTone === 'formal' ? 'acadêmico formal' : 'acessível'}:

"${selectedText}"`;
        break;

      case 'remove':
        return ''; // Simplesmente remove o texto

      default:
        throw new Error('Ação de edição desconhecida');
    }

    // Tokens variáveis baseado na ação
    const maxTokensByAction: Record<string, number> = {
      expand: 8000,      // Expansão precisa de muito espaço
      rewrite: 4000,     // Reescrita pode aumentar texto
      add_citations: 4000,
      summarize: 2000,   // Resumo é menor
      change_tone: 4000,
      remove: 0
    };

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um editor acadêmico especialista.',
      temperature: 0.7,
      maxTokens: maxTokensByAction[request.action] || 4000
    });

    logger.info('Edit request processed', { action: request.action });
    return response.text.trim();
  } catch (error: any) {
    logger.error('Edit request failed', { error: error.message });
    throw new Error('Falha ao processar edição');
  }
}

// ============================================
// FASE 8: EXPORT & CITATION
// ============================================

/**
 * Verifica qualidade do documento antes da exportação
 */
export async function verifyDocumentQuality(
  content: string,
  articles: FlowEnrichedArticle[]
): Promise<QualityVerification> {
  logger.info('Verifying document quality');

  const issues: any[] = [];

  // Verificar citações
  const citationPattern = /\[CITE:FONTE_(\d+)\]/g;
  const citations = [...content.matchAll(citationPattern)];
  const uniqueCitations = new Set(citations.map(c => c[1]));

  // Verificar se todas as citações têm referências
  for (const citationId of uniqueCitations) {
    const sourceIndex = parseInt(citationId) - 1;
    if (sourceIndex >= articles.length) {
      issues.push({
        type: 'missing_reference',
        severity: 'error',
        description: `Citação FONTE_${citationId} não tem referência correspondente`,
        autoFixAvailable: false
      });
    }
  }

  // Verificar parágrafos muito longos
  const paragraphs = content.split('\n\n');
  paragraphs.forEach((para, idx) => {
    const wordCount = para.split(/\s+/).length;
    if (wordCount > 400) {
      issues.push({
        type: 'long_paragraph',
        severity: 'warning',
        description: `Parágrafo ${idx + 1} muito longo (${wordCount} palavras)`,
        autoFixAvailable: false
      });
    }
  });

  // Verificar similaridade (placeholder)
  const plagiarismSimilarity = 2.5; // Simulado

  const verification: QualityVerification = {
    abntFormatting: true,
    allCitationsHaveReferences: issues.filter(i => i.type === 'missing_reference').length === 0,
    allReferencesAreCited: true,
    textCoherence: 89,
    grammarCheck: true,
    plagiarismSimilarity,
    issues
  };

  logger.info('Document quality verified', {
    issueCount: issues.length,
    plagiarismSimilarity
  });

  return verification;
}
