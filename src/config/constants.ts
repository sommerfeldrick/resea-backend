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
 * Embeddings service configuration
 */
export const EMBEDDINGS_CONFIG = {
  MODEL: 'nomic-embed-text',   // Ollama model
  DIMENSION: 768,              // Embedding dimension
  MAX_TEXT_LENGTH: 2048,       // Max tokens to embed
  BATCH_SIZE: 10,              // Batch size for parallel generation
  RATE_LIMIT_DELAY: 100,       // Initial delay between batches (ms)
  MAX_RATE_LIMIT_DELAY: 500,   // Max delay between batches (ms)
  ENABLE_COMPRESSION: true,    // Gzip compression (~60% savings)
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
 * AI provider priorities (higher = try first)
 */
export const AI_PROVIDER_PRIORITY = {
  ollama: 10,      // Preferred (free, local/cloud)
  gemini: 9,       // Fallback 1 (free tier)
  groq: 8,         // Fallback 2 (fast, free tier)
  claude: 7,       // Fallback 3 (high quality)
  openai: 6,       // Fallback 4 (reliable)
} as const;

/**
 * AI generation defaults
 */
export const AI_DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4000,
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
