/**
 * Article Limits Configuration
 *
 * Configurable limits for articles per work type and section
 * Can be overridden via environment variables in Render
 */

import { logger } from './logger.js';

export interface ArticleLimits {
  maxForGeneration: number;  // Limite para geração de conteúdo
  maxForGraph: number;        // Limite para geração do grafo
  targetArticles: number;     // Target de artigos para buscar
}

export interface SectionLimits {
  [section: string]: ArticleLimits;
}

export interface WorkTypeLimits {
  [workType: string]: SectionLimits;
}

// ============================================================
// DEFAULT LIMITS (usado se ENV não existir)
// ============================================================
const DEFAULT_LIMITS: WorkTypeLimits = {
  tcc: {
    introducao: { maxForGeneration: 20, maxForGraph: 20, targetArticles: 25 },
    revisao: { maxForGeneration: 40, maxForGraph: 40, targetArticles: 50 },
    metodologia: { maxForGeneration: 15, maxForGraph: 15, targetArticles: 20 },
    resultados: { maxForGeneration: 20, maxForGraph: 20, targetArticles: 25 },
    discussao: { maxForGeneration: 35, maxForGraph: 35, targetArticles: 45 },
    conclusao: { maxForGeneration: 12, maxForGraph: 12, targetArticles: 15 },
    completo_padrao: { maxForGeneration: 40, maxForGraph: 40, targetArticles: 50 }
  },
  dissertacao: {
    introducao: { maxForGeneration: 35, maxForGraph: 35, targetArticles: 45 },
    revisao: { maxForGeneration: 100, maxForGraph: 80, targetArticles: 120 },
    metodologia: { maxForGeneration: 30, maxForGraph: 30, targetArticles: 35 },
    resultados: { maxForGeneration: 50, maxForGraph: 50, targetArticles: 60 },
    discussao: { maxForGeneration: 80, maxForGraph: 70, targetArticles: 100 },
    conclusao: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 },
    completo_padrao: { maxForGeneration: 100, maxForGraph: 80, targetArticles: 120 }
  },
  tese: {
    introducao: { maxForGeneration: 60, maxForGraph: 60, targetArticles: 75 },
    revisao: { maxForGeneration: 180, maxForGraph: 150, targetArticles: 200 },
    metodologia: { maxForGeneration: 50, maxForGraph: 50, targetArticles: 60 },
    resultados: { maxForGeneration: 100, maxForGraph: 90, targetArticles: 120 },
    discussao: { maxForGeneration: 150, maxForGraph: 130, targetArticles: 180 },
    conclusao: { maxForGeneration: 40, maxForGraph: 40, targetArticles: 50 },
    completo_padrao: { maxForGeneration: 180, maxForGraph: 150, targetArticles: 200 }
  },
  artigo_cientifico: {
    // Publicação em revista - 15-25 páginas - ~30 artigos
    empirico: { maxForGeneration: 30, maxForGraph: 30, targetArticles: 35 },
    revisao_literatura: { maxForGeneration: 40, maxForGraph: 38, targetArticles: 48 },
    estudo_caso: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 },
    teorico: { maxForGeneration: 28, maxForGraph: 28, targetArticles: 35 },
    metodologico: { maxForGeneration: 30, maxForGraph: 30, targetArticles: 35 },
    completo_padrao: { maxForGeneration: 30, maxForGraph: 30, targetArticles: 35 }
  },
  revisao_sistematica: {
    // Síntese de evidências - 20-40 páginas - Protocolo rigoroso - ~60 artigos
    introducao: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 },
    protocolo: { maxForGeneration: 30, maxForGraph: 30, targetArticles: 35 },
    criterios: { maxForGeneration: 20, maxForGraph: 20, targetArticles: 25 },
    resultados: { maxForGeneration: 50, maxForGraph: 48, targetArticles: 60 },
    discussao: { maxForGeneration: 45, maxForGraph: 42, targetArticles: 55 },
    completo: { maxForGeneration: 60, maxForGraph: 55, targetArticles: 70 },
    completo_padrao: { maxForGeneration: 60, maxForGraph: 55, targetArticles: 70 }
  },
  projeto_pesquisa: {
    // Proposta de pesquisa - 10-20 páginas - Fundamentação teórica - ~25 artigos
    introducao: { maxForGeneration: 15, maxForGraph: 15, targetArticles: 18 },
    objetivos: { maxForGeneration: 12, maxForGraph: 12, targetArticles: 15 },
    referencial: { maxForGeneration: 30, maxForGraph: 28, targetArticles: 35 },
    metodologia: { maxForGeneration: 18, maxForGraph: 18, targetArticles: 22 },
    cronograma: { maxForGeneration: 10, maxForGraph: 10, targetArticles: 12 },
    completo: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 },
    completo_padrao: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 }
  },
  relatorio_tecnico: {
    // Documentação profissional - Formato variável - ~20 artigos
    executivo: { maxForGeneration: 15, maxForGraph: 15, targetArticles: 18 },
    diagnostico: { maxForGeneration: 22, maxForGraph: 22, targetArticles: 28 },
    metodologia: { maxForGeneration: 15, maxForGraph: 15, targetArticles: 18 },
    resultados: { maxForGeneration: 25, maxForGraph: 25, targetArticles: 30 },
    recomendacoes: { maxForGeneration: 18, maxForGraph: 18, targetArticles: 22 },
    completo: { maxForGeneration: 20, maxForGraph: 20, targetArticles: 25 },
    completo_padrao: { maxForGeneration: 20, maxForGraph: 20, targetArticles: 25 }
  }
};

