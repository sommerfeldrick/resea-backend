/**
 * System-wide constants and configuration
 * Centralized configuration for quality scoring, thresholds, and article requirements
 */

import type { ArticlePriority, StandardSection } from '../types';

// ============================================
// QUALITY SCORING THRESHOLDS
// ============================================

/**
 * Quality score thresholds (0-100 scale)
 */
export const QUALITY_THRESHOLDS = {
  P1_MIN: 75,  // Excellent quality (P1)
  P2_MIN: 50,  // Good quality (P2)
  P3_MIN: 30,  // Acceptable quality (P3)
  MINIMUM: 20, // Absolute minimum to not be filtered
} as const;

/**
 * Quality factor weights for scoring (must sum to 100)
 */
export const QUALITY_WEIGHTS = {
  hasFullText: 25,           // +25 points for full text availability
  hasStructuredData: 15,     // +15 points for JATS/LaTeX/TEI
  isOpenAccess: 20,          // +20 points for open access
  citationCount: 15,         // Up to +15 based on citations
  hasAbstract: 10,           // +10 points for abstract
  hasReferences: 10,         // +10 points for references
  yearRecency: 5,            // Up to +5 based on publication year
} as const;

/**
 * Citation count ranges for quality scoring
 */
export const CITATION_RANGES = {
  EXCELLENT: 100,   // 100+ citations = max score
  GOOD: 50,         // 50+ citations = high score
  ACCEPTABLE: 10,   // 10+ citations = medium score
  MIN: 1,           // 1+ citations = low score
} as const;

/**
 * Year recency scoring (more recent = higher score)
 */
export const YEAR_RECENCY = {
  CURRENT_YEAR_BONUS: 5,    // Published this year
  LAST_3_YEARS: 4,          // Published in last 3 years
  LAST_5_YEARS: 3,          // Published in last 5 years
  LAST_10_YEARS: 2,         // Published in last 10 years
  OLDER: 1,                 // Older than 10 years
} as const;

/**
 * Quality weights for advanced scoring (alternative system)
 * Used by QualityScorer service
 */
export const QUALITY_WEIGHTS_ADVANCED = {
  citations: 0.30,    // 30% weight for citation count
  trend: 0.20,        // 20% weight for citation trend (cit/year)
  impact: 0.20,       // 20% weight for journal impact factor
  recency: 0.15,      // 15% weight for recency
  relevance: 0.10,    // 10% weight for semantic relevance
  author: 0.05,       // 5% weight for author H-index
} as const;

/**
 * Recency scores by age brackets
 */
export const RECENCY_SCORES = {
  veryRecent: { maxYears: 1, score: 15 },    // < 1 year
  recent: { maxYears: 3, score: 12 },        // 1-3 years
  medium: { maxYears: 5, score: 9 },         // 3-5 years
  old: { maxYears: 10, score: 5 },           // 5-10 years
  veryOld: { maxYears: Infinity, score: 2 }, // 10+ years
} as const;

/**
 * Format quality bonuses (0-8 points)
 */
export const FORMAT_BONUS: Record<string, number> = {
  jats: 8,      // JATS XML (best structure)
  tei: 7,       // TEI XML (GROBID output)
  latex: 6,     // LaTeX source
  json: 5,      // JSON structured
  html: 4,      // HTML semantic
  epub: 3,      // EPUB
  pdf: 2,       // PDF (requires parsing)
  plain: 0,     // Plain text (no bonus)
} as const;

/**
 * Format priorities for content acquisition (1-10, higher = better)
 * Used by multi-format-detector to prioritize download attempts
 */
export const FORMAT_PRIORITY: Record<string, number> = {
  'jats-xml': 10,        // JATS XML (best structure)
  'tei-xml': 9,          // TEI XML (GROBID)
  'latex-source': 8,     // LaTeX source
  'json-structured': 7,  // JSON structured
  'html-semantic': 6,    // HTML semantic
  'epub': 5,             // EPUB
  'pdf': 4,              // PDF
  'docx': 3,             // Word document
  'txt': 2,              // Plain text
} as const;

/**
 * Journal and conference tiers for impact scoring
 */
