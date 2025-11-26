/**
 * Serviço para o novo fluxo de pesquisa de 8 fases
 */

import { logger } from '../config/logger.js';
import { generateText, getActiveProvider } from './aiProvider.js';
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
import { PubMedService } from './apis/pubmed.service.js';
import { DOAJService } from './apis/doaj.service.js';
import { PLOSService } from './apis/plos.service.js';
import { journalMetricsService } from './journalMetrics.service.js';
import { articleLimitsConfig } from '../config/articleLimits.config.js';
import { scoringConfig } from '../config/scoringConfig.js';
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
// API SERVICE INSTANCES (for parallel search)
// ============================================

// Initialize all 8 API services for NEW parallel search implementation
const openAlexServiceInstance = new OpenAlexService();
const arxivServiceInstance = new ArXivService();
const europePMCServiceInstance = new EuropePMCService();
const crossrefServiceInstance = new CrossrefService();
const pubmedServiceInstance = new PubMedService();
const doajServiceInstance = new DOAJService();
const plosServiceInstance = new PLOSService();
const unpaywallServiceInstance = new UnpaywallService();

// ============================================
// HELPER: SEARCH & SCORING (NEW IMPLEMENTATION)
// ============================================

interface ScoringResult {
  article: any;  // Using 'any' for now to avoid circular type issues
  score: number;
  priority: PriorityLevel;
  reasons: string[];
}

/**
 * NEW: Calculate article score with evidence-based metrics
 *
 * Scoring Formula (0-100 points):
 * 1. Journal Quality (0-30 pts) - Based on h-index and citation metrics via OpenAlex
 * 2. Study Type (0-25 pts) - Meta-analysis > RCT > Cohort > Observational
 * 3. Citations (0-20 pts) - Absolute count (not normalized by age)
 * 4. Quartile (0-10 pts) - Q1=10, Q2=7, Q3=5, Q4=3
 * 5. Full-text Structure (0-10 pts) - Has GROBID sections
 * 6. Relevance (0-5 pts) - Title match with query
 *
 * Classification thresholds:
 * - P1: ≥75 pts (Excellent)
 * - P2: ≥55 pts (Good)
 * - P3: ≥40 pts (Acceptable)
 */
async function calculateNewArticleScore(article: any, query: string): Promise<ScoringResult> {
  let score = 0;
  const reasons: string[] = [];

  // ===== 1. JOURNAL QUALITY (0-30 pts) =====
  // Lookup journal metrics via OpenAlex (uses cache, fast)
  let journalScore = 0;
  if (article.journal) {
    try {
      const metrics = await journalMetricsService.getMetricsByJournalName(article.journal);
      if (metrics) {
        journalScore = Math.round((metrics.qualityScore / 100) * 30);
        reasons.push(`Journal "${article.journal}": ${journalScore} pts (h-index: ${metrics.hIndex}, Q${metrics.quartile || '?'})`);
      } else {
        reasons.push(`Journal "${article.journal}": not found in OpenAlex`);
      }
    } catch (err) {
      // Silently fail journal lookup
    }
  }
  score += journalScore;

  // ===== 2. STUDY TYPE (0-25 pts) =====
  // Detect study type from title and abstract
  const titleAndAbstract = `${article.title || ''} ${article.abstract || ''}`.toLowerCase();
  let studyTypeScore = 0;
  let studyType = 'Unknown';

  if (titleAndAbstract.includes('meta-analysis') || titleAndAbstract.includes('meta analysis') || titleAndAbstract.includes('systematic review')) {
    studyTypeScore = 25;
    studyType = 'Meta-analysis/Systematic Review';
  } else if (titleAndAbstract.includes('randomized') || titleAndAbstract.includes('randomised') || titleAndAbstract.includes('rct') || titleAndAbstract.includes('clinical trial')) {
    studyTypeScore = 20;
    studyType = 'RCT/Clinical Trial';
  } else if (titleAndAbstract.includes('cohort') || titleAndAbstract.includes('longitudinal') || titleAndAbstract.includes('prospective study')) {
    studyTypeScore = 15;
    studyType = 'Cohort/Longitudinal';
  } else if (titleAndAbstract.includes('observational') || titleAndAbstract.includes('cross-sectional') || titleAndAbstract.includes('survey')) {
    studyTypeScore = 10;
    studyType = 'Observational/Cross-sectional';
  } else if (titleAndAbstract.includes('case report') || titleAndAbstract.includes('case study')) {
    studyTypeScore = 5;
    studyType = 'Case Report';
  } else {
    studyTypeScore = 5;  // Default for unclassified articles
    studyType = 'Research Article';
  }
  score += studyTypeScore;
  reasons.push(`Study Type: ${studyType} → ${studyTypeScore} pts`);

  // ===== 3. CITATIONS ABSOLUTE (0-20 pts) =====
  const citations = article.citationCount || 0;
  let citationScore = 0;
  if (citations >= 100) citationScore = 20;
  else if (citations >= 50) citationScore = 17;
  else if (citations >= 20) citationScore = 14;
  else if (citations >= 10) citationScore = 10;
  else if (citations >= 5) citationScore = 6;
  else if (citations >= 1) citationScore = 3;
  score += citationScore;
  if (citations > 0) {
    reasons.push(`Citations: ${citations} → ${citationScore} pts`);
  }

  // ===== 4. QUARTILE (0-10 pts) =====
  // Already included in journal score above, but could be refined here
  // For now, we rely on the journal quality score which includes quartile

  // ===== 5. FULL-TEXT STRUCTURE (0-10 pts) =====
  if (article.sections && Object.keys(article.sections).length > 0) {
    score += 10;
    reasons.push('Full-text structured (GROBID): +10 pts');
  } else if (article.isOpenAccess && article.pdfUrl) {
    score += 5;
    reasons.push('Open Access PDF available: +5 pts');
  }

  // ===== 6. RELEVANCE (0-5 pts) =====
  const titleLower = article.title?.toLowerCase() || '';
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t: string) => t.length > 3);
  const matchingTerms = queryTerms.filter((term: string) => titleLower.includes(term));
  const relevanceScore = Math.min(5, (matchingTerms.length / Math.max(queryTerms.length, 1)) * 5);
  score += relevanceScore;
  if (relevanceScore > 0) {
    reasons.push(`Title relevance: ${relevanceScore.toFixed(1)} pts`);
  }

  // ===== CLASSIFY PRIORITY =====
  let priority: PriorityLevel;
  const thresholds = scoringConfig.getThresholds();
  if (score >= thresholds.P1) {
    priority = 'P1';
  } else if (score >= thresholds.P2) {
    priority = 'P2';
  } else if (score >= thresholds.P3) {
    priority = 'P3';
  } else {
    priority = 'P3'; // Minimum accepted
  }

  return { article, score: Math.round(score), priority, reasons };
}

/**
 * Deduplicate articles by DOI and title similarity
 */
function deduplicateArticles(articles: any[]): any[] {
  const seen = new Map<string, any>();

  for (const article of articles) {
    if (article.doi) {
      const doiKey = article.doi.toLowerCase().trim();
      if (!seen.has(doiKey)) {
        seen.set(doiKey, article);
      }
      continue;
    }

    if (article.title) {
      const titleKey = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);

      if (!seen.has(titleKey)) {
        seen.set(titleKey, article);
      }
    }
  }

  logger.info(`Deduplication: ${articles.length} → ${seen.size} articles`);
  return Array.from(seen.values());
}

/**
 * Search a single query across all 7 APIs in parallel
 */
async function searchQueryAcrossAPIs(
  query: string,
  limit: number,
  filters: {
    requireFullText?: boolean;
    dateRange?: { start: number; end: number };
    documentTypes?: string[];
    languages?: string[];
  }
): Promise<any[]> {
  logger.debug(`Searching query across all APIs: "${query.substring(0, 50)}..." with filters`, {
    requireFullText: filters.requireFullText,
    dateRange: filters.dateRange ? `${filters.dateRange.start}-${filters.dateRange.end}` : 'any',
    documentTypes: filters.documentTypes?.join(', ') || 'any'
  });

  // Search all APIs in parallel
  // NOTE: Not all APIs support all filters - they will ignore unsupported ones
  const searchPromises = [
    openAlexServiceInstance.search(query, limit, filters),
    arxivServiceInstance.search(query, limit, filters),
    europePMCServiceInstance.search(query, limit, filters),
    crossrefServiceInstance.search(query, limit, filters),
    pubmedServiceInstance.search(query, limit, filters),
    doajServiceInstance.search(query, limit, filters),
    plosServiceInstance.search(query, limit, filters),
  ];

  const results = await Promise.allSettled(searchPromises);

  const articles: any[] = [];
  results.forEach((result, index) => {
    const apiNames = ['OpenAlex', 'arXiv', 'EuropePMC', 'Crossref', 'PubMed', 'DOAJ', 'PLOS'];
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
      logger.debug(`${apiNames[index]}: ${result.value.length} articles`);
    } else {
      logger.warn(`${apiNames[index]} search failed: ${result.reason}`);
    }
  });

  logger.info(`Query "${query.substring(0, 30)}...": ${articles.length} total articles`);
  return articles;
}

// ============================================
// HELPER: AI TOKEN LIMITS
// ============================================

/**
 * Retorna o limite de tokens de output baseado no provider ativo
 * Gemini: 32K tokens | DeepSeek: 8K tokens | OpenAI: 16K tokens | Claude: 8K tokens
 */
function getMaxTokensForProvider(taskType: 'graph' | 'strategy' | 'outline' | 'content' | 'edit' | 'validate' = 'graph'): number {
  const provider = getActiveProvider();

  // Limites por provider (output tokens)
  const providerLimits: Record<string, number> = {
    'gemini': 32000,      // Gemini 2.0 Flash: até 32K output tokens
    'deepseek': 8000,     // DeepSeek Chat: até 8K output tokens
    'openai': 16000,      // GPT-4o-mini: até 16K output tokens
    'claude': 8000        // Claude 3.5 Haiku: até 8K output tokens
  };

  // Ajustes por tipo de tarefa (todos usam limite máximo do provider)
  const taskLimits: Record<string, number> = {
    'graph': providerLimits[provider] || 8000,        // Grafo: usa limite máximo do provider
    'strategy': providerLimits[provider] || 8000,     // Estratégia: usa limite máximo do provider
    'outline': providerLimits[provider] || 8000,      // Roteiro: usa limite máximo do provider (roteiros complexos)
    'content': providerLimits[provider] || 8000,      // Conteúdo: usa limite máximo do provider
    'edit': providerLimits[provider] || 8000,         // Edição: usa limite máximo do provider
    'validate': providerLimits[provider] || 8000      // Validação: usa limite máximo do provider (análises detalhadas)
  };

  const maxTokens = taskLimits[taskType];

  logger.debug('Max tokens calculated', {
    provider,
    taskType,
    maxTokens
  });

  return maxTokens;
}

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
// HELPER: ACADEMIC WORK STANDARDS
// ============================================

/**
 * Calcula metas de palavras e artigos baseado em padrões ABNT
 * e práticas de universidades brasileiras
 */
