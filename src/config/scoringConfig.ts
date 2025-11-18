/**
 * Article Scoring Configuration
 *
 * Configurable thresholds for P1, P2, P3 article classification
 * Can be overridden via environment variables in Render
 */

import { logger } from './logger.js';

export interface ScoringThresholds {
  P1: number;  // Artigos EXCELENTES (default: 70)
  P2: number;  // Artigos BONS (default: 45)
  P3: number;  // Artigos ACEITÁVEIS (default: 30)
  minAcceptable: number;  // Mínimo para não descartar (default: 30)
}

export interface ExpectedResults {
  P1: number;  // Número esperado de artigos P1 por query (default: 12)
  P2: number;  // Número esperado de artigos P2 por query (default: 15)
  P3: number;  // Número esperado de artigos P3 por query (default: 10)
}

export interface ScoringWeights {
  titleRelevance: number;      // Peso da relevância do título (default: 30)
  citations: number;            // Peso das citações (default: 20)
  recency: number;              // Peso da recência (default: 20)
  hasFulltext: number;          // Peso do fulltext disponível (default: 15)
  sourceQuality: number;        // Peso da qualidade da fonte (default: 15)
  hasDoi: number;               // Peso do DOI (default: 5)
  hasCompleteAbstract: number;  // Peso do abstract completo (default: 5)
}

export interface ScoringConfig {
  thresholds: ScoringThresholds;
  expectedResults: ExpectedResults;
  weights: ScoringWeights;
}

// ============================================================
// DEFAULT SCORING CONFIGURATION
// ============================================================
const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  thresholds: {
    P1: 70,              // Score >= 70 = Artigos EXCELENTES
    P2: 45,              // Score >= 45 = Artigos BONS
    P3: 30,              // Score >= 30 = Artigos ACEITÁVEIS
    minAcceptable: 30    // Score < 30 = DESCARTADO
  },
  expectedResults: {
    P1: 12,  // Buscar ~12 artigos P1 por query
    P2: 15,  // Buscar ~15 artigos P2 por query
    P3: 10   // Buscar ~10 artigos P3 por query
  },
  weights: {
    titleRelevance: 30,      // Título é o critério mais importante
    citations: 20,            // Citações indicam impacto
    recency: 20,              // Artigos recentes são valorizados
    hasFulltext: 15,          // Fulltext é essencial
    sourceQuality: 15,        // Fontes confiáveis
    hasDoi: 5,                // DOI indica peer-review
    hasCompleteAbstract: 5    // Abstract completo
  }
};

class ScoringConfigService {
  private config: ScoringConfig;

  constructor() {
    this.config = this.loadConfigFromEnv();
  }

  /**
   * Load scoring config from environment or use defaults
   */
  private loadConfigFromEnv(): ScoringConfig {
    const config = { ...DEFAULT_SCORING_CONFIG };

    // Carregar thresholds
    if (process.env.SCORING_THRESHOLD_P1) {
      config.thresholds.P1 = this.parseNumber(
        process.env.SCORING_THRESHOLD_P1,
        DEFAULT_SCORING_CONFIG.thresholds.P1,
        'SCORING_THRESHOLD_P1'
      );
    }

    if (process.env.SCORING_THRESHOLD_P2) {
      config.thresholds.P2 = this.parseNumber(
        process.env.SCORING_THRESHOLD_P2,
        DEFAULT_SCORING_CONFIG.thresholds.P2,
        'SCORING_THRESHOLD_P2'
      );
    }

    if (process.env.SCORING_THRESHOLD_P3) {
      config.thresholds.P3 = this.parseNumber(
        process.env.SCORING_THRESHOLD_P3,
        DEFAULT_SCORING_CONFIG.thresholds.P3,
        'SCORING_THRESHOLD_P3'
      );
    }

    if (process.env.SCORING_MIN_ACCEPTABLE) {
      config.thresholds.minAcceptable = this.parseNumber(
        process.env.SCORING_MIN_ACCEPTABLE,
        DEFAULT_SCORING_CONFIG.thresholds.minAcceptable,
        'SCORING_MIN_ACCEPTABLE'
      );
    }

    // Carregar expected results
    if (process.env.SCORING_EXPECTED_P1) {
      config.expectedResults.P1 = this.parseNumber(
        process.env.SCORING_EXPECTED_P1,
        DEFAULT_SCORING_CONFIG.expectedResults.P1,
        'SCORING_EXPECTED_P1'
      );
    }

    if (process.env.SCORING_EXPECTED_P2) {
      config.expectedResults.P2 = this.parseNumber(
        process.env.SCORING_EXPECTED_P2,
        DEFAULT_SCORING_CONFIG.expectedResults.P2,
        'SCORING_EXPECTED_P2'
      );
    }

    if (process.env.SCORING_EXPECTED_P3) {
      config.expectedResults.P3 = this.parseNumber(
        process.env.SCORING_EXPECTED_P3,
        DEFAULT_SCORING_CONFIG.expectedResults.P3,
        'SCORING_EXPECTED_P3'
      );
    }

    // Carregar weights (opcional - permite JSON completo)
    if (process.env.SCORING_WEIGHTS) {
      try {
        const customWeights = JSON.parse(process.env.SCORING_WEIGHTS);
        config.weights = { ...config.weights, ...customWeights };
        logger.info('✅ Custom scoring weights loaded from SCORING_WEIGHTS');
      } catch (error: any) {
        logger.error('Failed to parse SCORING_WEIGHTS, using defaults', {
          error: error.message
        });
      }
    }

    // Validar configuração
    this.validateConfig(config);

    logger.info('📊 Scoring configuration loaded', {
      thresholds: config.thresholds,
      expectedResults: config.expectedResults,
      customWeights: !!process.env.SCORING_WEIGHTS
    });

    return config;
  }