export const JOURNAL_TIERS = {
  tier1: {
    score: 20,
    journals: [
      'NATURE',
      'SCIENCE',
      'CELL',
      'LANCET',
      'NEW ENGLAND JOURNAL OF MEDICINE',
      'NEJM',
      'JAMA',
      'BMJ',
      'PNAS',
      'NATURE COMMUNICATIONS',
      'NATURE METHODS',
      'NATURE BIOTECHNOLOGY',
    ],
    conferences: [
      'NEURIPS',
      'ICML',
      'ICLR',
      'CVPR',
      'ICCV',
      'ECCV',
      'ACL',
      'EMNLP',
      'NAACL',
      'SIGMOD',
      'VLDB',
      'KDD',
    ],
  },
  tier2: {
    score: 12,
    journals: [
      'PLOS',
      'SCIENTIFIC REPORTS',
      'ELIFE',
      'FRONTIERS',
      'BMC',
      'SPRINGER',
      'ELSEVIER',
      'WILEY',
      'OXFORD',
      'CAMBRIDGE',
    ],
    conferences: [
      'AAAI',
      'IJCAI',
      'ICRA',
      'IROS',
      'RSS',
      'SIGGRAPH',
      'CHI',
      'WWW',
      'ICSE',
      'ASE',
    ],
  },
  tier3: {
    score: 5,
    journals: [],  // Default for unknown journals
    conferences: [],
  },
} as const;

// ============================================
// ARTICLE TYPE REQUIREMENTS
// ============================================

/**
 * Minimum requirements by article type
 */
export const ARTICLE_REQUIREMENTS = {
  review: {
    minWordCount: 3000,
    minReferences: 30,
    minCitations: 10,
    requiredSections: ['introduction', 'conclusion'] as StandardSection[],
    preferredSections: ['methodology', 'results', 'discussion'] as StandardSection[],
  },
  research: {
    minWordCount: 2000,
    minReferences: 20,
    minCitations: 5,
    requiredSections: ['abstract', 'introduction', 'methods', 'results', 'conclusion'] as StandardSection[],
    preferredSections: ['discussion'] as StandardSection[],
  },
  shortCommunication: {
    minWordCount: 1000,
    minReferences: 10,
    minCitations: 1,
    requiredSections: ['abstract'] as StandardSection[],
    preferredSections: ['introduction', 'results'] as StandardSection[],
  },
  preprint: {
    minWordCount: 1500,
    minReferences: 10,
    minCitations: 0,
    requiredSections: ['abstract'] as StandardSection[],
    preferredSections: ['introduction', 'methods', 'results'] as StandardSection[],
  },
} as const;

// ============================================
// SEARCH CONFIGURATION
// ============================================

/**
 * RRF (Reciprocal Rank Fusion) constant for hybrid search
 * Score = weight / (RRF_CONSTANT + rank)
 */
export const RRF_CONSTANT = 60;

/**
 * Target article count by work section
 * Used by exhaustive search to determine when to stop
 */
export const ARTICLE_COUNT_BY_SECTION: Record<string, number> = {
  introduction: 20,
  literatureReview: 50,
  methodology: 15,
  results: 10,
  discussion: 20,
  conclusion: 10,
} as const;

/**
 * Default search limits
 */
export const SEARCH_LIMITS = {
  DEFAULT_MAX_RESULTS: 100,
  DEFAULT_MIN_RESULTS: 20,
  DEFAULT_TIMEOUT: 30000,      // 30 seconds
  API_TIMEOUT: 10000,          // 10 seconds per API
  MAX_PARALLEL_APIS: 13,       // All APIs in parallel
  MAX_ENRICHMENT_PAPERS: 5,    // Enrich top 5 with full text
} as const;

/**
 * Phase-based search configuration
 */
export const PHASE_CONFIG = {
  P1: {
    minResults: 20,
    timeout: 5000,    // 5 seconds
    minQualityScore: 75,
    requireAbstract: true,
    minCitations: 5,
  },
  P2: {
    minResults: 30,
    timeout: 8000,    // 8 seconds
    minQualityScore: 50,
    requireAbstract: true,
    minCitations: 1,
  },
  P3: {
    minResults: 50,
    timeout: 10000,   // 10 seconds
    minQualityScore: 30,
    requireAbstract: false,
    minCitations: 0,
  },
} as const;

/**
 * Relevance filtering
 */