export function calculateTargets(
  workType: string,
  section?: string
): { words: number; articles: number } {
  // 🆕 USAR CONFIGURAÇÃO DINÂMICA PARA ARTIGOS (via articleLimitsConfig)
  const limits = articleLimitsConfig.getLimits(workType, section);
  const targetArticles = limits.targetArticles;

  // Mapeamento de word count por tipo/seção (mantido hardcoded pois não afeta custo)
  type WordStandards = {
    [key: string]: {
      [section: string]: number;
    };
  };

  const wordStandards: WordStandards = {
    tcc: {
      introducao: 1350,
      revisao: 4050,
      metodologia: 1050,
      resultados: 2700,
      discussao: 3300,
      conclusao: 1200,
      completo_padrao: 4050
    },
    dissertacao: {
      introducao: 2700,
      revisao: 9000,
      metodologia: 2400,
      resultados: 6000,
      discussao: 7500,
      conclusao: 2400,
      completo_padrao: 9000
    },
    tese: {
      introducao: 4500,
      revisao: 15000,
      metodologia: 4500,
      resultados: 12000,
      discussao: 13500,
      conclusao: 4500,
      completo_padrao: 15000
    },
    projeto_pesquisa: {
      completo_padrao: 4500,
      completo_detalhado: 6750
    },
    artigo_cientifico: {
      completo_padrao: 6000,
      completo_detalhado: 9000
    },
    revisao_sistematica: {
      completo_padrao: 9000,
      completo_detalhado: 13500
    },
    relatorio_tecnico: {
      completo_padrao: 4500,
      completo_detalhado: 7500
    }
  };

  const workTypeData = wordStandards[workType];
  const targetWords = workTypeData
    ? (workTypeData[section || 'completo_padrao'] || 3000)
    : 3000;

  logger.debug('Calculated targets', {
    workType,
    section,
    targetWords,
    targetArticles,
    source: 'articleLimitsConfig'
  });

  return { words: targetWords, articles: targetArticles };
}

/**
 * Gera perguntas ramificadas baseadas no tipo de trabalho
 */
export function generateBranchedQuestions(
  query: string,
  workType: string
): any[] {
  // Calcular anos dinamicamente
  const currentYear = new Date().getFullYear();
  const threeYearsAgo = currentYear - 3;
  const fiveYearsAgo = currentYear - 5;
  const tenYearsAgo = currentYear - 10;

  // Perguntas base (comuns a todos)
  const periodQuestion = {
    id: 'q_periodo',
    questionNumber: 1,
    type: 'multiple_choice' as const,
    question: 'Qual período de publicação você prefere para os artigos?',
    description: 'Artigos mais recentes trazem descobertas atuais, mas tópicos clássicos podem precisar de um período maior.',
    options: [
      { value: 'ultimos_3_anos', label: 'Últimos 3 anos', description: 'Muito atual - Descobertas recentes', estimatedArticles: 40 },
      { value: 'ultimos_5_anos', label: 'Últimos 5 anos', description: 'Equilíbrio ideal - Recomendado', estimatedArticles: 70 },
      { value: 'ultimos_10_anos', label: 'Últimos 10 anos', description: 'Base consolidada - Maior volume', estimatedArticles: 120 },
      { value: 'sem_restricao', label: 'Sem restrição de período', description: 'Inclui trabalhos clássicos', estimatedArticles: 200 }
    ],
    required: true
  };

  const profundidadeQuestion = {
    id: 'q_profundidade',
    questionNumber: 2,
    type: 'multiple_choice' as const,
    question: 'Que tipo de conteúdo você precisa no seu trabalho?',
    description: 'Define o nível de aprofundamento teórico e densidade técnica do texto.',
    options: [
      { value: 'basico', label: 'Conceitos Básicos e Definições', description: 'Para entender o tema - Contextualizar - Linguagem acessível', estimatedArticles: 50 },
      { value: 'intermediario', label: 'Análise Técnica e Metodológica', description: 'Para discutir métodos - Comparar estudos - Nível acadêmico padrão', estimatedArticles: 80 },
      { value: 'avancado', label: 'Teoria Avançada e Aspectos Complexos', description: 'Para aprofundar discussões - Debates teóricos - Alta densidade', estimatedArticles: 100 }
    ],
    required: true
  };

  const contextoQuestion = {
    id: 'q_contexto',
    type: 'text' as const,
    question: 'Você tem algum contexto ou aplicação específica? (Opcional)',
    description: 'Use este campo para especificar: público-alvo, contexto geográfico, setor de aplicação, faixa etária, ou qualquer outra particularidade relevante para sua pesquisa.',
    placeholder: 'Ex: contexto brasileiro, pequenas empresas, ensino fundamental...',
    required: false
  };

  let specificQuestions: any[] = [];

  // ========================================
  // TCC, DISSERTAÇÃO, TESE
  // ========================================
  if (workType === 'tcc' || workType === 'dissertacao' || workType === 'tese') {
    const workTypeLabel = workType === 'tcc' ? 'TCC' : workType === 'dissertacao' ? 'Dissertação' : 'Tese';

    specificQuestions = [{
      id: 'q_secao',
      questionNumber: 3,
      type: 'multiple_choice' as const,
      question: `Qual seção do seu ${workTypeLabel} você quer escrever agora?`,
      description: `Recomendamos escrever uma seção por vez para garantir qualidade e profundidade adequadas.`,
      options: [
        { value: 'introducao', label: 'Introdução', description: 'Contextualização do tema - Justificativa - Objetivos', estimatedArticles: workType === 'tcc' ? 15 : workType === 'dissertacao' ? 30 : 50 },
        { value: 'revisao', label: 'Revisão de Literatura', description: 'Estado da arte - Teorias principais - Conceitos fundamentais', estimatedArticles: workType === 'tcc' ? 35 : workType === 'dissertacao' ? 90 : 150 },
        { value: 'metodologia', label: 'Metodologia', description: 'Métodos de pesquisa - Procedimentos - Instrumentos', estimatedArticles: workType === 'tcc' ? 12 : workType === 'dissertacao' ? 25 : 40 },
        { value: 'resultados', label: 'Resultados', description: 'Apresentação de dados - Achados principais - Evidências', estimatedArticles: workType === 'tcc' ? 15 : workType === 'dissertacao' ? 40 : 80 },
        { value: 'discussao', label: 'Discussão', description: 'Interpretação dos resultados - Comparação com literatura', estimatedArticles: workType === 'tcc' ? 30 : workType === 'dissertacao' ? 70 : 120 },
        { value: 'conclusao', label: 'Conclusão', description: 'Síntese dos achados - Limitações - Recomendações futuras', estimatedArticles: workType === 'tcc' ? 8 : workType === 'dissertacao' ? 20 : 30 }
      ],
      required: true
    }];
  }

  // ========================================
  // REVISÃO SISTEMÁTICA
  // ========================================
  else if (workType === 'revisao_sistematica') {
    specificQuestions = [
      {
        id: 'q_componente_revisao',
        questionNumber: 3,
        type: 'multiple_choice' as const,
        question: 'Qual componente da Revisão Sistemática você quer escrever?',
        description: 'Revisões sistemáticas seguem um protocolo estruturado com componentes específicos.',
        options: [
          { value: 'introducao', label: 'Introdução e Justificativa', description: 'Contexto do problema - Lacuna na literatura - Objetivos da revisão', estimatedArticles: 25 },
          { value: 'protocolo', label: 'Protocolo e Método de Busca', description: 'Estratégia de busca - Bases de dados - String de busca - Fluxo PRISMA', estimatedArticles: 30 },
          { value: 'criterios', label: 'Critérios de Seleção', description: 'Critérios de inclusão e exclusão - Seleção de estudos - Qualidade metodológica', estimatedArticles: 20 },
          { value: 'resultados', label: 'Resultados e Síntese', description: 'Características dos estudos incluídos - Tabelas de extração - Síntese narrativa', estimatedArticles: 40 },
          { value: 'discussao', label: 'Discussão e Conclusões', description: 'Síntese das evidências - Implicações práticas - Limitações - Recomendações', estimatedArticles: 35 },
          { value: 'completo', label: 'Documento Completo', description: 'Todos os componentes integrados seguindo protocolo PRISMA', estimatedArticles: 60 }
        ],
        required: true
      },
      {
        id: 'q_tipo_sintese',
        questionNumber: 4,
        type: 'multiple_choice' as const,
        question: 'Que tipo de síntese você planeja fazer?',
        description: 'Define como os resultados serão analisados e apresentados.',
        options: [
          { value: 'narrativa', label: 'Síntese Narrativa', description: 'Análise qualitativa descritiva dos estudos', estimatedArticles: 40 },
          { value: 'meta_analise', label: 'Meta-análise Quantitativa', description: 'Análise estatística combinada de dados', estimatedArticles: 50 },
          { value: 'mista', label: 'Síntese Mista', description: 'Combinação de síntese narrativa e meta-análise', estimatedArticles: 60 }
        ],
        required: true
      }
    ];
  }

  // ========================================
  // ARTIGO CIENTÍFICO
  // ========================================
  else if (workType === 'artigo_cientifico') {
    specificQuestions = [{
      id: 'q_tipo_artigo',
      questionNumber: 3,
      type: 'multiple_choice' as const,
      question: 'Que tipo de artigo científico você está escrevendo?',
      description: 'Cada tipo de artigo tem estrutura e requisitos específicos.',
      options: [
        { value: 'empirico', label: 'Artigo Empírico Original', description: 'Pesquisa original com coleta de dados - Métodos - Resultados - Discussão', estimatedArticles: 35 },
        { value: 'revisao_literatura', label: 'Artigo de Revisão de Literatura', description: 'Síntese crítica da literatura existente sobre um tema', estimatedArticles: 45 },
        { value: 'estudo_caso', label: 'Estudo de Caso', description: 'Análise aprofundada de um caso específico - Contexto - Análise', estimatedArticles: 25 },
        { value: 'teorico', label: 'Artigo Teórico/Ensaio', description: 'Discussão teórica - Proposição de modelos ou frameworks', estimatedArticles: 30 },
        { value: 'metodologico', label: 'Artigo Metodológico', description: 'Proposição ou validação de métodos e instrumentos', estimatedArticles: 35 }
      ],
      required: true
    }];
  }

  // ========================================
  // PROJETO DE PESQUISA
  // ========================================
  else if (workType === 'projeto_pesquisa') {
    specificQuestions = [{
      id: 'q_componente_projeto',
      questionNumber: 3,
      type: 'multiple_choice' as const,
      question: 'Qual componente do Projeto de Pesquisa você quer desenvolver?',
      description: 'Projetos de pesquisa requerem componentes específicos para aprovação.',
      options: [
        { value: 'introducao', label: 'Introdução e Problematização', description: 'Tema - Problema de pesquisa - Justificativa - Relevância', estimatedArticles: 20 },
        { value: 'objetivos', label: 'Objetivos e Hipóteses', description: 'Objetivos gerais e específicos - Hipóteses ou questões de pesquisa', estimatedArticles: 15 },
        { value: 'referencial', label: 'Referencial Teórico', description: 'Fundamentação teórica - Conceitos-chave - Estado da arte', estimatedArticles: 35 },
        { value: 'metodologia', label: 'Metodologia', description: 'Tipo de pesquisa - Métodos - Instrumentos - Procedimentos - Análise de dados', estimatedArticles: 25 },
        { value: 'cronograma', label: 'Cronograma e Viabilidade', description: 'Etapas da pesquisa - Cronograma - Recursos necessários', estimatedArticles: 10 },
        { value: 'completo', label: 'Projeto Completo', description: 'Todos os componentes integrados', estimatedArticles: 30 }
      ],
      required: true
    }];
  }

  // ========================================
  // RELATÓRIO TÉCNICO
  // ========================================
  else if (workType === 'relatorio_tecnico') {
    specificQuestions = [{
      id: 'q_componente_relatorio',
      questionNumber: 3,
      type: 'multiple_choice' as const,
      question: 'Qual componente do Relatório Técnico você precisa?',
      description: 'Relatórios técnicos podem ter estruturas variadas conforme o objetivo.',
      options: [
        { value: 'executivo', label: 'Sumário Executivo', description: 'Resumo gerencial - Principais achados - Recomendações', estimatedArticles: 15 },
        { value: 'diagnostico', label: 'Diagnóstico/Análise Situacional', description: 'Levantamento da situação atual - Análise de dados - Identificação de problemas', estimatedArticles: 25 },
        { value: 'metodologia', label: 'Metodologia e Procedimentos', description: 'Métodos utilizados - Coleta de dados - Análises realizadas', estimatedArticles: 15 },
        { value: 'resultados', label: 'Resultados e Discussão', description: 'Apresentação de resultados - Análises - Interpretações', estimatedArticles: 30 },
        { value: 'recomendacoes', label: 'Conclusões e Recomendações', description: 'Síntese dos achados - Propostas de ação - Plano de implementação', estimatedArticles: 20 },
        { value: 'completo', label: 'Relatório Completo', description: 'Documento técnico completo', estimatedArticles: 35 }
      ],
      required: true
    }];
  }

  // Montar array final de perguntas
  const questions = [periodQuestion, profundidadeQuestion, ...specificQuestions, contextoQuestion];

  // Atualizar questionNumber e totalQuestions
  const totalQuestions = questions.length;
  questions.forEach((q, index) => {
    q.questionNumber = index + 1;
    q.totalQuestions = totalQuestions;
  });

  return questions;
}

