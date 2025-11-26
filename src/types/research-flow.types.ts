/**
 * Tipos para o novo fluxo de pesquisa de 8 fases
 */

// ============================================
// FASE 1: ACADEMIC WORK TYPES
// ============================================

/**
 * Tipos de trabalhos acadêmicos suportados
 * Baseado nos padrões ABNT e universidades brasileiras
 */
export type AcademicWorkType =
  | 'tcc'                    // Trabalho de Conclusão de Curso (40-60 páginas)
  | 'dissertacao'            // Dissertação de Mestrado (80-120 páginas)
  | 'tese'                   // Tese de Doutorado (150-250 páginas)
  | 'projeto_pesquisa'       // Projeto de Pesquisa (10-20 páginas)
  | 'artigo_cientifico'      // Artigo Científico (15-25 páginas)
  | 'revisao_sistematica'    // Revisão Sistemática (20-40 páginas)
  | 'relatorio_tecnico';     // Relatório Técnico (variável)

/**
 * Seções disponíveis por tipo de trabalho
 */
export const ACADEMIC_WORK_SECTIONS: Record<AcademicWorkType, string[]> = {
  tcc: ['introducao', 'revisao', 'metodologia', 'resultados', 'discussao', 'conclusao'],
  dissertacao: ['introducao', 'revisao', 'metodologia', 'resultados', 'discussao', 'conclusao'],
  tese: ['introducao', 'revisao', 'metodologia', 'resultados', 'discussao', 'conclusao'],
  projeto_pesquisa: ['completo_padrao', 'completo_detalhado'],
  artigo_cientifico: ['completo_padrao', 'completo_detalhado'],
  revisao_sistematica: ['completo_padrao', 'completo_detalhado'],
  relatorio_tecnico: ['completo_padrao', 'completo_detalhado']
};

// ============================================
// FASE 2: AI CLARIFICATION & REFINEMENT
// ============================================

export type QuestionType = 'multiple_choice' | 'text' | 'range' | 'checkboxes';

export interface ClarificationQuestion {
  id: string;
  questionNumber: number;
  totalQuestions: number;
  type: QuestionType;
  question: string;
  description?: string;
  options?: Array<{
    value: string;
    label: string;
    description?: string;
    estimatedArticles?: number;
  }>;
  placeholder?: string;
  defaultValue?: any;
  required: boolean;
}

export interface ClarificationAnswer {
  questionId: string;
  answer: any;
}

export interface ClarificationSession {
  sessionId: string;
  query: string;

  // Dados capturados na sessão (passados para FASE 3)
  workType?: AcademicWorkType;      // Tipo de trabalho escolhido pelo usuário
  section?: string;                  // Seção específica (para TCC/dissertação/tese)
  targetWordCount?: number;          // Meta de palavras baseada no tipo de trabalho
  targetArticles?: number;           // Meta de artigos baseada no tipo de trabalho

  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  completed: boolean;
  createdAt: Date;
}

// ============================================
// FASE 3: SEARCH STRATEGY GENERATION
// ============================================

export type PriorityLevel = 'P1' | 'P2' | 'P3';
export type ScoreRange = { min: number; max: number };

/**
 * Roteiro mental do que será escrito ANTES de buscar artigos
 * Esta é a inovação central: a IA planeja o que vai escrever,
 * depois busca artigos que sustentam esse roteiro
 */
export interface ContentOutline {
  mainArgument: string;                    // Argumento central em 1 frase
  topicsToAddress: string[];               // Tópicos que DEVEM aparecer no texto
  keyConceptsNeeded: string[];             // Conceitos-chave que precisam ser explicados
  expectedStructure: Array<{               // Estrutura esperada do texto
    subtopic: string;                      // Nome do subtópico
    focus: string;                         // O que abordar neste subtópico
    expectedArticles: number;              // Quantos artigos espera-se usar aqui
  }>;
}

/**
 * Critérios para validar se um artigo encontrado
 * realmente sustenta o roteiro planejado
 */
export interface ArticleValidationCriteria {
  mustContainTopics: string[];             // Tópicos obrigatórios que o artigo deve abordar
  mustDefineConcepts: string[];            // Conceitos que o artigo deve explicar
  preferredMethodology?: string[];         // Metodologias preferidas (ex: "empirical", "systematic review")
  minimumQuality: number;                  // Score mínimo para aceitar o artigo (0-100)
  relaxationLevels?: Array<{               // Níveis de relaxamento se não achar artigos suficientes
    level: number;                         // Nível de relaxamento (1, 2, 3...)
    minimumQuality: number;                // Novo score mínimo
    allowPartialTopicMatch: boolean;       // Aceita match parcial de tópicos
  }>;
}