export const RELEVANCE_CONFIG = {
  MIN_SIMILARITY: 0.3,         // Minimum cosine similarity
  KEYWORD_MATCH_BONUS: 0.1,    // Bonus for keyword matches
  TITLE_WEIGHT: 0.4,           // Title similarity weight
  ABSTRACT_WEIGHT: 0.6,        // Abstract similarity weight
} as const;

// ============================================
// CONTENT PARSING CONFIGURATION
// ============================================

/**
 * Chunking configuration for RAG
 */
export const CHUNKING_CONFIG = {
  MIN_CHUNK_SIZE: 50,          // Minimum words per chunk
  MAX_CHUNK_SIZE: 500,         // Maximum words per chunk
  TARGET_CHUNK_SIZE: 200,      // Target words per chunk
  OVERLAP_SIZE: 50,            // Words overlap between chunks
  INCLUDE_CONTEXT: true,       // Include previous/next chunk IDs
  INCLUDE_SECTION_TITLE: true, // Prepend section title to chunk
} as const;

/**
 * Format parsing priorities (higher = try first)
 */
export const FORMAT_PRIORITIES = {
  jats: 10,      // JATS XML (best structure)
  tei: 9,        // TEI XML (GROBID output)
  latex: 8,      // LaTeX source
  json: 7,       // JSON structured
  html: 6,       // HTML semantic
  epub: 5,       // EPUB
  pdf: 3,        // PDF (requires OCR/parsing)
  plain: 1,      // Plain text (fallback)
} as const;

/**
 * Section detection patterns (regex)
 */
export const SECTION_PATTERNS = {
  abstract: /(?:abstract|resumo|resumen)/i,
  introduction: /(?:introduction|introdução|introducción|background)/i,
  methods: /(?:methods?|methodology|materiais?\s+e\s+métodos|métodos)/i,
  results: /(?:results?|resultados?|findings)/i,
  discussion: /(?:discussion|discussão|discusión)/i,
  conclusion: /(?:conclusion|conclusão|conclusión|final\s+remarks)/i,
  acknowledgments: /(?:acknowledgments?|agradecimentos)/i,
  references: /(?:references|bibliografia|referências)/i,
} as const;

// ============================================
// CACHE CONFIGURATION
// ============================================

/**
 * Cache TTLs (time to live in milliseconds)
 */
export const CACHE_TTL = {
  SEARCH_RESULTS: 3600000,     // 1 hour
  EMBEDDINGS: Infinity,        // Persistent (never expire)
  PDF_CONTENT: 86400000,       // 24 hours
  API_RESPONSE: 1800000,       // 30 minutes
  USER_FAVORITES: Infinity,    // Persistent
  USER_HISTORY: Infinity,      // Persistent
  TEMPLATES: Infinity,         // Persistent
} as const;

/**
 * Cache size limits
 */
export const CACHE_LIMITS = {
  MAX_EMBEDDINGS: 1000,        // Max 1000 embeddings in memory
  MAX_SEARCH_RESULTS: 100,     // Max 100 search result sets
  MAX_PDF_CONTENT: 50,         // Max 50 PDF contents
  CLEANUP_INTERVAL: 300000,    // Cleanup every 5 minutes
} as const;

// ============================================
// EMBEDDINGS CONFIGURATION
// ============================================

/**
 * Embeddings service configuration (OpenRouter)
 */
export const EMBEDDINGS_CONFIG = {
  MODEL: 'text-embedding-3-small',  // OpenRouter embedding model
  DIMENSION: 1536,                  // Embedding dimension (text-embedding-3-small)
  MAX_TEXT_LENGTH: 8000,            // Max tokens to embed (~32k chars)
  BATCH_SIZE: 100,                  // Batch size for parallel generation
  RATE_LIMIT_DELAY: 100,            // Initial delay between batches (ms)
  MAX_RATE_LIMIT_DELAY: 500,        // Max delay between batches (ms)
  ENABLE_COMPRESSION: true,         // Gzip compression (~60% savings)
} as const;

/**
 * Similarity thresholds
 */
export const SIMILARITY_THRESHOLDS = {
  VERY_SIMILAR: 0.85,          // Almost identical
  SIMILAR: 0.70,               // Clearly related
  SOMEWHAT_SIMILAR: 0.50,      // Possibly related
  BARELY_SIMILAR: 0.30,        // Weak relation
  NOT_SIMILAR: 0.00,           // No relation
} as const;

// ============================================
// AI PROVIDER CONFIGURATION
// ============================================