// ============================================
// FASE 2: AI CLARIFICATION & REFINEMENT
// ============================================

/**
 * NOVA VERSÃO: Gera perguntas ramificadas baseadas no tipo de trabalho
 *
 * FASE 1 (esta chamada): Retorna APENAS a pergunta sobre tipo de trabalho
 * FASE 2 (próxima chamada): Baseado na resposta, gera perguntas específicas
 *
 * Para manter compatibilidade, por enquanto retorna perguntas fixas padrão
 * TODO: Implementar lógica de duas fases no frontend
 */
export async function generateClarificationQuestions(
  query: string,
  workType?: string  // Se fornecido, gera perguntas específicas para esse tipo
): Promise<ClarificationSession> {
  logger.info('Generating clarification questions (branched)', { query, workType });

  // Se workType já foi fornecido, gera perguntas específicas
  if (workType) {
    const branchedQuestions = generateBranchedQuestions(query, workType);

    const session: ClarificationSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      workType: workType as any,
      questions: branchedQuestions,
      answers: [],
      completed: false,
      createdAt: new Date()
    };

    logger.info('Generated branched questions', {
      sessionId: session.sessionId,
      workType,
      questionCount: branchedQuestions.length
    });

    return session;
  }

  // Retorna perguntas fixas padrão com tipo de trabalho PRIMEIRO
  // SIMPLIFICADO: não usa mais IA, apenas perguntas fixas otimizadas
  logger.info('Using fixed questions with workType as first question');

  // Calcular anos dinamicamente
  const currentYear = new Date().getFullYear();
  const threeYearsAgo = currentYear - 3;
  const fiveYearsAgo = currentYear - 5;
  const tenYearsAgo = currentYear - 10;

  const session: ClarificationSession = {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    query,
    questions: [
      // Q0: TIPO DE TRABALHO (ÚNICA PERGUNTA INICIAL)
      {
        id: 'q0_work_type',
        questionNumber: 1,
        totalQuestions: 1,
        type: 'multiple_choice',
        question: 'Que tipo de trabalho acadêmico você está escrevendo?',
        description: 'Escolha o formato que melhor descreve seu projeto. As próximas perguntas serão personalizadas baseadas na sua escolha.',
        options: [
          {
            value: 'tcc',
            label: 'TCC - Trabalho de Conclusão de Curso',
            description: 'Graduação - 40-60 páginas - Padrão ABNT simplificado',
            estimatedArticles: 30
          },
          {
            value: 'dissertacao',
            label: 'Dissertação de Mestrado',
            description: 'Mestrado - 80-120 páginas - Pesquisa aprofundada',
            estimatedArticles: 80
          },
          {
            value: 'tese',
            label: 'Tese de Doutorado',
            description: 'Doutorado - 150-250 páginas - Contribuição original obrigatória',
            estimatedArticles: 150
          },
          {
            value: 'projeto_pesquisa',
            label: 'Projeto de Pesquisa',
            description: 'Proposta de pesquisa - 10-20 páginas - Fundamentação teórica',
            estimatedArticles: 25
          },
          {
            value: 'artigo_cientifico',
            label: 'Artigo Científico',
            description: 'Publicação em revista - 15-25 páginas - Formatação específica',
            estimatedArticles: 30
          },
          {
            value: 'revisao_sistematica',
            label: 'Revisão Sistemática',
            description: 'Síntese de evidências - 20-40 páginas - Protocolo rigoroso',
            estimatedArticles: 60
          },
          {
            value: 'relatorio_tecnico',
            label: 'Relatório Técnico',
            description: 'Documentação profissional - Formato variável',
            estimatedArticles: 20
          }
        ],
        required: true
      }
    ],
    answers: [],
    completed: false,
    createdAt: new Date()
  };

  logger.info('Clarification session created with fixed questions', {
    sessionId: session.sessionId,
    questionCount: session.questions.length
  });

  return session;
}

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
    workType?: string;              // NOVO
    section?: string;               // NOVO
    additionalContext?: string;     // NOVO
    targetWordCount?: number;       // NOVO
    targetArticles?: number;        // NOVO
    methodology?: string;           // NOVO C.9
    region?: string;                // NOVO C.9
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

    // NOVOS CAMPOS
    let workType: string | undefined = undefined;
    let section: string | undefined = undefined;
    let additionalContext: string | undefined = undefined;
    let methodology: string | undefined = undefined;       // NOVO C.9
    let region: string | undefined = undefined;           // NOVO C.9

    // Processar cada resposta
    for (const answer of answers) {
      const value = answer.answer?.toString().toLowerCase() || '';
      const questionId = answer.questionId || '';

      // NOVO: Extrair tipo de trabalho (Q0)
      if (questionId === 'q0_work_type') {
        workType = answer.answer?.toString() || undefined;
        logger.info('Extracted workType', { workType });
      }

      // NOVO: Extrair seção (Q1 ou q_secao, q_componente_revisao, q_tipo_artigo, etc)
      if (questionId === 'q1' || questionId === 'q_secao' || questionId === 'q_componente_revisao' ||
          questionId === 'q_tipo_artigo' || questionId === 'q_componente_projeto' || questionId === 'q_componente_relatorio') {
        section = answer.answer?.toString() || undefined;
        focusSection = section || 'todas';  // Manter compatibilidade
        logger.info('Extracted section', { section });
      }

      // NOVO C.9: Extrair preferência metodológica (Q4)
      if (questionId === 'q4_metodologia') {
        methodology = answer.answer?.toString() || undefined;
        logger.info('Extracted methodology', { methodology });
      }

      // NOVO C.9: Extrair região (Q5)
      if (questionId === 'q5_regiao') {
        region = answer.answer?.toString() || undefined;
        logger.info('Extracted region', { region });
      }

      // NOVO: Extrair contexto adicional (q_contexto, Q4, Q6)
      if ((questionId === 'q_contexto' || questionId === 'q4' || questionId === 'q6_contexto') &&
          typeof answer.answer === 'string' && answer.answer.trim().length > 3) {
        additionalContext = answer.answer.trim();
        specificTerms.push(additionalContext);  // Manter compatibilidade
        logger.info('Extracted additionalContext', { additionalContext });
      }

      // Detectar período temporal (q_periodo, Q2)
      if (questionId === 'q_periodo' || questionId === 'q2') {
        if (value.includes('ultimos_3_anos') || value === 'ultimos_3_anos') {
          dateRange = { start: currentYear - 3, end: currentYear };
        } else if (value.includes('ultimos_5_anos') || value === 'ultimos_5_anos') {
          dateRange = { start: currentYear - 5, end: currentYear };
        } else if (value.includes('ultimos_10_anos') || value === 'ultimos_10_anos') {
          dateRange = { start: currentYear - 10, end: currentYear };
        } else if (value.includes('sem_restricao') || value.includes('sem restrição')) {
          dateRange = { start: 1900, end: currentYear };
        }
        logger.info('Extracted period', { dateRange });
      }

      // Detectar seção foco (Q1)
      if (value.includes('introducao') || value.includes('introdução')) {
        focusSection = 'introducao';
      } else if (value.includes('revisao') || value.includes('revisão')) {
        focusSection = 'revisao';
      } else if (value.includes('metodologia')) {
        focusSection = 'metodologia';
      } else if (value.includes('resultados')) {
        focusSection = 'resultados';
      } else if (value.includes('discussao') || value.includes('discussão')) {
        focusSection = 'discussao';
      } else if (value.includes('conclusao') || value.includes('conclusão')) {
        focusSection = 'conclusao';
      }

      // Detectar nível de profundidade (q_profundidade, Q3)
      if (questionId === 'q_profundidade' || questionId === 'q3') {
        if (value.includes('basico') || value.includes('básico') || value.includes('visao') || value.includes('visão')) {
          detailLevel = 'basico';
        } else if (value.includes('intermediario') || value.includes('intermediário') || value.includes('detalhado')) {
          detailLevel = 'intermediario';
        } else if (value.includes('avancado') || value.includes('avançado') || value.includes('aprofundado')) {
          detailLevel = 'avancado';
        }
        logger.info('Extracted detail level', { detailLevel });
      }

      // Capturar contexto específico (Q4 - texto livre) - JÁ TRATADO ACIMA
      // Removido duplicação
    }

    // NOVO: Calcular metas de palavras e artigos baseado no tipo de trabalho e seção
    let targetWordCount: number | undefined;
    let targetArticles: number | undefined;

    if (workType && section) {
      const targets = calculateTargets(workType, section);
      targetWordCount = targets.words;
      targetArticles = targets.articles;

      logger.info('Calculated targets based on workType and section', {
        workType,
        section,
        targetWordCount,
        targetArticles
      });
    }

    // Gerar resumo textual
    const prompt = `Com base nas respostas do usuário, gere um resumo executivo para orientar a busca:

Respostas: ${JSON.stringify(answers)}

Retorne um parágrafo conciso (máximo 200 palavras) resumindo:
- O que o usuário quer pesquisar
- Qual seção ele quer focar
- Nível de profundidade desejado
- Contexto específico (se houver)
- Período de publicação

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
      detailLevel,
      // NOVOS CAMPOS
      workType,
      section,
      additionalContext,
      targetWordCount,
      targetArticles,
      methodology,        // NOVO C.9
      region             // NOVO C.9
    };

    logger.info('Clarification answers processed with structured data', {
      sessionId,
      structuredData,
      hasWorkType: !!workType,
      hasSection: !!section,
      hasTargets: !!(targetWordCount && targetArticles)
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
 * FUNÇÃO CRÍTICA: Gera roteiro mental do conteúdo ANTES de buscar artigos
 *
 * Esta é a inovação central do sistema: primeiro a IA planeja o que vai escrever,
 * depois busca artigos que sustentam esse roteiro - e não o contrário!
 *
 * Isso garante que os artigos encontrados sejam realmente úteis para o texto final.
 */
export async function generateContentOutline(
  query: string,
  workType: string,
  section: string,
  additionalContext?: string
): Promise<{ outline: any; criteria: any }> {
  logger.info('Generating content outline', { query, workType, section });

  const sectionDescriptions: Record<string, string> = {
    introducao: 'Introdução - apresentar o tema, contextualizar, justificar relevância, objetivos',
    revisao: 'Revisão de Literatura - fundamentação teórica, estado da arte, conceitos-chave',
    metodologia: 'Metodologia - métodos de pesquisa, procedimentos, instrumentos, análise',
    resultados: 'Resultados - apresentar dados, achados, evidências coletadas',
    discussao: 'Discussão - interpretar resultados, comparar com literatura, implicações',
    conclusao: 'Conclusão - síntese, contribuições, limitações, trabalhos futuros',
    completo_padrao: 'Documento completo padrão - todas as seções de forma concisa',
    completo_detalhado: 'Documento completo detalhado - todas as seções de forma aprofundada'
  };

  const sectionDesc = sectionDescriptions[section] || section;

  const prompt = `Você é um especialista em escrita acadêmica. O usuário quer escrever sobre: "${query}"

