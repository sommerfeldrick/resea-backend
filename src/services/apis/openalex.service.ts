/**
 * OpenAlex API Service
 * https://openalex.org/
 *
 * Comprehensive academic database with:
 * - 200M+ publications
 * - Full-text availability info
 * - No API key required
 * - Rate limit: 10 req/s (100K/day)
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle } from '../../types/article.types.js';

interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
  primary_location?: {
    source?: {
      display_name?: string;
    };
  };
  abstract_inverted_index?: Record<string, number[]>;
  cited_by_count?: number;
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
  };
  best_oa_location?: {
    pdf_url?: string;
    landing_page_url?: string;
  };
}

export class OpenAlexService extends BaseAPIService {
  constructor() {
    // OpenAlex requires User-Agent with email for polite pool access
    const email = process.env.OPENALEX_EMAIL || process.env.UNPAYWALL_EMAIL || 'contato@smileai.com.br';
    const userAgent = `RESEA-Academic-Search/1.0 (mailto:${email})`;

    super(
      'OpenAlex',
      'https://api.openalex.org',
      { tokensPerSecond: 10, maxTokens: 20 }, // 10 req/s
      { failureThreshold: 5, resetTimeoutMs: 60000 },
      { 'User-Agent': userAgent }
    );

    this.logger.info(`✓ OpenAlex configured with email: ${email}`);
  }

  /**
   * Search OpenAlex for academic articles
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      // Build search query
      const params: any = {
        search: query,
        per_page: Math.min(limit, 200), // OpenAlex max is 200
        page: 1,
        filter: [],
      };

      // Apply filters
      if (filters?.requireFullText) {
        params.filter.push('open_access.is_oa:true');
      }

      // Join filters
      if (params.filter.length > 0) {
        params.filter = params.filter.join(',');
      } else {
        delete params.filter;
      }

      // Make request
      const response = await this.makeRequest<{ results: OpenAlexWork[] }>({
        method: 'GET',
        url: '/works',
        params,
      });

      // Parse results
      const articles = response.results
        .map(work => this.parseWork(work))
        .filter((article): article is AcademicArticle => article !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get article by DOI (for fulltext enrichment)
   */
  async getByDOI(doi: string): Promise<AcademicArticle | null> {
    try {
      if (!doi) return null;

      // Clean DOI
      const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

      this.logger.debug(`Looking up DOI: ${cleanDOI}`);

      // OpenAlex DOI lookup
      const response = await this.makeRequest<OpenAlexWork>({
        method: 'GET',
        url: `/works/https://doi.org/${cleanDOI}`,
      });

      return this.parseWork(response);
    } catch (error: any) {
      this.logger.debug(`DOI not found: ${doi}`);
      return null;
    }
  }

  /**
   * Parse OpenAlex work to AcademicArticle
   */
  private parseWork(work: OpenAlexWork): AcademicArticle | null {
    try {
      // Extract title
      const title = work.display_name || work.title;
      if (!title) return null;

      // Extract authors
      const authors =
        work.authorships?.map(a => a.author?.display_name).filter(Boolean) || [];

      // Extract abstract from inverted index
      const abstract = this.reconstructAbstract(work.abstract_inverted_index);

      // Extract DOI (remove URL prefix if present)
      let doi = work.doi;
      if (doi && doi.startsWith('https://doi.org/')) {
        doi = doi.replace('https://doi.org/', '');
      }

      // Extract PDF URL
      const pdfUrl =
        work.best_oa_location?.pdf_url ||
        (work.open_access?.oa_url?.endsWith('.pdf') ? work.open_access.oa_url : undefined);

      // Extract landing page
      const url =
        work.best_oa_location?.landing_page_url ||
        work.open_access?.oa_url ||
        work.id;

      return {
        id: work.id,
        doi,
        title,
        abstract,
        authors: authors as string[],
        year: work.publication_year,
        journal: work.primary_location?.source?.display_name,
        source: 'OpenAlex',
        citationCount: work.cited_by_count || 0,
        isOpenAccess: work.open_access?.is_oa || false,
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse work: ${error.message}`);
      return null;
    }
  }

  /**
   * Reconstruct abstract from OpenAlex's inverted index
   */
  private reconstructAbstract(
    invertedIndex?: Record<string, number[]>
  ): string | undefined {
    if (!invertedIndex) return undefined;

    try {
      // Build word position map
      const words: [string, number][] = [];

      Object.entries(invertedIndex).forEach(([word, positions]) => {
        positions.forEach(pos => {
          words.push([word, pos]);
        });
      });

      // Sort by position and join
      words.sort((a, b) => a[1] - b[1]);
      return words.map(w => w[0]).join(' ');
    } catch (error) {
      return undefined;
    }
  }
}