  /**
   * Parse number from string with fallback
   */
  private parseNumber(value: string, fallback: number, envVar: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      logger.warn(`Invalid number in ${envVar}: ${value}, using default: ${fallback}`);
      return fallback;
    }
    return parsed;
  }

  /**
   * Validate configuration consistency
   */
  private validateConfig(config: ScoringConfig): void {
    const { P1, P2, P3, minAcceptable } = config.thresholds;

    // Thresholds devem ser decrescentes: P1 > P2 > P3 >= minAcceptable
    if (P1 <= P2 || P2 <= P3 || P3 < minAcceptable) {
      logger.error('Invalid scoring thresholds! Must be: P1 > P2 > P3 >= minAcceptable', {
        P1,
        P2,
        P3,
        minAcceptable
      });
      throw new Error('Invalid scoring configuration: thresholds must be P1 > P2 > P3 >= minAcceptable');
    }

    // Thresholds devem estar entre 0 e 100
    if (P1 > 100 || P2 > 100 || P3 > 100 || minAcceptable > 100 || minAcceptable < 0) {
      logger.error('Scoring thresholds must be between 0 and 100', {
        P1,
        P2,
        P3,
        minAcceptable
      });
      throw new Error('Invalid scoring configuration: thresholds must be between 0 and 100');
    }

    // Weights devem somar ~100 (tolerância de ±5)
    const totalWeight = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
    if (totalWeight < 95 || totalWeight > 105) {
      logger.warn('Scoring weights should sum to ~100', {
        totalWeight,
        weights: config.weights
      });
    }
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ScoringThresholds {
    return this.config.thresholds;
  }

  /**
   * Get expected results per query
   */
  getExpectedResults(): ExpectedResults {
    return this.config.expectedResults;
  }

  /**
   * Get scoring weights
   */
  getWeights(): ScoringWeights {
    return this.config.weights;
  }

  /**
   * Get complete configuration
   */
  getConfig(): ScoringConfig {
    return this.config;
  }

  /**
   * Classify article based on score
   */
  classifyArticle(score: number): 'P1' | 'P2' | 'P3' | 'DISCARD' {
    const { P1, P2, P3, minAcceptable } = this.config.thresholds;

    if (score >= P1) return 'P1';
    if (score >= P2) return 'P2';
    if (score >= P3) return 'P3';
    if (score >= minAcceptable) return 'P3'; // Ainda aceitável mas no limite
    return 'DISCARD';
  }

  /**
   * Check if article should be discarded
   */
  shouldDiscard(score: number): boolean {
    return score < this.config.thresholds.minAcceptable;
  }

  /**
   * Get expected results for a priority level
   */
  getExpectedResultsForPriority(priority: 'P1' | 'P2' | 'P3'): number {
    return this.config.expectedResults[priority];
  }

  /**
   * Reload configuration from environment (useful for hot-reload)
   */
  reload(): void {
    this.config = this.loadConfigFromEnv();
    logger.info('Scoring configuration reloaded');
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary(): string {
    const { P1, P2, P3, minAcceptable } = this.config.thresholds;
    const { expectedResults } = this.config;

    return `
📊 SCORING CONFIGURATION:
  Thresholds:
    P1 (Excellent):  >= ${P1} points  | Expected: ${expectedResults.P1} articles/query
    P2 (Good):       >= ${P2} points  | Expected: ${expectedResults.P2} articles/query
    P3 (Acceptable): >= ${P3} points  | Expected: ${expectedResults.P3} articles/query
    Discard:         < ${minAcceptable} points

  Weights (total: ${Object.values(this.config.weights).reduce((s, w) => s + w, 0)}):
    Title Relevance:    ${this.config.weights.titleRelevance} pts
    Citations:          ${this.config.weights.citations} pts
    Recency:            ${this.config.weights.recency} pts
    Has Fulltext:       ${this.config.weights.hasFulltext} pts
    Source Quality:     ${this.config.weights.sourceQuality} pts
    Has DOI:            ${this.config.weights.hasDoi} pts
    Complete Abstract:  ${this.config.weights.hasCompleteAbstract} pts
    `.trim();
  }
}

// Singleton export
export const scoringConfig = new ScoringConfigService();