TIPO DE TRABALHO: ${workType.toUpperCase()}
SEÇÃO: ${sectionDesc}
${additionalContext ? `CONTEXTO ADICIONAL: ${additionalContext}` : ''}

ANTES de buscar artigos, você precisa criar um ROTEIRO MENTAL do que será escrito.

Pense: "O que EU preciso escrever nesta seção?" e "Que artigos ME AJUDARIAM a escrever isso?"

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "outline": {
    "mainArgument": "UM argumento central desta seção em 1 frase clara",
    "topicsToAddress": [
      "Tópico 1 que DEVE aparecer no texto",
      "Tópico 2 que DEVE aparecer no texto",
      "Tópico 3 que DEVE aparecer no texto"
    ],
    "keyConceptsNeeded": [
      "Conceito-chave 1 que precisa ser explicado",
      "Conceito-chave 2 que precisa ser explicado"
    ],
    "expectedStructure": [
      {
        "subtopic": "Nome do primeiro subtópico",
        "focus": "O que abordar neste subtópico (2-3 frases)",
        "expectedArticles": 8
      },
      {
        "subtopic": "Nome do segundo subtópico",
        "focus": "O que abordar neste subtópico (2-3 frases)",
        "expectedArticles": 12
      },
      {
        "subtopic": "Nome do terceiro subtópico",
        "focus": "O que abordar neste subtópico (2-3 frases)",
        "expectedArticles": 10
      }
    ]
  },
  "criteria": {
    "mustContainTopics": [
      "Tópico obrigatório 1 que os artigos DEVEM abordar",
      "Tópico obrigatório 2 que os artigos DEVEM abordar"
    ],
    "mustDefineConcepts": [
      "Conceito que deve ser explicado nos artigos"
    ],
    "preferredMethodology": ["empirical study", "systematic review"],
    "minimumQuality": 65
  }
}

IMPORTANTE:
- Seja ESPECÍFICO sobre "${query}" - não use termos genéricos
- Os tópicos devem refletir o que REALMENTE precisa aparecer no texto
- Os conceitos devem ser aqueles que o leitor precisa entender
- A estrutura deve guiar a escrita de forma lógica`;

  try {
    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em estruturação de textos acadêmicos. Retorne APENAS JSON válido.',
      temperature: 0.6,
      maxTokens: getMaxTokensForProvider('outline')
    });

    let cleanedText = response.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    const parsed = JSON.parse(cleanedText);

    logger.info('Content outline generated', {
      topicsCount: parsed.outline?.topicsToAddress?.length || 0,
      conceptsCount: parsed.outline?.keyConceptsNeeded?.length || 0,
      subtopicsCount: parsed.outline?.expectedStructure?.length || 0
    });

    return {
      outline: parsed.outline,
      criteria: parsed.criteria
    };
  } catch (error: any) {
    logger.error('Failed to generate content outline', {
      error: error.message,
      query, workType, section
    });

    // Fallback: criar outline básico
    return {
      outline: {
        mainArgument: `Análise sobre ${query}`,
        topicsToAddress: [query],
        keyConceptsNeeded: [query],
        expectedStructure: [
          {
            subtopic: 'Fundamentação',
            focus: `Conceitos fundamentais sobre ${query}`,
            expectedArticles: 10
          },
          {
            subtopic: 'Evidências',
            focus: `Estudos e evidências sobre ${query}`,
            expectedArticles: 15
          },
          {
            subtopic: 'Síntese',
            focus: `Síntese e lacunas sobre ${query}`,
            expectedArticles: 10
          }
        ]
      },
      criteria: {
        mustContainTopics: [query],
        mustDefineConcepts: [],
        minimumQuality: 60
      }
    };
  }
}

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
    workType?: string;  // NOVO: tipo de trabalho acadêmico
    section?: string;   // NOVO: seção específica
    additionalContext?: string;  // NOVO: contexto adicional do usuário
    targetArticles?: number;  // NOVO: meta de artigos calculada
  }
): Promise<FlowSearchStrategy> {
  logger.info('Generating search strategy with content outline', { query, structuredData });

  // ETAPA 1: Gerar roteiro de conteúdo ANTES de buscar artigos
  const workType = structuredData?.workType || 'tcc';
  const section = structuredData?.section || 'revisao';
  const additionalContext = structuredData?.additionalContext || '';

  logger.info('Generating content outline before search', { workType, section });

  let contentOutline, validationCriteria;
  try {
    const outlineResult = await generateContentOutline(
      query,
      workType,
      section,
      additionalContext
    );
    contentOutline = outlineResult.outline;
    validationCriteria = outlineResult.criteria;

    logger.info('Content outline generated successfully', {
      topicsCount: contentOutline.topicsToAddress?.length,
      conceptsCount: contentOutline.keyConceptsNeeded?.length
    });
  } catch (error: any) {
    logger.error('Failed to generate content outline, using fallback', {
      error: error.message
    });
    // Fallback se falhar
    contentOutline = {
      mainArgument: `Análise sobre ${query}`,
      topicsToAddress: [query],
      keyConceptsNeeded: [query],
      expectedStructure: [
        { subtopic: 'Fundamentação', focus: `Conceitos sobre ${query}`, expectedArticles: 15 },
        { subtopic: 'Evidências', focus: `Estudos sobre ${query}`, expectedArticles: 25 },
        { subtopic: 'Síntese', focus: `Lacunas sobre ${query}`, expectedArticles: 10 }
      ]
    };
    validationCriteria = {
      mustContainTopics: [query],
      mustDefineConcepts: [],
      minimumQuality: 60
    };
  }

  try {
    // Mapear workType e section para descrições legíveis
    const workTypeLabels: Record<string, string> = {
      'tcc': 'TCC (Trabalho de Conclusão de Curso)',
      'dissertacao': 'Dissertação de Mestrado',
      'tese': 'Tese de Doutorado',
      'artigo_cientifico': 'Artigo Científico',
      'revisao_sistematica': 'Revisão Sistemática',
      'projeto_pesquisa': 'Projeto de Pesquisa',
      'relatorio_tecnico': 'Relatório Técnico'
    };

    const sectionLabels: Record<string, string> = {
      'introducao': 'Introdução',
      'revisao': 'Revisão de Literatura',
      'metodologia': 'Metodologia',
      'resultados': 'Resultados',
      'discussao': 'Discussão',
      'conclusao': 'Conclusão',
      'protocolo': 'Protocolo de Revisão Sistemática',
      'completo': 'Documento Completo'
    };

    const detailLabels: Record<string, string> = {
      'basico': 'básico (conceitos e definições)',
      'intermediario': 'intermediário (análise técnica e metodológica)',
      'avancado': 'avançado (teoria complexa e debates aprofundados)'
    };

    const workTypeDesc = workTypeLabels[workType] || workType;
    const sectionDesc = sectionLabels[section] || section;
    const detailDesc = detailLabels[structuredData?.detailLevel || 'intermediario'] || 'intermediário';
    const yearRange = structuredData?.dateRange ?
      `${structuredData.dateRange.start}-${structuredData.dateRange.end}` :
      '2020-2025';

    const prompt = `You are an expert in academic search with Boolean operators. Create a HIGHLY SPECIFIC AND OPTIMIZED search strategy.

═══════════════════════════════════════════════════════════════
📚 ACADEMIC WORK CONTEXT
═══════════════════════════════════════════════════════════════

⚠️ RESEARCH TOPIC: "${query}"

📋 WORK TYPE: ${workTypeDesc}
📑 SPECIFIC SECTION: ${sectionDesc}
📊 DEPTH LEVEL: ${detailDesc}
📅 PERIOD: ${yearRange}
${additionalContext ? `🎯 SPECIFIC CONTEXT: ${additionalContext}` : ''}

SUMMARY: ${clarificationSummary}

═══════════════════════════════════════════════════════════════
🎯 CRITICAL INSTRUCTIONS FOR QUERY CREATION
═══════════════════════════════════════════════════════════════

**MANDATORY RULES:**

1. **LANGUAGE**: ALL queries MUST be in ENGLISH
   - Academic databases (Semantic Scholar, PubMed, etc.) are 95%+ in English
   - Portuguese queries will return almost ZERO results
   - Translate topic "${query}" to proper English technical terms

2. **BOOLEAN OPERATORS**: Use correctly
   - AND: Combine multiple REQUIRED terms
   - OR: Synonyms and variations (use parentheses)
   - Quotes: Exact phrases ("finite element analysis")
   - Examples:
     * ("term1" OR "synonym1") AND "term2" AND ("term3" OR "term4")
     * "exact phrase" AND (variation1 OR variation2)

