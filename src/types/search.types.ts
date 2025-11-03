/**
 * Sistema de tipos para busca acadêmica
 * Suporta busca em fases (P1 → P2 → P3), filtros avançados e estratégias
 */

import { ArticlePriority, ArticleFormat, LicenseType } from './article.types.js';

/**
 * Estratégias de busca
 */
export type SearchStrategy =
  | 'comprehensive'  // Busca em todos os bancos (padrão)
  | 'fast'          // Apenas APIs rápidas (OpenAlex, Semantic Scholar)
  | 'quality'       // Prioriza qualidade sobre quantidade
  | 'recency'       // Prioriza papers recentes
  | 'phased';       // Busca em fases P1 → P2 → P3 até atingir mínimo

/**
 * Fase de busca (P1 = prioridade máxima)
 */
export interface SearchPhase {
  phase: ArticlePriority;
  apis: string[];              // APIs a consultar nesta fase
  minResults: number;          // Mínimo de resultados para parar
  timeout: number;             // Timeout em ms
  filters?: SearchFilters;     // Filtros específicos da fase
}

/**
 * Filtros de busca avançados
 */
export interface SearchFilters {
  // Temporal
  yearMin?: number;
  yearMax?: number;
  dateFrom?: string;  // ISO 8601
  dateTo?: string;

  // Qualidade
  minCitations?: number;
  maxCitations?: number;
  minQualityScore?: number;
  priorities?: ArticlePriority[];

  // Acesso
  openAccessOnly?: boolean;
  licenses?: LicenseType[];
  requirePDF?: boolean;
  requireFullText?: boolean;

  // Formato
  formats?: ArticleFormat[];
  requireStructuredData?: boolean;

  // Conteúdo
  requireAbstract?: boolean;
  requireReferences?: boolean;
  minReferencesCount?: number;
  languages?: string[];  // ['en', 'pt', 'es']

  // Metadata
  journals?: string[];        // Lista de periódicos específicos
  authors?: string[];         // Filtrar por autor
  affiliations?: string[];    // Filtrar por instituição
  subjectAreas?: string[];    // Áreas do conhecimento
  fundedBy?: string[];        // Agências de fomento

  // Busca semântica
  similarTo?: string;         // DOI de paper para buscar similares
  semanticThreshold?: number; // Threshold de similaridade (0-1)

  // APIs
  sources?: string[];         // APIs específicas (openalex, pubmed, etc)
  excludeSources?: string[];  // APIs a excluir
}

/**
 * Opções de busca
 */
export interface SearchOptions {
  // Básico
  query?: string;
  limit?: number;              // Máximo de resultados (padrão: 100)
  offset?: number;             // Para paginação

  // Estratégia
  strategy?: SearchStrategy;
  phases?: SearchPhase[];      // Configuração customizada de fases

  // Filtros
  filters?: SearchFilters;

  // Performance
  timeout?: number;            // Timeout global em ms
  useCache?: boolean;          // Usar cache de resultados (padrão: true)
  cacheTTL?: number;           // TTL do cache em ms

  // Enriquecimento
  enrichResults?: boolean;     // Buscar fulltext, embeddings, etc
  enrichmentOptions?: {
    generateEmbeddings?: boolean;
    calculateQuality?: boolean;
    fetchFullText?: boolean;
    extractEntities?: boolean;
  };

  // Ordenação
  sortBy?: 'relevance' | 'citations' | 'date' | 'quality';
  sortOrder?: 'asc' | 'desc';

  // Deduplicação
  deduplicateBy?: 'doi' | 'title' | 'both';
  keepDuplicateWithMostData?: boolean;  // Mantém versão mais completa

  // Callbacks
  onProgress?: (progress: SearchProgress) => void;
  onError?: (error: SearchError) => void;
}

/**
 * Progresso da busca (para UI)
 */
