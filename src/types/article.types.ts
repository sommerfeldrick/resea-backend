/**
 * Sistema de tipos para artigos acadêmicos
 * Suporta múltiplos formatos (JATS XML, LaTeX, TEI, JSON)
 * Com embeddings para busca semântica e métricas de qualidade
 */

/**
 * Prioridade baseada em qualidade (P1 = melhor)
 */
export type ArticlePriority = 'P1' | 'P2' | 'P3';

/**
 * Formatos de artigo suportados
 */
export type ArticleFormat =
  | 'jats'        // JATS XML (padrão NCBI/PubMed)
  | 'tei'         // TEI XML (Text Encoding Initiative)
  | 'latex'       // LaTeX source
  | 'json'        // JSON estruturado (schema.org)
  | 'html'        // HTML semântico
  | 'pdf'         // PDF (requer OCR/parsing)
  | 'epub'        // EPUB
  | 'plain';      // Texto puro

/**
 * Tipos de licença Open Access
 */
export type LicenseType =
  | 'CC BY'           // Creative Commons Attribution
  | 'CC BY-SA'        // ShareAlike
  | 'CC BY-NC'        // Non-Commercial
  | 'CC BY-NC-SA'     // Non-Commercial ShareAlike
  | 'CC BY-ND'        // No Derivatives
  | 'CC0'             // Public Domain
  | 'MIT'             // MIT License
  | 'Apache-2.0'      // Apache License 2.0
  | 'GPL'             // GNU General Public License
  | 'proprietary'     // Acesso restrito
  | 'unknown';        // Licença não identificada

/**
 * Interface completa para artigos acadêmicos
 * Substitui AcademicPaper com campos adicionais
 */
export interface AcademicArticle {
  // Identificação básica
  id: string;
  doi?: string;
  title: string;
  authors: string[];

  // IDs externos (para full-text access)
  pmcid?: string;              // PubMed Central ID (para JATS XML)
  arxivId?: string;            // arXiv ID (para LaTeX source)
  pmid?: string;               // PubMed ID

  // Metadata
  abstract?: string;
  year?: number;
  publicationDate?: string;
  journal?: string;
  journalInfo?: string;
  source: string;  // API de origem (openalex, pubmed, etc)

  // URLs e acesso
  url?: string;
  pdfUrl?: string;
  isOpenAccess: boolean;
  license?: LicenseType;

  // Métricas
  citationCount?: number;

  // Conteúdo estruturado (seções do artigo)
  sections?: {
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
    [key: string]: string | undefined;  // Outras seções customizadas
  };

  // Referências bibliográficas
  references?: Array<{
    title: string;
    authors: string[];
    year?: number;
    doi?: string;
    url?: string;
  }>;

  // ===== NOVOS CAMPOS =====

  // Embeddings para busca semântica
  embeddings?: {
    title?: number[];        // Embedding do título
    abstract?: number[];     // Embedding do abstract
    fullText?: number[];     // Embedding do texto completo
  };

  // Qualidade e prioridade
  quality?: {
    score: number;           // 0-100
    priority: ArticlePriority;  // P1/P2/P3
    factors: {
      hasFullText: boolean;
      hasStructuredData: boolean;
      isOpenAccess: boolean;
      citationCount: number;
      hasAbstract: boolean;
      hasReferences: boolean;
      yearRecency: number;   // 0-100 (papers recentes = maior)
    };
  };

  // Formatos disponíveis
  availableFormats?: AvailableFormat[];

  // Texto completo estruturado
  fullText?: {
    raw?: string;            // Texto bruto
    structured?: {           // Texto estruturado por seção
      [section: string]: string;
    };
    chunks?: Array<{         // Chunks para RAG
      text: string;
      section: string;
      embedding?: number[];
      citations?: string[];  // DOIs citados neste chunk
    }>;
  };

  // Entidades extraídas (genes, proteínas, doenças - PubMed/Europe PMC)
  entities?: {
    genes?: string[];
    proteins?: string[];
    diseases?: string[];
    chemicals?: string[];
    keywords?: string[];
  };

  // Metadata adicional
  metadata?: {
    language?: string;
    subjectAreas?: string[];
    fundingInfo?: string[];
    affiliations?: string[];
    correspondingAuthor?: {
      name: string;
      email?: string;
      affiliation?: string;
    };
  };

