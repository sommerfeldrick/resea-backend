/**
 * Serviço para o novo fluxo de pesquisa de 8 fases
 */

import { logger } from '../config/logger.js';
import { generateText } from './aiProvider.js';
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
      maxTokens: 2000
    });

    const cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    const questionsData = JSON.parse(cleanedText);

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
    throw new Error('Falha ao gerar perguntas de refinamento');
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

Crie queries de busca organizadas por prioridade:

**P1 (Score ≥75)**: Artigos EXCELENTES
- Queries muito específicas, palavras-chave técnicas
- Esperados: artigos de alto impacto, bem citados
- Alvo: 25-30 artigos

**P2 (Score ≥50)**: Artigos BONS
- Queries mais abrangentes, sinônimos
- Esperados: artigos relevantes mas menos citados
- Alvo: 20-25 artigos

**P3 (Score ≥30)**: Artigos ACEITÁVEIS
- Queries gerais, termos relacionados
- Esperados: artigos de contexto, background
- Alvo: 15-20 artigos

Retorne APENAS um objeto JSON válido (sem markdown) com esta estrutura:
{
  "topic": "título descritivo do tema",
  "originalQuery": "${query}",
  "queries": {
    "P1": [
      { "query": "artificial intelligence early childhood education", "priority": "P1", "expectedResults": 10 },
      { "query": "AI preschool learning outcomes", "priority": "P1", "expectedResults": 10 }
    ],
    "P2": [
      { "query": "machine learning young children education", "priority": "P2", "expectedResults": 12 }
    ],
    "P3": [
      { "query": "AI early education", "priority": "P3", "expectedResults": 10 }
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
  "targetArticles": 60,
  "estimatedTime": "3-5 minutos"
}`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em estratégia de busca acadêmica. Retorne APENAS JSON válido.',
      temperature: 0.6,
      maxTokens: 2500
    });

    const cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    const strategy: FlowSearchStrategy = JSON.parse(cleanedText);

    logger.info('Search strategy generated', {
      topic: strategy.topic,
      totalQueries: Object.values(strategy.queries).flat().length
    });

    return strategy;
  } catch (error: any) {
    logger.error('Failed to generate search strategy', {
      error: error.message,
      query
    });
    throw new Error('Falha ao gerar estratégia de busca');
  }
}

// ============================================
// FASE 4: EXHAUSTIVE SEARCH
// ============================================

/**
 * Calcula score de relevância para um artigo
 */
function calculateArticleScore(article: any, query: string): { score: number; priority: PriorityLevel; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Citation count (0-30 pontos)
  const citationScore = Math.min(30, (article.citationCount || 0) / 10);
  score += citationScore;
  if (citationScore > 20) reasons.push(`${article.citationCount} citações`);

  // Year recency (0-20 pontos)
  const currentYear = new Date().getFullYear();
  const yearDiff = currentYear - (article.year || 2000);
  const yearScore = Math.max(0, 20 - yearDiff);
  score += yearScore;
  if (yearScore > 15) reasons.push('Publicação recente');

  // Has full-text (15 pontos)
  if (article.pdfUrl || article.fullText) {
    score += 15;
    reasons.push('Full-text disponível');
  }

  // Source quality (0-15 pontos)
  const highQualitySources = ['Semantic Scholar', 'PubMed', 'IEEE', 'Nature', 'Science'];
  if (highQualitySources.includes(article.source)) {
    score += 15;
    reasons.push('Fonte de alta qualidade');
  }

  // Title relevance (0-20 pontos)
  const titleRelevance = calculateTextRelevance(article.title, query);
  score += titleRelevance;
  if (titleRelevance > 15) reasons.push('Título altamente relevante');

  // Determine priority
  let priority: PriorityLevel;
  if (score >= 75) priority = 'P1';
  else if (score >= 50) priority = 'P2';
  else priority = 'P3';

  return { score, priority, reasons };
}

/**
 * Calcula relevância entre texto e query (simplificado)
 */
function calculateTextRelevance(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/);

  let matches = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) matches++;
  }

  return (matches / queryTerms.length) * 20;
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
      target: strategy.targetArticles
    });

    // Se não atingiu a meta, buscar P2
    if (allArticles.length < strategy.targetArticles && strategy.queries.P2.length > 0) {
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
    }

    // Se ainda não atingiu a meta, buscar P3
    if (allArticles.length < strategy.targetArticles && strategy.queries.P3.length > 0) {
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

// TODO: Implementar FASE 5, 6, 7, 8 nos próximos commits