export interface SearchProgress {
  currentPhase?: ArticlePriority;
  apisCompleted: number;
  apisTotal: number;
  resultsFound: number;
  resultsTarget: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

/**
 * Erro de busca por API
 */
export interface SearchError {
  api: string;
  error: string;
  timestamp: Date;
  phase?: ArticlePriority;
}

/**
 * Contexto de busca (para logs e analytics)
 */
export interface SearchContext {
  sessionId: string;
  userId?: string;
  timestamp: Date;
  query: string;
  options: SearchOptions;
  results: {
    totalFound: number;
    totalReturned: number;
    executionTime: number;
    phases: {
      phase: ArticlePriority;
      apis: string[];
      found: number;
      errors: number;
      duration: number;
    }[];
  };
}

/**
 * Configuração padrão de fases P1 → P2 → P3
 */
export const DEFAULT_SEARCH_PHASES: SearchPhase[] = [
  {
    phase: 'P1',
    apis: [
      'semanticScholar',  // 200M artigos, CS/Med focus
      'openalex',         // 240M artigos, multidisciplinar
      'pubmed',           // 36M biomedicina
    ],
    minResults: 20,
    timeout: 5000,
    filters: {
      minCitations: 5,
      requireAbstract: true,
    },
  },
  {
    phase: 'P2',
    apis: [
      'core',             // 139M OA
      'europepmc',        // 8.1M biomedicina
      'arxiv',            // 2.4M preprints
      'doaj',             // 11M periódicos OA
    ],
    minResults: 30,
    timeout: 8000,
    filters: {
      requireAbstract: true,
    },
  },
  {
    phase: 'P3',
    apis: [
      'plos',             // 300K OA
      'biorxiv',          // 200K+ preprints biologia
      'medrxiv',          // 100K+ preprints medicina
      'openaire',         // 150M produtos EU
      'datacite',         // 45M datasets
    ],
    minResults: 50,
    timeout: 10000,
  },
];

/**
 * Mapeamento de áreas para APIs especializadas
 */
export const SUBJECT_AREA_APIS: Record<string, string[]> = {
  biomedicine: ['pubmed', 'europepmc', 'medrxiv', 'plos'],
  computerScience: ['arxiv', 'semanticScholar'],
  physics: ['arxiv', 'openalex'],
  biology: ['biorxiv', 'plos', 'pubmed'],
  europe: ['openaire', 'core'],
  data: ['datacite', 'openaire'],
  openAccess: ['doaj', 'plos', 'core'],
};

/**
 * Helper para criar SearchOptions mínimo
 */
export function createDefaultSearchOptions(): SearchOptions {
  return {
    limit: 100,
    strategy: 'comprehensive',
    useCache: true,
    cacheTTL: 3600000,  // 1 hora
    enrichResults: false,
    sortBy: 'relevance',
    sortOrder: 'desc',
    deduplicateBy: 'both',
    keepDuplicateWithMostData: true,
  };
}

/**
 * Helper para criar busca focada em área
 */
export function createSubjectAreaSearch(
  query: string,
  area: keyof typeof SUBJECT_AREA_APIS,
  options?: Partial<SearchOptions>
): SearchOptions {
  return {
    ...createDefaultSearchOptions(),
    query,
    filters: {
      sources: SUBJECT_AREA_APIS[area],
      ...options?.filters,
    },
    ...options,
  };
}

/**
 * Type guard para validar SearchOptions
 */
export function isValidSearchOptions(obj: any): obj is SearchOptions {
  if (typeof obj !== 'object' || obj === null) return false;

  // Validações básicas
  if (obj.limit !== undefined && typeof obj.limit !== 'number') return false;
  if (obj.strategy !== undefined && !['comprehensive', 'fast', 'quality', 'recency', 'phased'].includes(obj.strategy)) {
    return false;
  }

  return true;
}

// ============================================
// SEARCH SERVICE TYPES
// ============================================

/**
 * Seções do trabalho acadêmico
 */
export type WorkSection =
  | 'introduction'
  | 'literatureReview'
  | 'methodology'
  | 'results'
  | 'discussion'
  | 'conclusion';

/**
 * Status da busca exaustiva
 */
export type ExhaustiveSearchStatus =
  | 'P1_COMPLETE'      // Meta atingida apenas com P1
  | 'P1_INCOMPLETE'    // P1 não atingiu meta, indo para P2
  | 'P2_COMPLETE'      // Meta atingida com P1 + P2
  | 'P2_INCOMPLETE'    // P2 não atingiu meta, indo para P3
  | 'P3_COMPLETE'      // Meta atingida com P1 + P2 + P3
  | 'COMPLETE';        // Busca finalizada

/**
 * Callback para aprovação do usuário durante busca exaustiva
 */
export type UserApprovalCallback = (
  currentResults: import('./article.types').EnrichedArticle[],
  status: ExhaustiveSearchStatus
) => Promise<boolean>;

/**
 * Estratégia de expansão de query
 */
export interface QueryExpansionStrategy {
  primaryQuery: string;           // Query original
  secondaryQueries: string[];     // Sinônimos e variações
  tertiaryQueries: string[];      // Queries mais amplas
}
