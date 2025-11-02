/**
 * API configurations for all 13 academic search providers
 * Each API has its own config with endpoints, rate limits, and authentication
 */

export interface APIConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;              // 1-10 (higher = better quality)
  phase: 'P1' | 'P2' | 'P3';    // Search phase assignment

  // Rate limiting
  rateLimit: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  // Authentication
  auth: {
    required: boolean;
    type?: 'apiKey' | 'bearer' | 'basic' | 'none';
    envVar?: string;             // Environment variable name
  };

  // Endpoints
  endpoints: {
    search: string;
    article?: string;
    metadata?: string;
  };

  // Capabilities
  capabilities: {
    fullText: boolean;
    structuredData: boolean;     // JATS/LaTeX/TEI
    openAccess: boolean;
    citations: boolean;
    abstracts: boolean;
    references: boolean;
  };

  // Coverage
  coverage: {
    count: string;               // e.g., "240M articles"
    areas: string[];             // Subject areas
    updateFrequency: string;     // e.g., "daily"
  };

  // Request configuration
  request: {
    timeout: number;             // ms
    maxResults: number;          // Max results per request
    defaultFields?: string[];    // Fields to request
  };
}

// ============================================
// API CONFIGURATIONS
// ============================================

export const API_CONFIGS: Record<string, APIConfig> = {
  /**
   * OpenAlex - 240M works, multidisciplinary
   * Priority: P1 (excellent coverage, structured data)
   */
  openalex: {
    name: 'openalex',
    displayName: 'OpenAlex',
    baseUrl: 'https://api.openalex.org',
    enabled: true,
    priority: 10,
    phase: 'P1',

    rateLimit: {
      requestsPerSecond: 10,     // Polite pool (no limit technically)
    },

    auth: {
      required: false,
      type: 'none',
      envVar: 'OPENALEX_EMAIL',  // Optional for polite pool
    },

    endpoints: {
      search: '/works',
      article: '/works/{id}',
    },

    capabilities: {
      fullText: false,
      structuredData: true,
      openAccess: true,
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '240M works',
      areas: ['multidisciplinary'],
      updateFrequency: 'weekly',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
      defaultFields: ['title', 'abstract', 'authorships', 'publication_year', 'doi', 'open_access'],
    },
  },

  /**
   * Semantic Scholar - 200M articles, CS/Medicine focus
   * Priority: P1 (high quality, AI features)
   */
  semanticScholar: {
    name: 'semanticScholar',
    displayName: 'Semantic Scholar',
    baseUrl: 'https://api.semanticscholar.org/graph/v1',
    enabled: true,
    priority: 9,
    phase: 'P1',

    rateLimit: {
      requestsPerSecond: 1,
      requestsPerMinute: 100,
    },

    auth: {
      required: false,
      type: 'apiKey',
      envVar: 'SEMANTIC_SCHOLAR_KEY',
    },

    endpoints: {
      search: '/paper/search',
      article: '/paper/{id}',
    },

    capabilities: {
      fullText: false,
      structuredData: true,
      openAccess: true,
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '200M articles',
      areas: ['computer science', 'medicine', 'biology'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
      defaultFields: ['title', 'abstract', 'authors', 'year', 'citationCount', 'openAccessPdf'],
    },
  },

  /**
   * PubMed - 36M biomedical articles
   * Priority: P1 (authoritative biomedical source)
   */
  pubmed: {
    name: 'pubmed',
    displayName: 'PubMed',
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    enabled: true,
    priority: 9,
    phase: 'P1',

    rateLimit: {
      requestsPerSecond: 10,     // With API key (3 without)
    },

    auth: {
      required: false,
      type: 'apiKey',
      envVar: 'PUBMED_API_KEY',
    },

    endpoints: {
      search: '/esearch.fcgi',
      article: '/efetch.fcgi',
      metadata: '/esummary.fcgi',
    },

    capabilities: {
      fullText: true,            // Via PMC
      structuredData: true,      // JATS XML
      openAccess: true,          // PMC OA subset
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '36M articles',
      areas: ['biomedicine', 'life sciences'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * CORE - 139M OA articles
   * Priority: P2 (good OA coverage)
   */
  core: {
    name: 'core',
    displayName: 'CORE',
    baseUrl: 'https://api.core.ac.uk/v3',
    enabled: true,
    priority: 8,
    phase: 'P2',

    rateLimit: {
      requestsPerSecond: 1,      // 10 requests per 10 seconds
    },

    auth: {
      required: false,
      type: 'apiKey',
      envVar: 'CORE_API_KEY',
    },

    endpoints: {
      search: '/search/works',
      article: '/works/{id}',
    },

    capabilities: {
      fullText: true,
      structuredData: false,
      openAccess: true,
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '139M articles',
      areas: ['multidisciplinary', 'open access'],
      updateFrequency: 'weekly',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * Europe PMC - 8.1M full-text biomedical articles
   * Priority: P2 (excellent full-text, entity extraction)
   */
  europepmc: {
    name: 'europepmc',
    displayName: 'Europe PMC',
    baseUrl: 'https://www.ebi.ac.uk/europepmc/webservices/rest',
    enabled: true,
    priority: 8,
    phase: 'P2',

    rateLimit: {
      requestsPerSecond: 10,
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/search',
      article: '/article/{id}',
    },

    capabilities: {
      fullText: true,
      structuredData: true,      // JATS XML
      openAccess: true,
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '8.1M full-text',
      areas: ['biomedicine', 'life sciences'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * arXiv - 2.4M preprints (Physics, CS, Math)
   * Priority: P2 (preprints, LaTeX source)
   */
  arxiv: {
    name: 'arxiv',
    displayName: 'arXiv',
    baseUrl: 'http://export.arxiv.org/api',
    enabled: true,
    priority: 7,
    phase: 'P2',

    rateLimit: {
      requestsPerSecond: 0.33,   // 1 request per 3 seconds
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/query',
    },

    capabilities: {
      fullText: true,            // PDF + LaTeX source
      structuredData: true,      // LaTeX
      openAccess: true,          // 100% OA
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '2.4M preprints',
      areas: ['physics', 'computer science', 'mathematics', 'quantitative biology'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 15000,            // Slower API
      maxResults: 100,
    },
  },

  /**
   * DOAJ - 11M articles from 21K OA journals
   * Priority: P2 (quality OA journals)
   */
  doaj: {
    name: 'doaj',
    displayName: 'DOAJ',
    baseUrl: 'https://doaj.org/api/v3',
    enabled: true,
    priority: 7,
    phase: 'P2',

    rateLimit: {
      requestsPerSecond: 2,
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/search/articles',
    },

    capabilities: {
      fullText: true,
      structuredData: false,
      openAccess: true,          // 100% OA
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '11M articles',
      areas: ['multidisciplinary', 'open access journals'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * PLOS - 300K 100% OA articles
   * Priority: P3 (small but high quality)
   */
  plos: {
    name: 'plos',
    displayName: 'PLOS',
    baseUrl: 'https://api.plos.org',
    enabled: true,
    priority: 6,
    phase: 'P3',

    rateLimit: {
      requestsPerHour: 300,
      requestsPerDay: 7200,
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/search',
    },

    capabilities: {
      fullText: true,            // 100% full text
      structuredData: true,      // JATS XML
      openAccess: true,          // 100% OA
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '300K articles',
      areas: ['biology', 'medicine'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * bioRxiv - 200K+ biology preprints
   * Priority: P3 (preprints, smaller)
   */
  biorxiv: {
    name: 'biorxiv',
    displayName: 'bioRxiv',
    baseUrl: 'https://api.biorxiv.org',
    enabled: true,
    priority: 6,
    phase: 'P3',

    rateLimit: {
      requestsPerSecond: 1,      // Not specified, being conservative
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/details/biorxiv',
    },

    capabilities: {
      fullText: true,            // PDF available
      structuredData: false,
      openAccess: true,          // 100% OA
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '200K+ preprints',
      areas: ['biology'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * medRxiv - 100K+ medical preprints
   * Priority: P3 (preprints, smaller)
   */
  medrxiv: {
    name: 'medrxiv',
    displayName: 'medRxiv',
    baseUrl: 'https://api.biorxiv.org',
    enabled: true,
    priority: 6,
    phase: 'P3',

    rateLimit: {
      requestsPerSecond: 1,      // Same as bioRxiv
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/details/medrxiv',
    },

    capabilities: {
      fullText: true,
      structuredData: false,
      openAccess: true,          // 100% OA
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '100K+ preprints',
      areas: ['medicine', 'health sciences'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * OpenAIRE - 150M research products (EU focus)
   * Priority: P3 (good for EU research)
   */
  openaire: {
    name: 'openaire',
    displayName: 'OpenAIRE',
    baseUrl: 'https://api.openaire.eu/graph',
    enabled: true,
    priority: 5,
    phase: 'P3',

    rateLimit: {
      requestsPerSecond: 15,
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/researchProducts',
    },

    capabilities: {
      fullText: false,
      structuredData: true,
      openAccess: true,          // 60% OA
      citations: true,
      abstracts: true,
      references: true,
    },

    coverage: {
      count: '150M products',
      areas: ['multidisciplinary', 'EU-funded research'],
      updateFrequency: 'weekly',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * DataCite - 45M datasets
   * Priority: P3 (datasets, not articles)
   */
  datacite: {
    name: 'datacite',
    displayName: 'DataCite',
    baseUrl: 'https://api.datacite.org',
    enabled: true,
    priority: 4,
    phase: 'P3',

    rateLimit: {
      requestsPerSecond: 10,     // Not specified
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/dois',
    },

    capabilities: {
      fullText: false,
      structuredData: true,
      openAccess: true,
      citations: false,
      abstracts: true,
      references: false,
    },

    coverage: {
      count: '45M datasets',
      areas: ['research data', 'multidisciplinary'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 10000,
      maxResults: 100,
    },
  },

  /**
   * Google Scholar - Unlimited (scraping, backup)
   * Priority: Backup only (risk of blocking)
   */
  googleScholar: {
    name: 'googleScholar',
    displayName: 'Google Scholar',
    baseUrl: 'https://scholar.google.com',
    enabled: true,
    priority: 1,               // Lowest priority (scraping)
    phase: 'P3',

    rateLimit: {
      requestsPerMinute: 10,   // Very conservative (scraping)
    },

    auth: {
      required: false,
      type: 'none',
    },

    endpoints: {
      search: '/scholar',
    },

    capabilities: {
      fullText: false,
      structuredData: false,
      openAccess: false,
      citations: true,
      abstracts: false,
      references: false,
    },

    coverage: {
      count: 'Unlimited',
      areas: ['multidisciplinary'],
      updateFrequency: 'daily',
    },

    request: {
      timeout: 15000,
      maxResults: 20,          // Limited for scraping
    },
  },
};

// ============================================
// API GROUPS BY PHASE
// ============================================

export const API_GROUPS = {
  P1: ['openalex', 'semanticScholar', 'pubmed'],
  P2: ['core', 'europepmc', 'arxiv', 'doaj'],
  P3: ['plos', 'biorxiv', 'medrxiv', 'openaire', 'datacite'],
  BACKUP: ['googleScholar'],
} as const;

// ============================================
// API GROUPS BY SUBJECT AREA
// ============================================

export const API_BY_SUBJECT = {
  biomedicine: ['pubmed', 'europepmc', 'medrxiv', 'plos'],
  computerScience: ['arxiv', 'semanticScholar', 'openalex'],
  physics: ['arxiv', 'openalex'],
  biology: ['biorxiv', 'plos', 'pubmed', 'europepmc'],
  mathematics: ['arxiv', 'openalex'],
  openAccess: ['doaj', 'plos', 'core', 'arxiv', 'biorxiv', 'medrxiv'],
  preprints: ['arxiv', 'biorxiv', 'medrxiv'],
  datasets: ['datacite', 'openaire'],
  europe: ['openaire', 'core', 'europepmc'],
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get APIs by phase
 */
export function getAPIsByPhase(phase: 'P1' | 'P2' | 'P3'): APIConfig[] {
  const apiNames = API_GROUPS[phase];
  return apiNames.map((name) => API_CONFIGS[name]);
}

/**
 * Get APIs by subject area
 */
export function getAPIsBySubject(subject: keyof typeof API_BY_SUBJECT): APIConfig[] {
  const apiNames = API_BY_SUBJECT[subject];
  return apiNames.map((name) => API_CONFIGS[name]);
}

/**
 * Get all enabled APIs
 */
export function getEnabledAPIs(): APIConfig[] {
  return Object.values(API_CONFIGS).filter((api) => api.enabled);
}

/**
 * Get API by name
 */
export function getAPI(name: string): APIConfig | undefined {
  return API_CONFIGS[name];
}

/**
 * Check if API requires authentication
 */
export function requiresAuth(apiName: string): boolean {
  const api = API_CONFIGS[apiName];
  return api?.auth.required ?? false;
}

/**
 * Get API key from environment
 */
export function getAPIKey(apiName: string): string | undefined {
  const api = API_CONFIGS[apiName];
  if (!api?.auth.envVar) return undefined;
  return process.env[api.auth.envVar];
}

/**
 * Get APIs sorted by priority (descending)
 */
export function getAPIsByPriority(): APIConfig[] {
  return Object.values(API_CONFIGS)
    .filter((api) => api.enabled)
    .sort((a, b) => b.priority - a.priority);
}