export interface SearchQuery {
  query: string;
  priority?: PriorityLevel;  // Optional - deprecated in new flat query system
  expectedResults: number;
}

export interface FlowSearchStrategy {
  topic: string;
  originalQuery: string;

  // Dados recebidos da FASE 2 (Clarification)
  workType: AcademicWorkType;              // Tipo de trabalho acadêmico
  section: string;                         // Seção sendo trabalhada

  // Roteiro de conteúdo (gerado ANTES da busca)
  contentOutline: ContentOutline;          // O que a IA planeja escrever
  validationCriteria: ArticleValidationCriteria; // Como validar artigos encontrados

  // Estratégia de busca (baseada no roteiro)
  // NOTA: Queries são geradas flat (sem priorização). Classificação P1/P2/P3 ocorre
  // APÓS a busca, baseado no score final dos artigos (IF, estudo, citações, etc)
  queries: SearchQuery[];  // Array flat - todas as queries têm igual prioridade
  keyTerms: {
    primary: string[];      // Termos principais da pesquisa
    specific: string[];     // Termos específicos/técnicos
    methodological: string[]; // Tipos de estudo (systematic review, meta-analysis, etc)
  };
  filters: {
    dateRange: { start: number; end: number };
    languages: string[];
    documentTypes: string[];
  };
  targetArticles: number;
  estimatedTime: string;
}

// ============================================
// FASE 4: EXHAUSTIVE SEARCH
// ============================================

export interface FlowSearchProgress {
  currentPriority: PriorityLevel;
  currentQuery: number;
  totalQueries: number;
  sourceProgress?: Array<{
    source: string;
    current: number;
    total: number;
    completed: boolean;
  }>;
  articlesFound: number;
  articlesWithFulltext?: number;
  articlesByPriority?: {
    P1: number;
    P2: number;
    P3: number;
  };
  formatsDetected?: Record<string, number>;
  elapsedTime?: number;

  // New fields for parallel search
  targetArticles?: number;  // Target number of articles
  estimatedTimeRemaining?: number;  // Estimated time remaining (seconds)
  phase?: string;  // Current phase description (e.g., "Searching...", "Deduplicating...")

  // Real-time visualization data (for mind map construction)
  newArticles?: Array<{
    id: string;
    title: string;
    priority: PriorityLevel;
    source: string;
    score: number;
    hasFulltext: boolean;
    year?: number;
    citationCount?: number;
  }>;
}

export interface ArticleScore {
  score: number;
  priority: PriorityLevel;
  reasons: string[];
}

export interface FlowEnrichedArticle {
  // Basic info
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;

  // Source info
  source: string;
  url: string;
  doi?: string;
  pdfUrl?: string;
  journalInfo?: string;

  // Quality metrics
  citationCount: number;
  score: ArticleScore;
  format: string;
  hasFulltext: boolean;

  // Content
  fullContent?: string;
  sections?: Record<string, string>;
}

export interface SearchApprovalPoint {
  priority: PriorityLevel;
  targetArticles: number;
  foundArticles: number;
  gap: number;
  topArticles: FlowEnrichedArticle[];
  options: {
    continueToNext: { label: string; description: string };
    refineSearch: { label: string; description: string };
    useFound: { label: string; description: string };
  };
}

// ============================================
// FASE 5: ARTICLE ANALYSIS & SYNTHESIS
// ============================================

export interface ExtractionProgress {
  current: number;
  total: number;
  currentArticle: string;
  format: string;
  progress: number;
  extracted: Array<{
    format: string;
    count: number;
  }>;
  estimatedTimeRemaining: number;
}

export interface AnalysisProgress {
  stage: 'extracting' | 'analyzing_methodology' | 'mapping_relations' | 'synthesizing';
  stagesCompleted: string[];
  currentStage: string;
  progress: number;
  discoveries: {
    themes: Array<{
      name: string;
      articleCount: number;
    }>;
    consensus: Array<{
      finding: string;
      percentage: number;
    }>;
    challenges: Array<{
      issue: string;
      frequency: number;
    }>;
    gaps: string[];
  };
  estimatedTimeRemaining: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'main' | 'sub' | 'detail';
  articleCount: number;
  position?: { x: number; y: number };
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  clusters: Array<{
    id: string;
    name: string;
    nodeIds: string[];
    citationCount: number;
  }>;
  insights: {
    mostCitedCluster: string;
    methodologyBreakdown: Record<string, number>;
    gaps: string[];
  };
}

// ============================================
// FASE 6: CONTENT GENERATION
// ============================================

export type WritingStyle = 'academic_formal' | 'technical_specialized' | 'accessible_clear';
export type WritingPerspective = 'first_person_plural' | 'third_person';
export type CitationDensity = 'low' | 'medium' | 'high';

