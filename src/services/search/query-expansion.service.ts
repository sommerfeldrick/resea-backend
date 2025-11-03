/**
 * Query Expansion Service
 * Expands queries into primary, secondary, and tertiary queries
 * for phased search (P1 → P2 → P3)
 */

import type { QueryExpansionStrategy } from '../../types/search.types.js';
import { Logger } from '../../utils/simple-logger.js';

export class QueryExpansionService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('QueryExpansion');
  }

  /**
   * Expand query into P1, P2, P3 queries
   */
  async expandQuery(query: string): Promise<QueryExpansionStrategy> {
    this.logger.info(`Expanding query: "${query}"`);

    // Primary query (exact)
    const primaryQuery = query;

    // Secondary queries (synonyms and variations)
    const secondaryQueries = await this.generateSecondaryQueries(query);

    // Tertiary queries (broader)
    const tertiaryQueries = await this.generateTertiaryQueries(query);

    return {
      primaryQuery,
      secondaryQueries,
      tertiaryQueries,
    };
  }

  /**
   * Generate secondary queries (synonyms)
   */
  private async generateSecondaryQueries(query: string): Promise<string[]> {
    const queries: string[] = [];

    // Common PT-BR replacements
    const replacements = [
      { from: /\bIA\b/gi, to: 'inteligência artificial' },
      { from: /\bAI\b/gi, to: 'inteligência artificial' },
      { from: /\bML\b/gi, to: 'machine learning' },
      { from: /\bDL\b/gi, to: 'deep learning' },
      { from: /\beducação\b/gi, to: 'ensino' },
      { from: /\bensino\b/gi, to: 'educação' },
      { from: /\baprendizagem\b/gi, to: 'aprendizado' },
      { from: /\baluno\b/gi, to: 'estudante' },
      { from: /\bprofessor\b/gi, to: 'docente' },
      { from: /\bescola\b/gi, to: 'instituição de ensino' },
    ];

    replacements.forEach(({ from, to }) => {
      if (from.test(query)) {
        const expanded = query.replace(from, to);
        if (expanded !== query) {
          queries.push(expanded);
        }
      }
    });

    // Add English variations if query is in Portuguese
    if (this.isPortuguese(query)) {
      const englishQuery = await this.translateToEnglish(query);
      if (englishQuery) {
        queries.push(englishQuery);
      }
    }

    // Limit to 3 secondary queries
    return queries.slice(0, 3);
  }

  /**
   * Generate tertiary queries (broader)
   */
  private async generateTertiaryQueries(query: string): Promise<string[]> {
    const queries: string[] = [];

    // Extract main concepts
    const concepts = this.extractConcepts(query);

    // Create more generic queries
    if (concepts.length >= 2) {
      // Only first concept
      queries.push(concepts[0]);

      // Combination of main concepts
      if (concepts.length >= 3) {
        queries.push(`${concepts[0]} ${concepts[2]}`);
      }

      // Add "tecnologia" if not present
      if (!query.toLowerCase().includes('tecnologia')) {
        queries.push(`${concepts[0]} tecnologia`);
      }
    }

    return queries.slice(0, 3);
  }

  /**
   * Extract main concepts
   */
  private extractConcepts(query: string): string[] {
    // Remove stop words and extract main nouns
    const stopWords = new Set([
      'na',
      'no',
      'da',
      'do',
      'de',
      'em',
      'para',
      'com',
      'sobre',
      'entre',
      'pela',
      'pelo',
      'a',
      'o',
      'e',
    ]);

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => !stopWords.has(word) && word.length > 3);
  }

  /**
   * Detect if Portuguese
   */
  private isPortuguese(text: string): boolean {
    const ptIndicators = [
      'ção',
      'ões',
      'ão',
      'ões',
      'ç',
      'ã',
      'educação',
      'aprendizagem',
      'ensino',
      'brasileiro',
    ];

    const lowerText = text.toLowerCase();
    return ptIndicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Translate to English (simplified)
   */
  private async translateToEnglish(query: string): Promise<string | null> {
    const translations: Record<string, string> = {
      'inteligência artificial': 'artificial intelligence',
      educação: 'education',
      ensino: 'teaching',
      aprendizagem: 'learning',
      aluno: 'student',
      professor: 'teacher',
      escola: 'school',
      brasileiro: 'brazilian',
      brasil: 'brazil',
    };

    let translated = query.toLowerCase();

    Object.entries(translations).forEach(([pt, en]) => {
      translated = translated.replace(new RegExp(pt, 'gi'), en);
    });

    return translated !== query.toLowerCase() ? translated : null;
  }
}