// Fallback genérico
const GENERIC_LIMITS: ArticleLimits = {
  maxForGeneration: 40,
  maxForGraph: 40,
  targetArticles: 50
};

class ArticleLimitsConfig {
  private limits: WorkTypeLimits;

  constructor() {
    this.limits = this.loadLimitsFromEnv();
  }

  /**
   * Load limits from environment variable or use defaults
   */
  private loadLimitsFromEnv(): WorkTypeLimits {
    const envLimits = process.env.ARTICLE_LIMITS_CONFIG;

    if (envLimits) {
      try {
        const parsed = JSON.parse(envLimits);
        logger.info('✅ Article limits loaded from environment variables');

        // Merge com defaults (permite override parcial)
        return this.mergeLimits(DEFAULT_LIMITS, parsed);
      } catch (error: any) {
        logger.error('Failed to parse ARTICLE_LIMITS_CONFIG, using defaults', {
          error: error.message
        });
        return DEFAULT_LIMITS;
      }
    }

    logger.info('📋 Using default article limits configuration');
    return DEFAULT_LIMITS;
  }

  /**
   * Merge custom limits with defaults (deep merge)
   */
  private mergeLimits(defaults: WorkTypeLimits, custom: Partial<WorkTypeLimits>): WorkTypeLimits {
    const merged = { ...defaults };

    for (const [workType, sections] of Object.entries(custom)) {
      if (!merged[workType]) {
        merged[workType] = sections as SectionLimits;
      } else {
        merged[workType] = { ...merged[workType], ...sections };
      }
    }

    return merged;
  }

  /**
   * Get limits for specific work type and section
   */
  getLimits(workType: string, section?: string): ArticleLimits {
    const workTypeLimits = this.limits[workType];

    if (!workTypeLimits) {
      logger.warn(`Unknown work type: ${workType}, using generic limits`, {
        workType,
        section
      });
      return GENERIC_LIMITS;
    }

    // Se não especificar seção, usar 'completo_padrao'
    const sectionKey = section || 'completo_padrao';
    const sectionLimits = workTypeLimits[sectionKey];

    if (!sectionLimits) {
      // Fallback para completo_padrao
      const fallback = workTypeLimits['completo_padrao'] || GENERIC_LIMITS;
      logger.debug(`Section not found: ${sectionKey}, using fallback`, {
        workType,
        section: sectionKey,
        fallback
      });
      return fallback;
    }

    logger.debug('Article limits retrieved', {
      workType,
      section: sectionKey,
      limits: sectionLimits
    });

    return sectionLimits;
  }

  /**
   * Get all configured work types
   */
  getAvailableWorkTypes(): string[] {
    return Object.keys(this.limits);
  }

  /**
   * Get all sections for a work type
   */
  getSectionsForWorkType(workType: string): string[] {
    const workTypeLimits = this.limits[workType];
    return workTypeLimits ? Object.keys(workTypeLimits) : [];
  }

  /**
   * Reload configuration from environment (useful for hot-reload)
   */
  reload(): void {
    this.limits = this.loadLimitsFromEnv();
    logger.info('Article limits configuration reloaded');
  }

  /**
   * Get current configuration (for debugging)
   */
  getCurrentConfig(): WorkTypeLimits {
    return this.limits;
  }
}

// Singleton export
export const articleLimitsConfig = new ArticleLimitsConfig();