export interface ContentGenerationConfig {
  // Dados recebidos das fases anteriores
  workType: AcademicWorkType;              // Da FASE 2
  section: string;                         // Da FASE 2
  contentOutline: ContentOutline;          // Da FASE 3
  targetWordCount: number;                 // Da FASE 2

  // Configurações automáticas (baseadas no workType)
  style: WritingStyle;                     // Determinado automaticamente
  perspective: WritingPerspective;         // Determinado automaticamente
  citationDensity: CitationDensity;        // Determinado automaticamente

  criticalAnalysis: {
    includeCriticalAnalysis: boolean;
    pointOutLimitations: boolean;
    includeContrastingPerspectives: boolean;
  };
  structure: Array<{
    section: string;
    subsections: string[];
    estimatedArticles: number;
  }>;
  estimatedTime: string;
}

export interface GenerationProgress {
  section: string;
  progress: number;
  wordsWritten: number;
  estimatedTotalWords: number;
  citationsInserted: number;
  previewText: string;
}

// ============================================
// FASE 7: INTERACTIVE EDITING
// ============================================

export type EditAction =
  | 'rewrite'
  | 'expand'
  | 'summarize'
  | 'add_citations'
  | 'change_tone'
  | 'view_sources'
  | 'remove';

export interface EditRequest {
  action: EditAction;
  selection: {
    start: number;
    end: number;
    text: string;
  };
  parameters?: {
    tone?: 'formal' | 'accessible';
    citationCount?: number;
    targetWords?: number;
  };
}

export interface ArticleSuggestion {
  article: FlowEnrichedArticle;
  reason: string;
  relevanceScore: number;
}

export interface CitationStats {
  totalArticles: number;
  citedArticles: number;
  citationsByPriority: {
    P1: { cited: number; total: number };
    P2: { cited: number; total: number };
    P3: { cited: number; total: number };
  };
  uncitedP1Articles: number;
}

// ============================================
// FASE 8: EXPORT & CITATION
// ============================================

export type ExportFormat = 'docx' | 'pdf' | 'latex' | 'markdown' | 'html';
export type CitationStyle = 'abnt' | 'apa' | 'vancouver' | 'chicago';

export interface ExportOptions {
  format: ExportFormat;
  citationStyle: CitationStyle;
  includes: {
    referenceList: boolean;
    tableOfContents: boolean;
    pageNumbers: boolean;
    headerFooter: boolean;
    listOfFigures: boolean;
    listOfTables: boolean;
    footnotes: boolean;
    appendicesWithArticles: boolean;
  };
  template: 'standard' | 'university' | 'custom';
  customTemplate?: string;
}

export interface DocumentStats {
  words: number;
  pages: number;
  citations: number;
  references: number;
}

export type VerificationIssueType = 'missing_reference' | 'incomplete_reference' | 'long_paragraph' | 'style_issue';

export interface VerificationIssue {
  type: VerificationIssueType;
  severity: 'error' | 'warning' | 'info';
  description: string;
  location?: { page?: number; line?: number };
  autoFixAvailable: boolean;
}

export interface QualityVerification {
  abntFormatting: boolean;
  allCitationsHaveReferences: boolean;
  allReferencesAreCited: boolean;
  textCoherence: number;
  grammarCheck: boolean;
  plagiarismSimilarity: number;
  issues: VerificationIssue[];
}

// ============================================
// RESEARCH SESSION (Estado completo)
// ============================================

export type ResearchPhase =
  | 'onboarding'           // FASE 1
  | 'clarification'        // FASE 2
  | 'strategy'             // FASE 3
  | 'search'               // FASE 4
  | 'analysis'             // FASE 5
  | 'generation'           // FASE 6
  | 'editing'              // FASE 7
  | 'export';              // FASE 8

export interface ResearchSession {
  id: string;
  userId: string;
  currentPhase: ResearchPhase;
  createdAt: Date;
  updatedAt: Date;

  // Fase 1: Onboarding
  initialQuery: string;

  // Fase 2: Clarification
  clarificationSession?: ClarificationSession;

  // Fase 3: Strategy
  searchStrategy?: FlowSearchStrategy;

  // Fase 4: Search
  searchProgress?: FlowSearchProgress;
  articles: FlowEnrichedArticle[];

  // Fase 5: Analysis
  knowledgeGraph?: KnowledgeGraph;
  analysisResults?: {
    themes: string[];
    consensus: string[];
    gaps: string[];
  };

  // Fase 6: Generation
  generationConfig?: ContentGenerationConfig;
  generatedContent: string;

  // Fase 7: Editing
  editHistory: EditRequest[];
  citationStats?: CitationStats;

  // Fase 8: Export
  exportOptions?: ExportOptions;
  finalDocument?: string;
  qualityVerification?: QualityVerification;
}
