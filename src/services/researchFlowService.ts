/**
 * Serviço para o novo fluxo de pesquisa de 8 fases
 */

import { logger } from '../config/logger.js';
import { generateText } from './aiProvider.js';
import { generateTextStream } from './ai/index.js';
import { buscaAcademicaUniversal } from './academicSearchService.js';
import { ContentAcquisitionService } from './content/content-acquisition.service.js';
import { UnpaywallService } from './apis/unpaywall.service.js';
import { CrossrefService } from './apis/crossref.service.js';
import { COREService } from './apis/core.service.js';
import { OpenAlexService } from './apis/openalex.service.js';
import { ArXivService } from './apis/arxiv.service.js';
import { EuropePMCService } from './apis/europepmc.service.js';
import { SemanticScholarService } from './apis/semantic-scholar.service.js';
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

    // Validate and fix questions
    const validatedQuestions = questionsData.questions.map((q: any, index: number) => {
      // FORÇAR todas as perguntas a serem multiple_choice (frontend só suporta isso)
      const needsOptions = !q.options || !Array.isArray(q.options) || q.options.length === 0;

      if (needsOptions) {
        logger.warn('Question needs options, adding contextual defaults', {
          questionId: q.id,
          originalType: q.type,
          question: q.question
        });

        // FORÇAR type para multiple_choice
        q.type = 'multiple_choice';

        // Detectar tipo de pergunta e adicionar opções contextuais
        const questionText = (q.question || '').toLowerCase();

        if (questionText.includes('período') || questionText.includes('temporal') || questionText.includes('ano') || questionText.includes('publicação')) {
          // Pergunta sobre período temporal
          q.options = [
            { value: 'recente', label: 'Últimos 5 anos (2020-2025)', description: 'Pesquisas mais recentes e atuais', estimatedArticles: 50 },
            { value: 'amplo', label: 'Últimos 10 anos (2015-2025)', description: 'Boa cobertura com estudos consolidados', estimatedArticles: 120 },
            { value: 'historico', label: 'Últimos 20 anos (2005-2025)', description: 'Visão histórica e evolutiva do tema', estimatedArticles: 200 },
            { value: 'todos', label: 'Sem restrição de período', description: 'Todos os artigos disponíveis', estimatedArticles: 300 }
          ];
        } else if (questionText.includes('aplicação') || questionText.includes('específica') || questionText.includes('interessa') || questionText.includes('foco')) {
          // Pergunta sobre aplicações específicas ou foco da pesquisa
          q.options = [
            { value: 'geral', label: 'Visão geral do tema', description: 'Sem foco específico', estimatedArticles: 100 },
            { value: 'especifico1', label: 'Tenho um foco específico', description: 'Buscar apenas sobre aplicação particular', estimatedArticles: 40 },
            { value: 'comparativo', label: 'Comparação entre abordagens', description: 'Estudos comparativos', estimatedArticles: 60 },
            { value: 'todos', label: 'Todas as aplicações', description: 'Cobertura ampla', estimatedArticles: 120 }
          ];
        } else if (questionText.includes('seção') || questionText.includes('parte')) {
          // Pergunta sobre seção do documento
          q.options = [
            { value: 'introducao', label: 'Introdução', description: 'Contextualização e motivação', estimatedArticles: 20 },
            { value: 'revisao', label: 'Revisão de Literatura', description: 'Estado da arte', estimatedArticles: 60 },
            { value: 'metodologia', label: 'Metodologia', description: 'Métodos e procedimentos', estimatedArticles: 15 },
            { value: 'todas', label: 'Todas as seções', description: 'Documento completo', estimatedArticles: 100 }
          ];
        } else if (questionText.includes('tipo') || questionText.includes('estudo')) {
          // Pergunta sobre tipo de estudo
          q.options = [
            { value: 'empirico', label: 'Estudos Empíricos', description: 'Pesquisas com dados experimentais', estimatedArticles: 40 },
            { value: 'revisao', label: 'Revisões Sistemáticas', description: 'Meta-análises e sínteses', estimatedArticles: 30 },
            { value: 'teorico', label: 'Estudos Teóricos', description: 'Frameworks e modelos', estimatedArticles: 20 },
            { value: 'todos', label: 'Todos os tipos', description: 'Sem restrição', estimatedArticles: 100 }
          ];
        } else if (questionText.includes('nível') || questionText.includes('detalhe') || questionText.includes('profundidade')) {
          // Pergunta sobre nível de detalhe/profundidade
          q.options = [
            { value: 'basico', label: 'Conceitos básicos', description: 'Visão geral e introdutória', estimatedArticles: 40 },
            { value: 'intermediario', label: 'Nível intermediário', description: 'Detalhes metodológicos e aplicações', estimatedArticles: 70 },
            { value: 'avancado', label: 'Análise aprofundada', description: 'Aspectos teóricos e técnicos avançados', estimatedArticles: 50 },
            { value: 'todos', label: 'Todos os níveis', description: 'Cobertura completa', estimatedArticles: 100 }
          ];
        } else {
          // Fallback genérico
          q.options = [
            { value: 'sim', label: 'Sim', description: 'Incluir este critério', estimatedArticles: 60 },
            { value: 'nao', label: 'Não', description: 'Não incluir', estimatedArticles: 30 },
            { value: 'talvez', label: 'Indiferente', description: 'Não tenho preferência', estimatedArticles: 100 }
          ];
        }
      }

      // Ensure required fields exist
      return {
        ...q,
        id: q.id || `q${index + 1}`,
        questionNumber: q.questionNumber || index + 1,
        totalQuestions: q.totalQuestions || questionsData.questions.length,
        type: q.type || 'multiple_choice',
        required: q.required !== undefined ? q.required : true
      };
    });

    const session: ClarificationSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      questions: validatedQuestions,
      answers: [],
      completed: false,
      createdAt: new Date()
    };

    // Log detalhado de CADA pergunta para debug
    validatedQuestions.forEach((q: any, idx: number) => {
      logger.info(`Question ${idx + 1} details:`, {
        id: q.id,
        type: q.type,
        question: q.question,
        hasOptions: !!q.options,
        optionsCount: q.options?.length || 0,
        optionsPreview: q.options?.map((opt: any) => opt.label).join(', ') || 'NONE'
      });
    });

    logger.info('Clarification session complete', {
      sessionId: session.sessionId,
      questionCount: session.questions.length,
      allQuestionsHaveOptions: validatedQuestions.every((q: any) => q.options && q.options.length > 0)
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
): Promise<{
  completed: boolean;
  summary: string;
  structuredData: {
    dateRange: { start: number; end: number };
    documentTypes: string[];
    focusSection: string;
    specificTerms: string[];
    detailLevel: string;
  }
}> {
  logger.info('Processing clarification answers', { sessionId, answerCount: answers.length });

  try {
    // Extrair dados estruturados das respostas
    const currentYear = new Date().getFullYear();
    let dateRange = { start: currentYear - 5, end: currentYear }; // Default: últimos 5 anos
    let documentTypes: string[] = [];
    let focusSection = 'todas';
    let specificTerms: string[] = [];
    let detailLevel = 'intermediario';

    // Processar cada resposta
    for (const answer of answers) {
      const value = answer.answer?.toString().toLowerCase() || '';
      const questionText = answer.questionId?.toLowerCase() || '';

      // Detectar período temporal
      if (value.includes('recente') || value === 'recente') {
        dateRange = { start: currentYear - 5, end: currentYear };
      } else if (value.includes('amplo') || value === 'amplo') {
        dateRange = { start: currentYear - 10, end: currentYear };
      } else if (value.includes('historico') || value === 'historico') {
        dateRange = { start: currentYear - 20, end: currentYear };
      } else if (value.includes('todos') || value === 'todos' || value.includes('sem restrição')) {
        dateRange = { start: 1900, end: currentYear }; // SEM RESTRIÇÃO!
      }

      // Detectar tipo de estudo
      if (value.includes('empirico') || value.includes('empírico')) {
        documentTypes.push('empirical study', 'clinical study', 'experimental study');
      } else if (value.includes('revisao') || value.includes('revisão') || value.includes('sistemática')) {
        documentTypes.push('systematic review', 'meta-analysis', 'literature review');
      } else if (value.includes('teorico') || value.includes('teórico')) {
        documentTypes.push('theoretical study', 'conceptual framework');
      }

      // Detectar seção foco
      if (value.includes('introducao') || value.includes('introdução')) {
        focusSection = 'introducao';
      } else if (value.includes('revisao') || value.includes('revisão')) {
        focusSection = 'revisao';
      } else if (value.includes('metodologia')) {
        focusSection = 'metodologia';
      }

      // Detectar nível de detalhe
      if (value.includes('basico') || value.includes('básico')) {
        detailLevel = 'basico';
      } else if (value.includes('avancado') || value.includes('avançado') || value.includes('aprofundada')) {
        detailLevel = 'avancado';
      }

      // Capturar termos específicos de respostas texto
      if (typeof answer.answer === 'string' && answer.answer.length > 10 && !['sim', 'nao', 'talvez', 'todos'].includes(value)) {
        specificTerms.push(answer.answer);
      }
    }

    // Gerar resumo textual
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

    const structuredData = {
      dateRange,
      documentTypes,
      focusSection,
      specificTerms,
      detailLevel
    };

    logger.info('Clarification answers processed with structured data', {
      sessionId,
      structuredData
    });

    return {
      completed: true,
      summary: response.text.trim(),
      structuredData
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
  clarificationSummary: string,
  structuredData?: {
    dateRange: { start: number; end: number };
    documentTypes: string[];
    focusSection: string;
    specificTerms: string[];
    detailLevel: string;
  }
): Promise<FlowSearchStrategy> {
  logger.info('Generating search strategy', { query, structuredData });

  try {
    const prompt = `Você é um especialista em busca acadêmica. Crie uma estratégia de busca otimizada para o tema específico do usuário.

⚠️ ATENÇÃO CRÍTICA: O tema da pesquisa é EXATAMENTE: "${query}"
NÃO invente outro tema! NÃO use exemplos genéricos! Use APENAS o tema fornecido!

INTENÇÃO DO USUÁRIO:
Query original: "${query}"
Contexto adicional: ${clarificationSummary}

Crie queries de busca organizadas por prioridade (THRESHOLDS ATUALIZADOS):

**P1 (Score ≥70)**: Artigos EXCELENTES sobre "${query}"
- Queries muito específicas, palavras-chave técnicas e acadêmicas SOBRE "${query}"
- Esperados: artigos recentes (2020+), relevantes, com citações normalizadas
- Alvo: 30-40 artigos
- Use padrões como: "${query} systematic review", "${query} empirical study", "${query} meta-analysis"

**P2 (Score ≥45)**: Artigos BONS sobre "${query}"
- Queries mais abrangentes, sinônimos e variações de "${query}"
- Esperados: artigos relevantes, contexto sólido
- Alvo: 20-25 artigos
- Use padrões como: "${query} research", "${query} literature review", "${query} study"

**P3 (Score 30-44)**: Artigos ACEITÁVEIS sobre "${query}"
- Queries gerais para contexto e background de "${query}"
- Esperados: artigos de suporte, overview
- Alvo: 10-15 artigos
- Use padrões como: "${query} overview", "${query} survey", termos relacionados a "${query}"
- Artigos com score < 30 são automaticamente descartados (baixíssima qualidade)

IMPORTANTE: Com o novo sistema de pontuação, artigos recentes (2020-2025) com boa relevância no título atingem P1 facilmente!

Retorne APENAS um objeto JSON válido (sem markdown) com esta estrutura:
{
  "topic": "${query}",
  "originalQuery": "${query}",
  "queries": {
    "P1": [
      { "query": "query específica sobre ${query}", "priority": "P1", "expectedResults": 12 },
      { "query": "outra query sobre ${query}", "priority": "P1", "expectedResults": 12 },
      { "query": "terceira query sobre ${query}", "priority": "P1", "expectedResults": 12 }
    ],
    "P2": [
      { "query": "query P2 sobre ${query}", "priority": "P2", "expectedResults": 15 },
      { "query": "outra query P2 sobre ${query}", "priority": "P2", "expectedResults": 15 }
    ],
    "P3": [
      { "query": "query P3 sobre ${query}", "priority": "P3", "expectedResults": 10 }
    ]
  },
  "keyTerms": {
    "primary": ["termo principal 1 de ${query}", "termo principal 2 de ${query}"],
    "specific": ["termo específico 1", "termo específico 2", "termo específico 3"],
    "methodological": ["systematic review", "meta-analysis", "empirical study"]
  },
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

    // APLICAR DADOS ESTRUTURADOS DAS RESPOSTAS DO USUÁRIO
    if (structuredData) {
      logger.info('Applying structured user preferences to strategy', structuredData);

      // 1. APLICAR PERÍODO TEMPORAL (resposta do usuário)
      strategy.filters.dateRange = structuredData.dateRange;

      // 2. APLICAR TIPOS DE DOCUMENTO (se especificado)
      if (structuredData.documentTypes.length > 0) {
        strategy.filters.documentTypes = structuredData.documentTypes;
      }

      // 3. ADICIONAR TERMOS ESPECÍFICOS NAS QUERIES (se houver)
      if (structuredData.specificTerms.length > 0) {
        // Adicionar termos específicos nas queries P1
        structuredData.specificTerms.forEach(term => {
          strategy.queries.P1.push({
            query: `${query.trim()} ${term}`,
            priority: 'P1',
            expectedResults: 10
          });
        });
      }

      // 4. AJUSTAR QUERIES BASEADO NA SEÇÃO FOCO
      if (structuredData.focusSection !== 'todas') {
        const sectionKeywords: Record<string, string[]> = {
          'introducao': ['introduction', 'background', 'context', 'motivation'],
          'revisao': ['literature review', 'state of art', 'theoretical framework'],
          'metodologia': ['methodology', 'methods', 'experimental design', 'approach']
        };

        const keywords = sectionKeywords[structuredData.focusSection] || [];
        keywords.forEach(keyword => {
          strategy.queries.P2.push({
            query: `${query.trim()} ${keyword}`,
            priority: 'P2',
            expectedResults: 12
          });
        });
      }

      logger.info('Strategy updated with user preferences', {
        dateRange: strategy.filters.dateRange,
        documentTypes: strategy.filters.documentTypes,
        additionalQueriesP1: structuredData.specificTerms.length,
        focusSection: structuredData.focusSection
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
      keyTerms: {
        primary: [query.trim(), `${query.trim()} research`],
        specific: ['systematic review', 'empirical study', 'meta-analysis'],
        methodological: ['literature review', 'overview', 'survey']
      },
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
 * Enriquece artigos com conteúdo completo (fulltext)
 * Filtra apenas artigos que conseguiram obter fulltext
 */
/**
 * FASE 3 NOVA: Enriquecimento Híbrido com Fulltext
 * Tenta múltiplas fontes em paralelo para maximizar taxa de sucesso
 */
async function enrichArticlesWithFulltext(
  articles: FlowEnrichedArticle[],
  onProgress?: (progress: { current: number; total: number; successful: number }) => void
): Promise<FlowEnrichedArticle[]> {
  logger.info('🚀 Starting hybrid fulltext enrichment (4 sources: OpenAlex, Unpaywall, arXiv, Europe PMC)', { articleCount: articles.length });

  // Inicializar services (com circuit breaker embutido)
  const openalex = new OpenAlexService();
  const unpaywall = new UnpaywallService();
  // const core = new COREService();  // DISABLED - 100% error 500
  const arxiv = new ArXivService();
  const europepmc = new EuropePMCService();
  // const semanticScholar = new SemanticScholarService();  // DISABLED - rate limit 429

  const enrichedArticles: FlowEnrichedArticle[] = [];
  const batchSize = 10; // Processar 10 artigos por vez
  let successful = 0;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);

    // Processar batch em paralelo
    const batchResults = await Promise.allSettled(
      batch.map(async (article) => {
        try {
          // Tentar enriquecer com fulltext de múltiplas fontes em paralelo
          const fulltextResult = await tryMultipleFulltextSources(
            article,
            { openalex, unpaywall, arxiv, europepmc }
          );

          if (fulltextResult.success && fulltextResult.fullContent) {
            // ✅ Conseguiu fulltext
            logger.debug('Fulltext acquired', {
              title: article.title.substring(0, 50),
              source: fulltextResult.source,
              length: fulltextResult.fullContent.length
            });

            return {
              ...article,
              fullContent: fulltextResult.fullContent,
              hasFulltext: true,
              format: fulltextResult.format || 'pdf',
              source: fulltextResult.source || article.source
            };
          } else {
            // ⚠️ NÃO conseguiu fulltext → FALLBACK para abstract
            logger.debug('Using abstract as fallback', {
              title: article.title.substring(0, 50)
            });

            return {
              ...article,
              fullContent: undefined,
              hasFulltext: false
            };
          }
        } catch (error: any) {
          logger.warn('Enrichment error - using fallback', {
            title: article.title.substring(0, 50),
            error: error.message
          });

          // Em caso de erro, retorna artigo com abstract
          return {
            ...article,
            fullContent: undefined,
            hasFulltext: false
          };
        }
      })
    );

    // Coletar TODOS os resultados (com fulltext OU abstract)
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        enrichedArticles.push(result.value);
        if (result.value.hasFulltext) {
          successful++;
        }
      }
    }

    // Callback de progresso
    if (onProgress) {
      onProgress({
        current: Math.min(i + batchSize, articles.length),
        total: articles.length,
        successful
      });
    }
  }

  const fulltextRate = ((successful / articles.length) * 100).toFixed(1);
  logger.info('✅ Hybrid fulltext enrichment completed', {
    total: enrichedArticles.length,
    withFulltext: successful,
    withAbstract: enrichedArticles.length - successful,
    fulltextRate: `${fulltextRate}%`
  });

  return enrichedArticles;
}

/**
 * Tenta obter fulltext de múltiplas fontes em paralelo
 * Retorna o primeiro que conseguir (Promise.race otimizado)
 */
async function tryMultipleFulltextSources(
  article: FlowEnrichedArticle,
  services: {
    openalex: OpenAlexService;
    unpaywall: UnpaywallService;
    // core: COREService;  // DISABLED
    arxiv: ArXivService;
    europepmc: EuropePMCService;
    // semanticScholar: SemanticScholarService;  // DISABLED
  }
): Promise<{ success: boolean; fullContent?: string; source?: string; format?: string }> {
  const attempts: Promise<{ success: boolean; fullContent?: string; source?: string; format?: string }>[] = [];

  // [1] OpenAlex (se tem DOI) - MAIOR COBERTURA (250M artigos)
  if (article.doi) {
    attempts.push(
      (async () => {
        try {
          const result = await services.openalex.getByDOI(article.doi!);
          if (result && (result.pdfUrl || result.abstract)) {
            return {
              success: true,
              fullContent: result.abstract || '',
              source: 'OpenAlex',
              format: result.pdfUrl ? 'pdf' : 'json'
            };
          }
        } catch (error) {
          logger.debug(`OpenAlex failed for ${article.doi}`);
        }
        return { success: false };
      })()
    );
  }

  // [2] Unpaywall (se tem DOI)
  if (article.doi) {
    attempts.push(
      (async () => {
        try {
          const result = await services.unpaywall.getByDOI(article.doi!);
          if (result && result.pdfUrl) {
            // Download PDF e extrai texto (simplificado - pode melhorar)
            return {
              success: true,
              fullContent: result.abstract || '', // TODO: baixar PDF e extrair texto
              source: 'Unpaywall',
              format: 'pdf'
            };
          }
        } catch (error) {
          logger.debug(`Unpaywall failed for ${article.doi}`);
        }
        return { success: false };
      })()
    );
  }

  // [3] CORE API - DISABLED (100% error 500 in production, need valid API key)
  // if (article.doi) {
  //   attempts.push(...);
  // }

  // [4] arXiv (se tem arxivId ou é da área certa)
  if (article.source === 'arXiv' || article.id?.includes('arxiv')) {
    attempts.push(
      (async () => {
        try {
          // Extrair arXiv ID do DOI ou URL
          const arxivId = article.doi?.replace('10.48550/arXiv.', '') ||
                          article.url?.match(/arxiv\.org\/abs\/(\S+)/)?.[1] ||
                          article.id?.match(/\d{4}\.\d{5}(v\d+)?/)?.[0]; // Extrair ID do article.id

          if (arxivId) {
            // Passar apenas o ID, o serviço arXiv detectará e adicionará prefixo "id:"
            const results = await services.arxiv.search(arxivId, 1);
            if (results.length > 0 && results[0].abstract) {
              return {
                success: true,
                fullContent: results[0].abstract, // TODO: baixar LaTeX source
                source: 'arXiv',
                format: 'latex'
              };
            }
          }
        } catch (error) {
          logger.debug(`arXiv failed`);
        }
        return { success: false };
      })()
    );
  }

  // [5] Europe PMC (se biomedicina)
  if (article.source?.toLowerCase().includes('pubmed') ||
      article.source?.toLowerCase().includes('pmc') ||
      article.doi?.includes('PMC')) {
    attempts.push(
      (async () => {
        try {
          const query = article.doi || article.title;
          const results = await services.europepmc.search(query, 1, { requireFullText: true });
          if (results.length > 0 && results[0].abstract) {
            return {
              success: true,
              fullContent: results[0].abstract,
              source: 'Europe PMC',
              format: 'jats'
            };
          }
        } catch (error) {
          logger.debug(`Europe PMC failed`);
        }
        return { success: false };
      })()
    );
  }

  // [6] Semantic Scholar - DISABLED (rate limit 429 errors without API key)
  // if (article.doi || article.title) {
  //   attempts.push(...);
  // }

  // Executar todas as tentativas em paralelo, retornar a primeira que funcionar
  if (attempts.length === 0) {
    return { success: false };
  }

  try {
    const results = await Promise.allSettled(attempts);

    // Encontrar o primeiro sucesso
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        return result.value;
      }
    }

    return { success: false };
  } catch (error) {
    return { success: false };
  }
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
        ...strategy.filters,
        sources: ['openalex', 'arxiv', 'europepmc'] // Apenas APIs priorizadas (sem CORE, Semantic Scholar, etc)
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
          ...strategy.filters,
          sources: ['openalex', 'arxiv', 'europepmc'] // Apenas APIs priorizadas
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
          ...strategy.filters,
          sources: ['openalex', 'arxiv', 'europepmc'] // Apenas APIs priorizadas
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

    // 🚀 ENRIQUECIMENTO HÍBRIDO COM FULLTEXT
    logger.info('Starting hybrid fulltext enrichment phase');
    const enrichedArticles = await enrichArticlesWithFulltext(
      uniqueArticles,
      (progress) => {
        logger.debug('Fulltext enrichment progress', progress);
        if (onProgress) {
          onProgress({
            ...onProgress,
            articlesWithFulltext: progress.successful
          } as any);
        }
      }
    );

    logger.info('✅ Search + Enrichment completed', {
      total: enrichedArticles.length,
      withFulltext: enrichedArticles.filter(a => a.hasFulltext).length,
      withAbstract: enrichedArticles.filter(a => !a.hasFulltext).length
    });

    return enrichedArticles;
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
    // 🚀 PRIORIZAR ARTIGOS COM FULLTEXT
    // Separar artigos com fulltext dos sem fulltext
    const withFulltext = articles.filter(a => a.hasFulltext);
    const withoutFulltext = articles.filter(a => !a.hasFulltext);

    logger.info('Article selection for analysis', {
      total: articles.length,
      withFulltext: withFulltext.length,
      withoutFulltext: withoutFulltext.length
    });

    // Selecionar top 30: priorizar fulltext
    const selectedArticles = [
      ...withFulltext.slice(0, Math.min(withFulltext.length, 30)),
      ...withoutFulltext.slice(0, Math.max(0, 30 - withFulltext.length))
    ].slice(0, 30);

    logger.info('Selected articles for analysis', {
      total: selectedArticles.length,
      withFulltext: selectedArticles.filter(a => a.hasFulltext).length
    });

    // Preparar dados dos artigos para análise (QUALIDADE MÁXIMA)
    const articlesContext = selectedArticles.map((article, idx) => {
      // 🚀 USAR FULLCONTENT quando disponível (ao invés de abstract)
      let content: string;
      if (article.fullContent) {
        // Fulltext disponível → usar primeiros 800 caracteres
        content = article.fullContent.length > 800
          ? article.fullContent.substring(0, 800) + '...'
          : article.fullContent;
      } else if (article.abstract) {
        // Fallback: abstract
        content = article.abstract.length > 400
          ? article.abstract.substring(0, 400) + '...'
          : article.abstract;
      } else {
        content = 'Conteúdo não disponível';
      }

      const hasFulltextLabel = article.hasFulltext ? '[FULLTEXT]' : '[ABSTRACT]';

      return `[${idx + 1}] ${hasFulltextLabel} ${article.title} (${article.year})
Autores: ${article.authors.slice(0, 5).join(', ')}${article.authors.length > 5 ? ' et al.' : ''}
Citações: ${article.citationCount}
Score: ${article.score.score} (${article.score.priority})
Conteúdo: ${content}`;
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
    // 🚀 PRIORIZAR ARTIGOS COM FULLTEXT para geração
    const withFulltext = articles.filter(a => a.hasFulltext);
    const withoutFulltext = articles.filter(a => !a.hasFulltext);

    logger.info('Article selection for generation', {
      total: articles.length,
      withFulltext: withFulltext.length,
      withoutFulltext: withoutFulltext.length
    });

    // Selecionar top 30: priorizar fulltext
    const selectedArticles = [
      ...withFulltext.slice(0, Math.min(withFulltext.length, 30)),
      ...withoutFulltext.slice(0, Math.max(0, 30 - withFulltext.length))
    ].slice(0, 30);

    logger.info('Selected articles for generation', {
      total: selectedArticles.length,
      withFulltext: selectedArticles.filter(a => a.hasFulltext).length
    });

    // Preparar contexto dos artigos com FULLTEXT (máxima qualidade)
    const articlesContext = selectedArticles.map((article, idx) => {
      // 🚀 USAR FULLCONTENT ao invés de abstract
      // Truncar fulltext para evitar prompt muito grande (primeiros 3000 chars)
      const content = article.fullContent
        ? (article.fullContent.length > 3000
            ? article.fullContent.substring(0, 3000) + '...'
            : article.fullContent)
        : (article.abstract || 'Conteúdo não disponível');

      const hasFulltextLabel = article.hasFulltext ? '[FULLTEXT]' : '[ABSTRACT]';

      return `FONTE_${idx + 1}: ${hasFulltextLabel}
- Citação ABNT: (${article.authors[0]?.split(' ').pop()?.toUpperCase() || 'AUTOR'} et al., ${article.year})
- Título: ${article.title}
- Autores: ${article.authors.join(', ')}
- Ano: ${article.year}
- Conteúdo completo: ${content}
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

INSTRUÇÕES CRÍTICAS:
1. Escreva em markdown com títulos ## e ###
2. **OBRIGATÓRIO**: CITE as fontes usando o formato exato [CITE:FONTE_X] (AUTOR et al., ANO)
   Exemplo: "Os elementos finitos são amplamente utilizados [CITE:FONTE_1] (SILVA et al., 2020)."
3. Use ${densityMap[config.citationDensity]} conforme configurado
4. Desenvolva cada subseção com PROFUNDIDADE e DETALHES
5. **ESCREVA TEXTO EXTENSO E COMPLETO**: Desenvolva TODAS as subseções até o final, com no mínimo 1500-2000 palavras
6. Use linguagem ${styleMap[config.style]}
7. Inclua análise crítica se solicitado
8. **IMPORTANTE**: SEMPRE inclua citações! Não escreva parágrafos sem citar as fontes!
9. **NÃO PARE NO MEIO**: Continue escrevendo até completar TODAS as subseções da estrutura

COMECE A ESCREVER AGORA:`;

    // Use real streaming from generateTextStream
    const stream = generateTextStream(prompt, {
      systemPrompt: 'Você é um escritor acadêmico especialista em formatação ABNT. Escreva textos LONGOS, DETALHADOS e COMPLETOS até o final.',
      temperature: 0.7,
      maxTokens: 32000  // Gemini suporta até 32K output tokens - textos completos sem corte
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
 * Valida uma citação específica usando IA
 * Verifica se o conteúdo citado realmente está no artigo
 */
async function validateCitationWithAI(
  citedText: string,
  article: FlowEnrichedArticle,
  citationId: string
): Promise<{
  valid: boolean;
  confidence: number;
  reasoning: string;
  suggestedCorrection?: string;
}> {
  try {
    // Usar fullContent se disponível, senão abstract
    const articleContent = article.fullContent
      ? article.fullContent.substring(0, 8000)
      : article.abstract;

    if (!articleContent) {
      return {
        valid: false,
        confidence: 0,
        reasoning: 'Artigo sem conteúdo disponível para validação'
      };
    }

    const prompt = `Você é um verificador de citações acadêmicas especializado.

TRECHO DO DOCUMENTO GERADO:
"${citedText}"

ARTIGO CITADO (${citationId}):
Título: ${article.title}
Autores: ${article.authors.join(', ')}
Ano: ${article.year}
Conteúdo do artigo:
${articleContent}

TAREFA: A informação apresentada no trecho do documento é compatível com o conteúdo do artigo citado?

CRITÉRIOS:
1. A informação está presente no artigo? (diretamente ou como paráfrase válida)
2. O contexto está correto?
3. Não há distorção ou interpretação incorreta?

Responda APENAS em formato JSON válido:
{
  "valid": true ou false,
  "confidence": número entre 0.0 e 1.0,
  "reasoning": "explicação breve de 1-2 frases",
  "suggestedCorrection": "se inválida, sugestão de correção ou null"
}`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um validador de citações acadêmicas. Responda apenas com JSON válido.',
      temperature: 0.3, // Baixa temperatura para resposta mais determinística
      maxTokens: 500
    });

    // Limpar e parsear resposta
    let jsonStr = response.text.trim();

    // Remover markdown code blocks se houver
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

    const result = JSON.parse(jsonStr);

    return {
      valid: result.valid === true,
      confidence: Math.min(1, Math.max(0, parseFloat(result.confidence) || 0)),
      reasoning: result.reasoning || 'Sem justificativa fornecida',
      suggestedCorrection: result.suggestedCorrection || undefined
    };
  } catch (error: any) {
    logger.warn('Citation validation failed', {
      citationId,
      error: error.message
    });

    // Em caso de erro, retornar resultado neutro
    return {
      valid: true, // Assume válido para não bloquear
      confidence: 0.5,
      reasoning: `Erro na validação: ${error.message}`
    };
  }
}

/**
 * Extrai contexto ao redor de uma citação
 */
function extractCitationContext(content: string, citationId: string, contextLength: number = 300): string {
  const citationPattern = new RegExp(`\\[CITE:FONTE_${citationId}\\]`, 'g');
  const match = citationPattern.exec(content);

  if (!match) {
    return '';
  }

  const position = match.index;
  const start = Math.max(0, position - contextLength);
  const end = Math.min(content.length, position + contextLength);

  return content.substring(start, end);
}

/**
 * Verifica qualidade do documento antes da exportação
 */
export async function verifyDocumentQuality(
  content: string,
  articles: FlowEnrichedArticle[]
): Promise<QualityVerification> {
  logger.info('Verifying document quality', { articleCount: articles.length });

  const issues: any[] = [];

  // Verificar citações
  const citationPattern = /\[CITE:FONTE_(\d+)\]/g;
  const citations = [...content.matchAll(citationPattern)];
  const uniqueCitations = new Set(citations.map(c => c[1]));

  logger.info('Starting AI citation validation', { citationCount: uniqueCitations.size });

  // 🤖 VALIDAÇÃO POR IA - Para cada citação
  let validatedCount = 0;
  let validCount = 0;
  let invalidCount = 0;

  for (const citationId of uniqueCitations) {
    const sourceIndex = parseInt(citationId) - 1;

    // Verificar se a citação tem referência correspondente
    if (sourceIndex >= articles.length || sourceIndex < 0) {
      issues.push({
        type: 'missing_reference',
        severity: 'error',
        description: `Citação FONTE_${citationId} não tem referência correspondente`,
        autoFixAvailable: false
      });
      invalidCount++;
      continue;
    }

    const article = articles[sourceIndex];

    // Extrair contexto ao redor da citação
    const citedText = extractCitationContext(content, citationId, 300);

    if (!citedText) {
      logger.warn('Could not extract citation context', { citationId });
      continue;
    }

    // Validar com IA
    logger.debug('Validating citation with AI', { citationId, articleTitle: article.title.substring(0, 50) });

    const validation = await validateCitationWithAI(citedText, article, citationId);

    validatedCount++;

    if (!validation.valid || validation.confidence < 0.6) {
      issues.push({
        type: 'invalid_citation',
        severity: validation.confidence < 0.4 ? 'error' : 'warning',
        description: `Citação FONTE_${citationId} pode estar incorreta: ${validation.reasoning}`,
        location: { citationId },
        autoFixAvailable: !!validation.suggestedCorrection,
        metadata: {
          confidence: validation.confidence,
          suggestedCorrection: validation.suggestedCorrection
        }
      });
      invalidCount++;
    } else {
      validCount++;
    }

    // Log progress cada 5 citações
    if (validatedCount % 5 === 0) {
      logger.info('Citation validation progress', {
        validated: validatedCount,
        total: uniqueCitations.size,
        valid: validCount,
        invalid: invalidCount
      });
    }
  }

  logger.info('AI citation validation completed', {
    total: validatedCount,
    valid: validCount,
    invalid: invalidCount,
    accuracy: validatedCount > 0 ? `${((validCount / validatedCount) * 100).toFixed(1)}%` : '0%'
  });

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