  // Tracking de busca
  searchMetadata?: {
    query?: string;
    relevanceScore?: number;  // Similaridade com query (0-1)
    foundInAPI?: string;      // API que retornou este paper
    fetchedAt?: Date;
  };
}

/**
 * Tipo legado para compatibilidade
 * TODO: Migrar todo código para usar AcademicArticle
 */
export type AcademicPaper = AcademicArticle;

/**
 * Resultado de busca com estatísticas
 */
export interface SearchResult {
  articles: AcademicArticle[];
  metadata: {
    totalFound: number;
    query: string;
    sources: {
      [apiName: string]: {
        found: number;
        errors?: string;
      };
    };
    executionTime: number;  // ms
    cacheHits?: number;
    cacheMisses?: number;
  };
}

/**
 * Filtros para qualidade de artigos
 */
export interface QualityFilter {
  minScore?: number;           // Score mínimo (0-100)
  priorities?: ArticlePriority[];  // Apenas P1, P2, etc
  requireOpenAccess?: boolean;
  requireFullText?: boolean;
  requireAbstract?: boolean;
  minCitations?: number;
  minYear?: number;
  maxYear?: number;
}

/**
 * Opções para enriquecimento de artigos
 */
export interface EnrichmentOptions {
  generateEmbeddings?: boolean;     // Gerar embeddings (título, abstract, fulltext)
  calculateQuality?: boolean;       // Calcular quality score
  fetchFullText?: boolean;          // Buscar texto completo via GROBID
  extractEntities?: boolean;        // Extrair entidades (genes, proteínas)
  parseReferences?: boolean;        // Parsear referências
  detectFormat?: boolean;           // Detectar formatos disponíveis
}

/**
 * Helper para criar artigo mínimo válido
 */
export function createMinimalArticle(
  id: string,
  title: string,
  source: string
): AcademicArticle {
  return {
    id,
    title,
    authors: [],
    source,
    isOpenAccess: false,
  };
}

/**
 * Type guard para verificar se é artigo válido
 */
export function isValidArticle(obj: any): obj is AcademicArticle {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.authors) &&
    typeof obj.source === 'string' &&
    typeof obj.isOpenAccess === 'boolean'
  );
}

/**
 * Helper para obter prioridade baseado no score
 */
export function getPriorityFromScore(score: number): ArticlePriority {
  if (score >= 75) return 'P1';  // Excelente
  if (score >= 50) return 'P2';  // Bom
  return 'P3';                   // Aceitável
}

// ============================================
// QUALITY METRICS TYPES
// ============================================

/**
 * Métricas detalhadas de qualidade de um artigo
 */
export interface ArticleQualityMetrics {
  citationCount: number;
  citationsPerYear: number;
  journalImpactFactor?: number;
  recency: number;                    // Years since publication
  semanticRelevance: number;          // 0-1 (cosine similarity with query)
  authorHIndex?: number;
  qualityScore: number;               // 0-100
  formatQuality?: number;             // Bonus for structured formats
  bestFormat?: ArticleFormat | string;
}

/**
 * Artigo enriquecido com métricas de qualidade e prioridade
 */
export interface EnrichedArticle extends AcademicArticle {
  metrics: ArticleQualityMetrics;
  priority: 1 | 2 | 3;               // P1=1, P2=2, P3=3
}

// ============================================
// AVAILABLE FORMAT TYPES
// ============================================

/**
 * Formato disponível para download/parsing
 */
export interface AvailableFormat {
  format: ArticleFormat | string;  // jats, latex, pdf, etc
  url?: string;                    // URL para download
  content?: string;                // Conteúdo direto (CORE)
  priority: number;                // 1-10 (maior = melhor)
  validated: boolean;              // URL testada?
  size?: number;                   // Bytes
  quality?: 'high' | 'medium' | 'low';
}

// ============================================
// COMPATIBILITY ALIASES
// ============================================

/**
 * Aliases para compatibilidade com código legado
 * Mapeia nomes antigos para novos campos
 */
export interface AcademicArticleCompat extends AcademicArticle {
  // Aliases para código que usa nomes em português
  titulo?: string;        // Alias para title
  resumo?: string;        // Alias para abstract
  autores?: string[];     // Alias para authors
  ano?: number;           // Alias para year
  fonte?: string;         // Alias para journal
  link?: string;          // Alias para url
  citacoes?: number;      // Alias para citationCount
  score?: number;         // Alias para searchMetadata.relevanceScore
}