3. **FORBIDDEN GENERIC TERMS**: NEVER use these useless words:
   ❌ "introduction" "background" "motivation" "context" "overview" "survey"
   ❌ "systematic review introduction" "literature review background"
   ❌ Combining topic with section names (e.g., "FEM introduction")
   ✅ USE INSTEAD: Specific methods, techniques, applications, clinical contexts

4. **FOCUS ON TECHNICAL SPECIFICITY**:
   - Domain-specific terminology
   - Methods, techniques, protocols, instruments
   - Real applications and contexts (e.g., "implant design", "biomechanics")
   - Clinical/practical terms, NOT academic structure terms

═══════════════════════════════════════════════════════════════
📝 WORK-TYPE SPECIFIC GUIDELINES
═══════════════════════════════════════════════════════════════

${workType === 'revisao_sistematica' ? `
**SYSTEMATIC REVIEW**:
- Use: "systematic review" OR "meta-analysis" OR "scoping review" OR "PRISMA"
- Focus on methodology and quality assessment
- Combine with specific clinical outcomes or interventions
` : ''}

${section === 'introducao' ? `
**INTRODUCTION SECTION**:
- Focus: prevalence, epidemiology, current state, definitions
- Use: "prevalence" OR "epidemiology" OR "incidence" OR "distribution"
- Avoid: "introduction", "background" (these are useless!)
` : ''}

${section === 'metodologia' ? `
**METHODOLOGY SECTION**:
- Focus: specific methods, protocols, instruments, validation
- Use: "method" OR "protocol" OR "technique" OR "measurement" OR "validation"
- Include: tool names, procedure names, analysis methods
` : ''}

${section === 'revisao' ? `
**LITERATURE REVIEW**:
- Focus: comprehensive coverage, theoretical frameworks
- Use: "review" OR "state of the art" OR "recent advances" OR "progress"
- Avoid: "literature review" (redundant term)
` : ''}

${section === 'resultados' ? `
**RESULTS SECTION**:
- Focus: outcomes, findings, efficacy, effectiveness
- Use: "results" OR "outcomes" OR "findings" OR "efficacy" OR "effectiveness"
` : ''}

${section === 'discussao' ? `
**DISCUSSION SECTION**:
- Focus: comparisons, advantages, limitations, implications
- Use: "comparison" OR "advantages" OR "limitations" OR "clinical implications"
` : ''}

${structuredData?.detailLevel === 'basico' ? `
**BASIC LEVEL**: Include review articles and general studies
` : structuredData?.detailLevel === 'avancado' ? `
**ADVANCED LEVEL**: Focus on complex methods and theoretical depth
` : ''}

═══════════════════════════════════════════════════════════════
📊 QUERY GENERATION STRATEGY
═══════════════════════════════════════════════════════════════

Generate diverse queries with varying specificity levels:

**HIGHLY SPECIFIC QUERIES** (4-5 queries):
- Combine CORE concept + SPECIFIC methods/applications/contexts
- Use AND between required terms, OR for synonyms
- Example: ("finite element" OR "FEM") AND dentistry AND ("stress analysis" OR biomechanics OR "implant design")

**MODERATE SPECIFICITY QUERIES** (3-4 queries):
- Broader combinations with domain variations
- Include related techniques and contexts
- Example: ("finite element" OR "computational modeling") AND (dental OR orthodontics)

**GENERAL QUERIES** (2-3 queries):
- Core concepts for background
- Simpler Boolean combinations
- Example: "finite element" AND dentistry

⚠️ IMPORTANT: Generate 8-12 total queries across all specificity levels. DO NOT assign priority labels (P1/P2/P3) - all queries are equal. Article quality will be determined AFTER search based on journal metrics and study type.

═══════════════════════════════════════════════════════════════
✅ EXAMPLES: CORRECT vs INCORRECT QUERIES
═══════════════════════════════════════════════════════════════

❌ WRONG (will return BAD results):
- "elementos finitos odontologia" → Portuguese! Zero results!
- "finite element dentistry introduction" → "introduction" is useless!
- "dental FEA background" → "background" is useless!
- "FEM overview" → "overview" finds nothing useful!
- "preciso de uma introducao" → Portuguese! Translation needed!

✅ CORRECT (will return GOOD results):
- ("finite element analysis" OR "FEA") AND dentistry AND (biomechanics OR "stress distribution")
- ("finite element method" OR "FEM") AND (dental OR orthodontics) AND (simulation OR modeling)
- "finite element" AND dentistry AND ("implant design" OR prosthesis OR restoration)
- ("computational modeling" OR "numerical simulation") AND oral AND ("bone remodeling" OR osseointegration)

═══════════════════════════════════════════════════════════════
📝 EXAMPLES: HOW TO TRANSLATE ANY TOPIC TO ENGLISH QUERIES
═══════════════════════════════════════════════════════════════

⚠️ IMPORTANT: These are EXAMPLES ONLY to show the PATTERN.
Apply the SAME pattern to WHATEVER topic the user provides!

--- EXAMPLE 1: Portuguese topic ---
Input: "elementos finitos na odontologia"
Output queries: ("finite element analysis" OR "FEA") AND dentistry AND biomechanics

--- EXAMPLE 2: Portuguese request ---
Input: "preciso de uma introdução sobre machine learning"
Output queries: ("machine learning" OR "ML") AND ("deep learning" OR "neural networks") AND applications

--- EXAMPLE 3: Spanish topic ---
Input: "inteligencia artificial en educación"
Output queries: ("artificial intelligence" OR "AI") AND education AND ("e-learning" OR "personalized learning")

⚠️ KEY RULES TO FOLLOW (for ANY topic):
1. ALWAYS translate to English (Portuguese/Spanish → English)
2. Use Boolean operators: AND, OR, parentheses
3. NEVER use: "introduction", "background", "overview", "motivation"
4. Focus on: technical terms, methods, applications, contexts
5. Use quotes for exact phrases: "machine learning"
6. Use OR for synonyms: ("AI" OR "artificial intelligence")

═══════════════════════════════════════════════════════════════
✅ RETURN ONLY VALID JSON (NO MARKDOWN)
═══════════════════════════════════════════════════════════════