/**
 * OpenRouter configuration
 */
export const OPENROUTER_CONFIG = {
  API_KEY: process.env.OPENROUTER_API_KEY,
  BASE_URL: 'https://openrouter.ai/api/v1',
  SITE_URL: 'https://smileai.com.br',
  SITE_NAME: 'SmileAI',
  DEFAULT_MODEL: 'minimax/minimax-m2:free',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  TIMEOUT: 60000,              // 60 seconds
} as const;

/**
 * AI provider priorities (higher = try first)
 */
export const AI_PROVIDER_PRIORITY = {
  openrouter: 10,  // Preferred (OpenRouter with minimax free model)
  ollama: 9,       // Local (if available)
  gemini: 8,       // Fallback 1 (free tier)
  groq: 7,         // Fallback 2 (fast, free tier)
  claude: 6,       // Fallback 3 (high quality)
  openai: 5,       // Fallback 4 (reliable)
} as const;

/**
 * AI generation defaults
 */
export const AI_DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 1000,
  TIMEOUT: 60000,              // 60 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,           // 1 second
} as const;

// ============================================
// CITATION FORMATS
// ============================================

/**
 * Citation format templates
 */
export const CITATION_FORMATS = {
  ABNT: '[CITE:{source}] ({authors}, {year})',
  APA: '({authors}, {year})',
  MLA: '({authors})',
  CHICAGO: '({authors} {year})',
  VANCOUVER: '[{index}]',
} as const;

/**
 * Default citation format
 */
export const DEFAULT_CITATION_FORMAT = 'ABNT' as const;

// ============================================
// FILE SIZE LIMITS
// ============================================

/**
 * Maximum file sizes (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  MAX_PDF_SIZE: 50 * 1024 * 1024,      // 50 MB
  MAX_UPLOAD_SIZE: 100 * 1024 * 1024,  // 100 MB
  MAX_RESPONSE_SIZE: 10 * 1024 * 1024, // 10 MB
} as const;

// ============================================
// LOGGING CONFIGURATION
// ============================================

/**
 * Log levels by environment
 */
export const LOG_LEVELS = {
  development: 'debug',
  production: 'info',
  test: 'error',
} as const;

/**
 * Features to log
 */
export const LOG_FEATURES = {
  API_CALLS: true,
  CACHE_HITS: true,
  ERRORS: true,
  PERFORMANCE: true,
  SEARCH_RESULTS: true,
  AI_USAGE: true,
} as const;

// ============================================
// RATE LIMITING (Global)
// ============================================

/**
 * Global rate limits (to protect our server)
 */
export const RATE_LIMITS = {
  GLOBAL_MAX_REQUESTS_PER_MINUTE: 100,
  PER_USER_MAX_REQUESTS_PER_MINUTE: 20,
  PER_IP_MAX_REQUESTS_PER_MINUTE: 30,
} as const;

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Get priority from quality score
 */
export function getPriority(score: number): ArticlePriority {
  if (score >= QUALITY_THRESHOLDS.P1_MIN) return 'P1';
  if (score >= QUALITY_THRESHOLDS.P2_MIN) return 'P2';
  return 'P3';
}

/**
 * Check if score meets minimum threshold
 */
export function meetsMinimumQuality(score: number): boolean {
  return score >= QUALITY_THRESHOLDS.MINIMUM;
}

/**
 * Calculate year recency bonus
 */
export function getYearRecencyBonus(year: number): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  if (age === 0) return YEAR_RECENCY.CURRENT_YEAR_BONUS;
  if (age <= 3) return YEAR_RECENCY.LAST_3_YEARS;
  if (age <= 5) return YEAR_RECENCY.LAST_5_YEARS;
  if (age <= 10) return YEAR_RECENCY.LAST_10_YEARS;
  return YEAR_RECENCY.OLDER;
}

/**
 * Calculate citation score (0-15 scale)
 */
export function getCitationScore(citations: number): number {
  const maxScore = QUALITY_WEIGHTS.citationCount;

  if (citations >= CITATION_RANGES.EXCELLENT) return maxScore;
  if (citations >= CITATION_RANGES.GOOD) return maxScore * 0.8;
  if (citations >= CITATION_RANGES.ACCEPTABLE) return maxScore * 0.5;
  if (citations >= CITATION_RANGES.MIN) return maxScore * 0.2;
  return 0;
}
