/**
 * Tipos para o novo fluxo de pesquisa de 8 fases
 */

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

export interface SearchQuery {
  query: string;
  priority: PriorityLevel;
  expectedResults: number;
}

export interface FlowSearchStrategy {
  topic: string;
  originalQuery: string;
  queries: {
    P1: SearchQuery[];  // Score ≥ 75
    P2: SearchQuery[];  // Score ≥ 50
    P3: SearchQuery[];  // Score ≥ 30
  };
  prioritizedSources: Array<{
    name: string;
    reason: string;
    order: number;
  }>;
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
  sourceProgress: Array<{
    source: string;
    current: number;
    total: number;
    completed: boolean;
  }>;
  articlesFound: number;
  articlesWithFulltext: number;
  articlesByPriority: {
    P1: number;
    P2: number;
    P3: number;
  };
  formatsDetected: Record<string, number>;
  elapsedTime: number;
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
  section: string;
  style: WritingStyle;
  perspective: WritingPerspective;
  citationDensity: CitationDensity;
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