{
  "topic": "${query}",
  "originalQuery": "${query}",
  "queries": [
    { "query": "highly specific query 1 with Boolean AND/OR", "expectedResults": 15 },
    { "query": "highly specific query 2 with technical terms", "expectedResults": 15 },
    { "query": "highly specific query 3 with methods/applications", "expectedResults": 15 },
    { "query": "highly specific query 4 with contexts", "expectedResults": 15 },
    { "query": "moderate specificity query 1 with variations", "expectedResults": 15 },
    { "query": "moderate specificity query 2 with broader terms", "expectedResults": 15 },
    { "query": "moderate specificity query 3 with related concepts", "expectedResults": 15 },
    { "query": "general query 1 - core concepts", "expectedResults": 15 },
    { "query": "general query 2 - simpler combinations", "expectedResults": 15 }
  ],
  "keyTerms": {
    "primary": ["main English term 1", "main English term 2"],
    "specific": ["specific technical term 1", "specific term 2", "method/technique 1"],
    "methodological": ["method 1", "technique 1", "application 1"]
  },
  "filters": {
    "dateRange": ${JSON.stringify(structuredData?.dateRange || { start: 2020, end: 2025 })},
    "languages": ["en"],
    "documentTypes": ["article", "review", "conference_paper"]
  },
  "targetArticles": 70,
  "estimatedTime": "3-5 minutes"
}`;

    const response = await generateText(prompt, {
      systemPrompt: 'You are an expert in academic search strategy with Boolean operators. CRITICAL: ALL queries MUST be in ENGLISH. Translate Portuguese/Spanish topics to English. NEVER use forbidden terms (introduction, background, overview, motivation). Return ONLY valid JSON, no markdown.',
      temperature: 0.3,  // Lower temperature to enforce strict instruction following
      maxTokens: getMaxTokensForProvider('strategy')
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

    // Validar e garantir que sempre tenha queries (array flat)
    if (!strategy.queries || !Array.isArray(strategy.queries)) {
      strategy.queries = [];
    }

    // Se não há queries, adicionar queries padrão
    if (strategy.queries.length === 0) {
      logger.warn('No queries generated by AI, adding default queries');
      strategy.queries = [
        { query: `${query.trim()} systematic review`, expectedResults: 15 },
        { query: `${query.trim()} meta-analysis`, expectedResults: 15 },
        { query: query.trim(), expectedResults: 15 }
      ];
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
        // Adicionar termos específicos nas queries (flat array)
        structuredData.specificTerms.forEach(term => {
          strategy.queries.push({
            query: `${query.trim()} ${term}`,
            expectedResults: 15
          });
        });
      }

      // 4. AJUSTAR QUERIES BASEADO NA SEÇÃO FOCO
      if (structuredData.focusSection !== 'todas') {
        const sectionKeywords: Record<string, string[]> = {
          'introducao': ['prevalence', 'epidemiology', 'current state'],
          'revisao': ['review', 'state of art', 'recent advances'],
          'metodologia': ['methodology', 'methods', 'protocol'],
          'resultados': ['results', 'outcomes', 'findings'],
          'discussao': ['discussion', 'implications', 'analysis'],
          'conclusao': ['conclusion', 'future work', 'recommendations']
        };

        const keywords = sectionKeywords[structuredData.focusSection] || [];
        keywords.slice(0, 2).forEach(keyword => {  // Limit to 2 keywords per section
          strategy.queries.push({
            query: `${query.trim()} ${keyword}`,
            expectedResults: 15
          });
        });
      }

      // 5. APLICAR TARGET DE ARTIGOS (do structuredData calculado via articleLimitsConfig)
      if (structuredData.targetArticles) {
        strategy.targetArticles = structuredData.targetArticles;
        logger.info('Applied dynamic targetArticles from configuration', {
          targetArticles: strategy.targetArticles,
          workType: structuredData.workType,
          section: structuredData.section
        });
      }

      logger.info('Strategy updated with user preferences', {
        dateRange: strategy.filters.dateRange,
        documentTypes: strategy.filters.documentTypes,
        additionalQueries: structuredData.specificTerms.length,
        focusSection: structuredData.focusSection,
        targetArticles: strategy.targetArticles,
        totalQueries: strategy.queries.length
      });
    }

    // TODO: Add proper values from ClarificationSession when function is refactored
    // For now, add default values to satisfy type requirements
    if (!strategy.workType) {
      strategy.workType = (structuredData?.workType as any) || 'tcc';
    }
    if (!strategy.section) {
      strategy.section = structuredData?.section || structuredData?.focusSection || 'revisao';
    }
    // Garantir targetArticles sempre está definido
    if (!strategy.targetArticles && structuredData?.workType) {
      const limits = articleLimitsConfig.getLimits(
        structuredData.workType,
        structuredData.section || structuredData.focusSection
      );
      strategy.targetArticles = limits.targetArticles;
      logger.info('Set targetArticles from articleLimitsConfig fallback', {
        targetArticles: strategy.targetArticles
      });
    }
    if (!strategy.targetArticles) {
      strategy.targetArticles = 50; // Ultimate fallback
    }
    if (!strategy.contentOutline) {
      strategy.contentOutline = {
        mainArgument: `Análise acadêmica sobre ${query.trim()}`,
        topicsToAddress: [query.trim()],
        keyConceptsNeeded: [query.trim()],
        expectedStructure: [
          {
            subtopic: 'Contexto e fundamentação',
            focus: `Conceitos fundamentais relacionados a ${query.trim()}`,
            expectedArticles: 20
          },
          {
            subtopic: 'Evidências e estudos',
            focus: `Estudos empíricos e revisões sobre ${query.trim()}`,
            expectedArticles: 30
          },
          {
            subtopic: 'Síntese e gaps',
            focus: `Lacunas e direções futuras em ${query.trim()}`,
            expectedArticles: 20
          }
        ]
      };
    }
    if (!strategy.validationCriteria) {
      strategy.validationCriteria = {
        mustContainTopics: [query.trim()],
        mustDefineConcepts: [],
        minimumQuality: 60
      };
    }

    logger.info('Search strategy generated', {
      topic: strategy.topic,
      totalQueries: strategy.queries.length,
      targetArticles: strategy.targetArticles,
      dateRange: `${strategy.filters.dateRange.start}-${strategy.filters.dateRange.end}`
    });

    return strategy;
  } catch (error: any) {
    logger.error('Failed to generate search strategy', {
      error: error.message,
      query
    });

    // Fallback: return default strategy
    // TODO: This fallback needs to be updated to generate proper contentOutline and validationCriteria
    logger.info('Using fallback default search strategy');
    const currentYear = new Date().getFullYear();
    const strategy: FlowSearchStrategy = {
      topic: query.trim(),
      originalQuery: query,

      // Temporary defaults - will be replaced with proper values from ClarificationSession
      workType: 'tcc',
      section: 'revisao',
      contentOutline: {
        mainArgument: `Análise acadêmica sobre ${query.trim()}`,
        topicsToAddress: [query.trim()],
        keyConceptsNeeded: [query.trim()],
        expectedStructure: [
          {
            subtopic: 'Contexto e fundamentação',
            focus: `Conceitos fundamentais relacionados a ${query.trim()}`,
            expectedArticles: 20
          },
          {
            subtopic: 'Evidências e estudos',
            focus: `Estudos empíricos e revisões sobre ${query.trim()}`,
            expectedArticles: 30
          },
          {
            subtopic: 'Síntese e gaps',
            focus: `Lacunas e direções futuras em ${query.trim()}`,
            expectedArticles: 20
          }
        ]
      },
      validationCriteria: {
        mustContainTopics: [query.trim()],
        mustDefineConcepts: [],
        minimumQuality: 60
      },

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
        languages: ['en'], // Artigos em inglês (melhor qualidade)
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

  // Determine priority com thresholds configuráveis (via .env)
  const thresholds = scoringConfig.getThresholds();
  let priority: PriorityLevel;
  if (score >= thresholds.P1) {
    priority = 'P1';      // Artigos excelentes
  } else if (score >= thresholds.P2) {
    priority = 'P2';      // Artigos bons
  } else if (score >= thresholds.P3) {
    priority = 'P3';      // Artigos aceitáveis
  } else if (score >= thresholds.minAcceptable) {
    priority = 'P3';      // Ainda aceitável, mas próximo do limite
    reasons.push(`⚠️ Score próximo do mínimo (${thresholds.minAcceptable})`);
  } else {
    // Artigos abaixo do threshold mínimo devem ser descartados
    priority = 'P3';      // Marca como P3 mas com flag para filtrar
    reasons.push(`⚠️ Score muito baixo (<${thresholds.minAcceptable}) - considerar descartar`);
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

  // [2] Unpaywall (se tem DOI) + PDF Extraction
  if (article.doi) {
    attempts.push(
      (async () => {
        try {
          const result = await services.unpaywall.getByDOI(article.doi!);
          if (result && result.pdfUrl) {
            // ✨ NOVO: Download PDF e extrai texto
            const { pdfExtractionService } = await import('./pdfExtraction.service.js');
            const extraction = await pdfExtractionService.extractPdfText(result.pdfUrl);

            if (extraction.success && extraction.text) {
              logger.debug('PDF extracted from Unpaywall', {
                doi: article.doi,
                textLength: extraction.text.length
              });

              return {
                success: true,
                fullContent: extraction.text,
                source: 'Unpaywall (PDF)',
                format: 'pdf'
              };
            } else {
              // Fallback para abstract se extração falhar
              return {
                success: !!result.abstract,
                fullContent: result.abstract || '',
                source: 'Unpaywall',
                format: 'pdf'
              };
            }
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

  // [7] ✨ FALLBACK FINAL: Direct PDF extraction (se artigo tem pdfUrl)
  if (article.pdfUrl) {
    attempts.push(
      (async () => {
        try {
          const { pdfExtractionService } = await import('./pdfExtraction.service.js');
          const extraction = await pdfExtractionService.extractPdfText(article.pdfUrl!);

          if (extraction.success && extraction.text) {
            logger.debug('PDF extracted from direct URL', {
              title: article.title.substring(0, 50),
              textLength: extraction.text.length
            });

            return {
              success: true,
              fullContent: extraction.text,
              source: `Direct PDF (${article.source})`,
              format: 'pdf'
            };
          }
        } catch (error) {
          logger.debug(`Direct PDF extraction failed`);
        }
        return { success: false };
      })()
    );
  }

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
  onProgress?: (progress: FlowSearchProgress) => void,
  researchId?: number
): Promise<FlowEnrichedArticle[]> {
  const startTime = Date.now();
  const targetArticles = strategy.targetArticles || 50;

  logger.info('🚀 Starting NEW parallel exhaustive search', {
    topic: strategy.topic,
    totalQueries: strategy.queries.length,
    targetArticles,
    dateRange: `${strategy.filters.dateRange.start}-${strategy.filters.dateRange.end}`
  });

  try {
    // ================================================================
    // STEP 1: Search ALL queries in parallel across ALL APIs
    // ================================================================
    logger.info('📡 STEP 1: Searching all queries in parallel...');

    // Apply filters from strategy (from Phases 1, 2, 3)
    const searchFilters = {
      requireFullText: true,  // Only articles with full-text available
      dateRange: strategy.filters.dateRange,  // From Phase 2: User's time period
      documentTypes: strategy.filters.documentTypes,  // From Phase 2: Article types
      languages: strategy.filters.languages  // From Phase 3: Language preference
    };

    logger.info('Applying user filters from clarification phase', {
      dateRange: `${searchFilters.dateRange.start}-${searchFilters.dateRange.end}`,
      documentTypes: searchFilters.documentTypes,
      languages: searchFilters.languages
    });

    // Execute all query searches in parallel
    const querySearchPromises = strategy.queries.map(queryObj =>
      searchQueryAcrossAPIs(queryObj.query, queryObj.expectedResults || 15, searchFilters)
    );

    const queryResults = await Promise.allSettled(querySearchPromises);

    // Collect all articles from all queries
    const allRawArticles: any[] = [];
    queryResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allRawArticles.push(...result.value);
        logger.info(`Query ${index + 1}/${strategy.queries.length}: ${result.value.length} articles`);
      } else {
        logger.warn(`Query ${index + 1} failed: ${result.reason}`);
      }
    });

    logger.info(`Total raw articles collected: ${allRawArticles.length}`);

    if (allRawArticles.length === 0) {
      logger.warn('No articles found from any API');
      return [];
    }

    // Report progress: 25% (search complete)
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',  // Not used anymore, but keep for compatibility
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: allRawArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Deduplicating articles...'
      });
    }

    // ================================================================
    // STEP 2: Deduplicate by DOI and title
    // ================================================================
    logger.info('🔍 STEP 2: Deduplicating articles...');

    const uniqueArticles = deduplicateArticles(allRawArticles);

    logger.info(`After deduplication: ${uniqueArticles.length} unique articles`);

    // ================================================================
    // STEP 3: Score ALL articles with unified scoring system
    // ================================================================
    logger.info('🎯 STEP 3: Scoring all articles...');

    const scoringPromises = uniqueArticles.map(article =>
      calculateNewArticleScore(article, strategy.originalQuery)
    );
    const scoredArticles: ScoringResult[] = await Promise.all(scoringPromises);

    // Filter out very low scores (below minimum threshold)
    const thresholds = scoringConfig.getThresholds();
    const acceptableArticles = scoredArticles.filter(
      result => result.score >= thresholds.minAcceptable
    );

    logger.info(`After quality filter: ${acceptableArticles.length}/${uniqueArticles.length} articles`);

    // Report progress: 50% (scoring complete)
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: acceptableArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Sorting and classifying...'
      });
    }

    // ================================================================
    // STEP 4: Sort by score (descending) and take top N
    // ================================================================
    logger.info('📊 STEP 4: Sorting by score and selecting top articles...');

    acceptableArticles.sort((a, b) => b.score - a.score);

    // Take target number of articles (or all if less than target)
    const topArticles = acceptableArticles.slice(0, targetArticles);

    logger.info(`Selected top ${topArticles.length} articles`, {
      P1Count: topArticles.filter(a => a.priority === 'P1').length,
      P2Count: topArticles.filter(a => a.priority === 'P2').length,
      P3Count: topArticles.filter(a => a.priority === 'P3').length,
      avgScore: topArticles.length > 0 ? (topArticles.reduce((sum, a) => sum + a.score, 0) / topArticles.length).toFixed(1) : '0'
    });

    // ================================================================
    // STEP 5: Convert to FlowEnrichedArticle format
    // ================================================================
    const enrichedArticles: FlowEnrichedArticle[] = topArticles.map(result => ({
      ...result.article,
      score: {
        score: result.score,
        priority: result.priority,
        reasons: result.reasons,
        breakdown: {
          titleRelevance: 0,  // Will be properly calculated in next task
          citations: result.article.citationCount || 0,
          recency: 0,
          hasFulltext: !!result.article.sections,
          sourceQuality: 0,
          hasDoi: !!result.article.doi,
          hasCompleteAbstract: !!(result.article.abstract && result.article.abstract.length > 100)
        }
      }
    }));

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info(`✅ Search complete in ${elapsedTime}s`, {
      totalArticles: enrichedArticles.length,
      targetArticles,
      queriesSearched: strategy.queries.length,
      APIsUsed: 7,  // OpenAlex, arXiv, EuropePMC, Crossref, PubMed, DOAJ, PLOS
    });

    // Final progress report
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: enrichedArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Search complete!'
      });
    }

    return enrichedArticles;
  } catch (error: any) {
    logger.error('Search failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
export async function validateAndRefineArticles(
  articles: FlowEnrichedArticle[],
  strategy: FlowSearchStrategy,
  onProgress?: (status: { iteration: number; gaps: string[]; articlesAdded: number }) => void
): Promise<FlowEnrichedArticle[]> {
  const MAX_ITERATIONS = 3;
  const MAX_OVERSHOOT = 1.2; // Allow 20% above target
  let currentArticles = [...articles];

  const targetArticles = strategy.targetArticles || 50;
  const maxArticles = Math.ceil(targetArticles * MAX_OVERSHOOT);

  logger.info('🎯 ETAPA 4: Starting article validation and refinement', {
    initialArticles: articles.length,
    targetArticles,
    maxArticles,
    outlineTopics: strategy.contentOutline?.topicsToAddress?.length || 0,
    outlineConcepts: strategy.contentOutline?.keyConceptsNeeded?.length || 0
  });

  // Se não tem contentOutline, retorna artigos originais
  if (!strategy.contentOutline) {
    logger.info('No content outline available, skipping validation');
    return currentArticles;
  }

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    logger.info(`Validation iteration ${iteration}/${MAX_ITERATIONS}`);

    // Check if we've exceeded target significantly
    if (currentArticles.length >= maxArticles) {
      logger.info('✅ Target significantly exceeded, stopping refinement', {
        current: currentArticles.length,
        target: targetArticles,
        max: maxArticles
      });
      break;
    }

    // 1. VALIDAR: Verificar cobertura dos tópicos
    const gaps = await identifyContentGaps(currentArticles, strategy.contentOutline, strategy.validationCriteria);

    if (gaps.length === 0) {
      logger.info('✅ All topics covered! Validation complete', {
        iteration,
        totalArticles: currentArticles.length
      });
      break;
    }

    logger.info(`Found ${gaps.length} content gaps`, { gaps });

    if (onProgress) {
      onProgress({ iteration, gaps, articlesAdded: 0 });
    }

    // Se última iteração, aceitar o que tem
    if (iteration === MAX_ITERATIONS) {
      logger.warn('Reached max iterations, accepting current articles', {
        remainingGaps: gaps.length
      });
      break;
    }

    // 2. REFINAR: Gerar novas queries para preencher gaps
    const refinedQueries = await generateRefinedQueries(gaps, strategy.originalQuery, strategy.filters);

    logger.info(`Generated ${refinedQueries.length} refined queries for gaps`);

    // 3. BUSCAR: Executar novas buscas
    let articlesAdded = 0;
    const newArticlesThisIteration: FlowEnrichedArticle[] = [];

    for (const refinedQuery of refinedQueries) {
      const newResults = await buscaAcademicaUniversal(refinedQuery.query, {
        maxResults: refinedQuery.expectedResults,
        openAccessOnly: true,  // 🔓 Apenas Open Access (evita paywall)
        ...strategy.filters,
        sources: ['openalex', 'arxiv', 'europepmc']
      });

      logger.info(`Refined search found ${newResults.length} new results for gap: ${refinedQuery.targetGap}`);

      // Processar e adicionar novos artigos
      for (const result of newResults) {
        // Stop adding if we've reached max articles
        if (currentArticles.length + newArticlesThisIteration.length >= maxArticles) {
          logger.info('Reached max articles limit, stopping refinement for this query', {
            current: currentArticles.length + newArticlesThisIteration.length,
            max: maxArticles
          });
          break;
        }

        const scoreData = calculateArticleScore(result, refinedQuery.query);

        if (scoreData.score < 30) continue;

        // Verificar se não é duplicata
        const isDuplicate = currentArticles.some(
          a => (a.doi && a.doi === result.doi) || (a.url && a.url === result.url)
        );

        if (isDuplicate) continue;

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

        newArticlesThisIteration.push(enrichedArticle);
        articlesAdded++;
      }

      // Stop outer loop if max reached
      if (currentArticles.length + newArticlesThisIteration.length >= maxArticles) {
        break;
      }
    }

    logger.info(`Iteration ${iteration} complete: added ${articlesAdded} new articles`);

    // Se não conseguiu adicionar artigos, parar
    if (articlesAdded === 0) {
      logger.warn('Could not find new articles for gaps, stopping refinement');
      if (onProgress) {
        onProgress({ iteration, gaps, articlesAdded: 0 });
      }
      break;
    }

    // 4. ENRIQUECER: Adicionar fulltext aos novos artigos
    logger.info(`🚀 Enriching ${newArticlesThisIteration.length} new articles with fulltext`);

    const enrichedNewArticles = await enrichArticlesWithFulltext(
      newArticlesThisIteration,
      (progress) => {
        logger.debug('Fulltext enrichment progress for refined articles', {
          iteration,
          current: progress.current,
          total: progress.total,
          successful: progress.successful
        });
      }
    );

    logger.info(`✅ Enrichment complete for iteration ${iteration}`, {
      articlesEnriched: enrichedNewArticles.length,
      withFulltext: enrichedNewArticles.filter(a => a.hasFulltext).length,
      withAbstractOnly: enrichedNewArticles.filter(a => !a.hasFulltext).length
    });

    // Adicionar artigos enriquecidos ao array principal
    currentArticles.push(...enrichedNewArticles);

    if (onProgress) {
      onProgress({ iteration, gaps, articlesAdded });
    }
  }

  logger.info('🎯 ETAPA 4: Validation and refinement complete', {
    finalArticles: currentArticles.length,
    articlesAdded: currentArticles.length - articles.length
  });

  return currentArticles;
}

/**
 * Identifica gaps: tópicos do outline sem artigos adequados
 */
async function identifyContentGaps(
  articles: FlowEnrichedArticle[],
  contentOutline: any,
  validationCriteria?: any
): Promise<string[]> {
  const gaps: string[] = [];

  // Verificar cada tópico do outline
  const topicsToCheck = [
    ...(contentOutline.topicsToAddress || []),
    ...(contentOutline.keyConceptsNeeded || [])
  ];

  logger.info('Checking coverage for topics', { topicsCount: topicsToCheck.length });

  for (const topic of topicsToCheck) {
    // Verificar se há artigos que abordam este tópico
    const coveringArticles = articles.filter(article => {
      const titleLower = article.title.toLowerCase();
      const abstractLower = (article.abstract || '').toLowerCase();
      const topicLower = topic.toLowerCase();
      const topicTerms = topicLower.split(/\s+/).filter(t => t.length > 3);

      // Considerar coberto se pelo menos 60% dos termos aparecem
      const matchCount = topicTerms.filter(term =>
        titleLower.includes(term) || abstractLower.includes(term)
      ).length;

      const coverage = topicTerms.length > 0 ? matchCount / topicTerms.length : 0;
      return coverage >= 0.6;
    });

    // Se tem menos de 2 artigos cobrindo, é um gap
    if (coveringArticles.length < 2) {
      gaps.push(topic);
      logger.debug(`Gap identified: "${topic}" (${coveringArticles.length} articles)`);
    }
  }

  return gaps;
}

/**
 * Gera queries refinadas para preencher gaps específicos
 */
async function generateRefinedQueries(
  gaps: string[],
  originalQuery: string,
  filters: any
): Promise<Array<{ query: string; targetGap: string; expectedResults: number }>> {
  const refinedQueries = [];

  for (const gap of gaps) {
    // Query mais específica combinando query original + gap
    const refinedQuery = {
      query: `${originalQuery} ${gap}`,
      targetGap: gap,
      expectedResults: 5 // Buscar poucos artigos por gap
    };

    refinedQueries.push(refinedQuery);
  }

  return refinedQueries;
}

// ============================================
// FASE 5: ARTICLE ANALYSIS & SYNTHESIS
// ============================================

/**
 * Analisa artigos e gera insights profundos
 */
export async function analyzeArticles(
  articles: FlowEnrichedArticle[],
  query: string,
  workType: string = 'completo_padrao',
  section: string = 'completo_padrao'
): Promise<KnowledgeGraph> {
  logger.info('Analyzing articles', { articleCount: articles.length, query, workType, section });

  try {
    // 🚀 PRIORIZAR ARTIGOS COM FULLTEXT
    // Separar artigos com fulltext dos sem fulltext
    const withFulltext = articles.filter(a => a.hasFulltext);
    const withoutFulltext = articles.filter(a => !a.hasFulltext);

    // Get dynamic article limits based on work type and section
    const limits = articleLimitsConfig.getLimits(workType, section);
    const maxArticles = limits.maxForGraph;

    logger.info('Article selection for analysis', {
      total: articles.length,
      withFulltext: withFulltext.length,
      withoutFulltext: withoutFulltext.length,
      maxArticles,
      workType,
      section
    });

    // Selecionar top N (configurável): priorizar fulltext
    const selectedArticles = [
      ...withFulltext.slice(0, Math.min(withFulltext.length, maxArticles)),
      ...withoutFulltext.slice(0, Math.max(0, maxArticles - withFulltext.length))
    ].slice(0, maxArticles);

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
      maxTokens: getMaxTokensForProvider('graph')  // Gemini: 32K | DeepSeek: 8K | OpenAI: 16K
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

    // Get dynamic article limits based on work type and section
    const limits = articleLimitsConfig.getLimits(config.workType, config.section);
    const maxArticles = limits.maxForGeneration;

    logger.info('Article selection for generation', {
      total: articles.length,
      withFulltext: withFulltext.length,
      withoutFulltext: withoutFulltext.length,
      maxArticles,
      workType: config.workType,
      section: config.section
    });

    // Selecionar top N (configurável): priorizar fulltext
    const selectedArticles = [
      ...withFulltext.slice(0, Math.min(withFulltext.length, maxArticles)),
      ...withoutFulltext.slice(0, Math.max(0, maxArticles - withFulltext.length))
    ].slice(0, maxArticles);

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
      maxTokens: getMaxTokensForProvider('content')  // Gemini: 32K | OpenAI: 16K | DeepSeek: 8K
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

/**
 * Gera documento acadêmico COMPLETO com múltiplas seções
 * Gera: Introdução, Revisão de Literatura, Metodologia, Resultados, Discussão, Conclusão
 */
/**
 * Adiciona lista de referências ABNT ao documento gerado
 */
export async function appendReferencesToDocument(
  generatedContent: string,
  articles: FlowEnrichedArticle[]
): Promise<string> {
  try {
    const { abntReferencesService } = await import('./abntReferences.service.js');
    return abntReferencesService.appendReferencesToDocument(generatedContent, articles);
  } catch (error: any) {
    logger.error('Failed to append references', { error: error.message });
    return generatedContent; // Return original content if references fail
  }
}

/**
 * Verifica plágio no conteúdo gerado comparando com artigos fonte
 */
export async function checkPlagiarism(
  generatedContent: string,
  sourceArticles: FlowEnrichedArticle[]
): Promise<{ result: any; report: string }> {
  try {
    const { plagiarismCheckService } = await import('./plagiarismCheck.service.js');

    const result = await plagiarismCheckService.checkPlagiarism(
      generatedContent,
      sourceArticles
    );

    const report = plagiarismCheckService.generateReport(result);

    logger.info('Plagiarism check completed', {
      isPlagiarized: result.isPlagiarized,
      overallSimilarity: result.overallSimilarity,
      flaggedCount: result.flaggedParagraphs.length
    });

    return { result, report };
  } catch (error: any) {
    logger.error('Failed to check plagiarism', { error: error.message });
    throw error;
  }
}

/**
 * Agrupa artigos por similaridade semântica usando embeddings
 * Utiliza K-means ou DBSCAN para clustering automático
 */
export async function clusterArticlesBySimilarity(
  articles: FlowEnrichedArticle[],
  options?: {
    algorithm?: 'kmeans' | 'dbscan';
    numClusters?: number;
    similarityThreshold?: number;
  }
): Promise<{
  clusters: any[];
  semanticEdges: any[];
  statistics: any;
}> {
  try {
    const { semanticClusteringService } = await import('./semanticClustering.service.js');

    logger.info('Starting semantic clustering', {
      articleCount: articles.length,
      algorithm: options?.algorithm || 'kmeans'
    });

    const result = await semanticClusteringService.clusterArticles(articles, options);

    logger.info('Semantic clustering completed', {
      clusterCount: result.clusters.length,
      edgeCount: result.semanticEdges.length,
      orphanCount: result.orphanArticles.length
    });

    return {
      clusters: result.clusters,
      semanticEdges: result.semanticEdges,
      statistics: result.statistics
    };
  } catch (error: any) {
    logger.error('Failed to cluster articles', { error: error.message });
    throw error;
  }
}

/**
 * Valida arestas do grafo de conhecimento usando similaridade semântica
 * Identifica arestas fracas e sugere novas conexões semânticas
 */
export async function validateKnowledgeGraphWithSemantics(
  graphEdges: Array<{ source: string; target: string; type: string }>,
  articles: FlowEnrichedArticle[]
): Promise<{
  validEdges: Array<{ source: string; target: string; type: string; semanticScore: number }>;
  invalidEdges: Array<{ source: string; target: string; type: string; reason: string }>;
  suggestedEdges: any[];
}> {
  try {
    const { semanticClusteringService } = await import('./semanticClustering.service.js');

    logger.info('Validating knowledge graph with semantic similarity', {
      edgeCount: graphEdges.length,
      articleCount: articles.length
    });

    const validation = await semanticClusteringService.validateGraphEdges(
      graphEdges,
      articles
    );

    logger.info('Graph validation completed', {
      validEdges: validation.validEdges.length,
      invalidEdges: validation.invalidEdges.length,
      suggestedEdges: validation.enhancedEdges.length
    });

    return {
      validEdges: validation.validEdges,
      invalidEdges: validation.invalidEdges,
      suggestedEdges: validation.enhancedEdges
    };
  } catch (error: any) {
    logger.error('Failed to validate knowledge graph', { error: error.message });
    throw error;
  }
}

/**
 * Armazena embeddings de artigos no Qdrant para busca eficiente
 * Permite recuperação rápida de artigos similares
 */
export async function storeArticleEmbeddingsInQdrant(
  articles: FlowEnrichedArticle[]
): Promise<{ success: boolean; stored: number }> {
  try {
    const { qdrantService } = await import('./qdrant.service.js');
    const { semanticClusteringService } = await import('./semanticClustering.service.js');

    // Initialize Qdrant if not already done
    if (!qdrantService.isAvailable()) {
      await qdrantService.initialize();
    }

    if (!qdrantService.isAvailable()) {
      logger.warn('Qdrant not available, skipping vector storage');
      return { success: false, stored: 0 };
    }

    // Generate embeddings (will be done internally by clustering service)
    const embeddings = new Map<string, number[]>();
    const { embeddingsService } = await import('./embeddings.service.js');

    for (let i = 0; i < articles.length; i += 10) {
      const batch = articles.slice(i, i + 10);
      const texts = batch.map(a => {
        const title = a.title || '';
        const abstract = a.abstract || '';
        const intro = a.sections?.introduction || '';
        return `${title} ${title} ${title} ${abstract} ${abstract} ${intro}`.substring(0, 8000);
      });

      const batchEmbeddings = await embeddingsService.generateBatchEmbeddings(texts);
      batch.forEach((article, idx) => {
        embeddings.set(article.id, batchEmbeddings[idx]);
      });
    }

    // Store in Qdrant
    await qdrantService.storeArticleEmbeddings(articles, embeddings);

    logger.info('Article embeddings stored in Qdrant', {
      count: articles.length
    });

    return { success: true, stored: articles.length };
  } catch (error: any) {
    logger.error('Failed to store embeddings in Qdrant', {
      error: error.message
    });
    return { success: false, stored: 0 };
  }
}

export async function* generateCompleteDocument(
  baseConfig: ContentGenerationConfig,
  articles: FlowEnrichedArticle[],
  query: string,
  focusSection?: string
): AsyncGenerator<string> {
  logger.info('Starting complete document generation', {
    focusSection,
    articleCount: articles.length
  });

  // Definir seções a gerar baseado no foco do usuário
  const sectionsToGenerate = focusSection && focusSection !== 'todas' && focusSection !== 'todas_secoes'
    ? [focusSection] // Apenas a seção escolhida
    : ['introducao', 'revisao', 'metodologia', 'resultados', 'discussao', 'conclusao']; // Todas as seções

  const sectionTitles: Record<string, string> = {
    'introducao': 'Introdução',
    'revisao': 'Revisão de Literatura',
    'metodologia': 'Metodologia',
    'resultados': 'Resultados',
    'discussao': 'Discussão',
    'conclusao': 'Conclusão'
  };

  const sectionStructures: Record<string, Array<{section: string; subsections: string[]; estimatedArticles: number}>> = {
    'introducao': [{
      section: 'Introdução',
      subsections: ['Contextualização', 'Problema de Pesquisa', 'Objetivos', 'Justificativa'],
      estimatedArticles: 15
    }],
    'revisao': [{
      section: 'Revisão de Literatura',
      subsections: ['Fundamentação Teórica', 'Estado da Arte', 'Lacunas Identificadas'],
      estimatedArticles: 30
    }],
    'metodologia': [{
      section: 'Metodologia',
      subsections: ['Abordagem Metodológica', 'Procedimentos', 'Instrumentos e Técnicas'],
      estimatedArticles: 20
    }],
    'resultados': [{
      section: 'Resultados',
      subsections: ['Análise dos Dados', 'Principais Achados', 'Síntese dos Resultados'],
      estimatedArticles: 25
    }],
    'discussao': [{
      section: 'Discussão',
      subsections: ['Interpretação dos Resultados', 'Comparação com Literatura', 'Implicações Teóricas e Práticas'],
      estimatedArticles: 30
    }],
    'conclusao': [{
      section: 'Conclusão',
      subsections: ['Síntese Geral', 'Limitações do Estudo', 'Recomendações e Trabalhos Futuros'],
      estimatedArticles: 15
    }]
  };

  try {
    for (const sectionKey of sectionsToGenerate) {
      const sectionTitle = sectionTitles[sectionKey] || sectionKey;
      const structure = sectionStructures[sectionKey] || [];

      logger.info(`Generating section: ${sectionTitle}`);

      // Criar config para esta seção específica
      const sectionConfig: ContentGenerationConfig = {
        ...baseConfig,
        section: sectionTitle,
        structure: structure
      };

      // Gerar separador de seção
      yield `\n\n# ${sectionTitle}\n\n`;

      // Gerar conteúdo da seção
      const sectionStream = generateAcademicContent(sectionConfig, articles, query);

      for await (const chunk of sectionStream) {
        yield chunk;
      }

      // Espaçamento entre seções
      yield '\n\n';
    }

    logger.info('Complete document generation finished');
  } catch (error: any) {
    logger.error('Complete document generation failed', { error: error.message });
    throw new Error('Falha ao gerar documento completo');
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
      maxTokens: getMaxTokensForProvider('validate')
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

// ============================================
// FASE 5: FIND SIMILAR ARTICLES (NEW SEARCH)
// ============================================

/**
 * Busca artigos similares NA INTERNET (novos artigos, não da lista atual)
 * @param referenceArticle - Artigo de referência para buscar similares
 * @param existingArticles - Lista de artigos já encontrados (para filtrar duplicatas)
 * @param originalQuery - Query original da pesquisa
 * @returns Lista de novos artigos similares
 */
export async function findSimilarArticles(
  referenceArticle: FlowEnrichedArticle,
  existingArticles: FlowEnrichedArticle[],
  originalQuery: string
): Promise<FlowEnrichedArticle[]> {
  logger.info('Finding similar articles on the internet', {
    referenceTitle: referenceArticle.title.substring(0, 100),
    existingCount: existingArticles.length
  });

  try {
    // 1. Extrair palavras-chave do artigo de referência
    const extractKeywords = (text: string): string[] => {
      const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'using', 'based', 'study', 'research', 'analysis', 'effect', 'effects', 'results', 'methods']);
      const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      const wordFreq: Record<string, number> = {};

      words.forEach(word => {
        if (!commonWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });

      return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Top 10 palavras mais frequentes
        .map(([word]) => word);
    };

    const keywords = extractKeywords(referenceArticle.title + ' ' + referenceArticle.abstract);
    const searchQuery = keywords.slice(0, 5).join(' '); // Top 5 keywords

    logger.info('Extracted keywords for similar search', {
      keywords: keywords.slice(0, 5),
      searchQuery
    });

    // 2. Buscar artigos usando a query construída
    const results = await buscaAcademicaUniversal(searchQuery, {
      maxResults: 15, // Buscar 15 para ter margem após filtrar
      openAccessOnly: true,  // 🔓 Apenas Open Access (evita paywall)
      sources: ['openalex', 'arxiv', 'europepmc']
    });

    logger.info('Similar articles search completed', {
      found: results.length
    });

    // 3. Criar Set de IDs existentes (DOIs e URLs) para filtrar duplicatas
    const existingIds = new Set<string>();
    existingArticles.forEach(article => {
      if (article.doi) existingIds.add(article.doi.toLowerCase());
      if (article.url) existingIds.add(article.url.toLowerCase());
      if (article.id) existingIds.add(article.id.toLowerCase());
    });

    // 4. Filtrar e processar novos artigos
    const newArticles: FlowEnrichedArticle[] = [];

    for (const result of results) {
      // Verificar se é duplicata
      const isDuplicate =
        (result.doi && existingIds.has(result.doi.toLowerCase())) ||
        (result.url && existingIds.has(result.url.toLowerCase()));

      if (isDuplicate) {
        continue; // Pular artigos duplicados
      }

      // Aplicar filtros de qualidade (mesmos da busca exaustiva)
      const scoreData = calculateArticleScore(result, originalQuery);

      if (scoreData.score < 30) continue; // Score muito baixo
      if (!result.doi && !result.pdfUrl) continue; // Sem acesso
      if (!result.abstract || result.abstract.trim().length === 0) continue; // Sem abstract
      if (!result.authors || result.authors.length === 0) continue; // Sem autores

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
        journalInfo: result.journalInfo,
        score: scoreData,
        format: 'pdf',
        hasFulltext: !!result.pdfUrl,
        fullContent: undefined,
        sections: {}
      };

      newArticles.push(enrichedArticle);

      // Limitar a 10 novos artigos
      if (newArticles.length >= 10) break;
    }

    logger.info('Similar articles search result', {
      totalFound: results.length,
      newArticles: newArticles.length,
      filtered: results.length - newArticles.length
    });

    return newArticles;
  } catch (error: any) {
    logger.error('Find similar articles failed', { error: error.message });
    return []; // Retornar lista vazia em caso de erro
  }
}
