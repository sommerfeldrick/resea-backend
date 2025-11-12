/**
 * CORE API Service
 * https://core.ac.uk/services/api
 *
 * Open access research papers aggregator with:
 * - 30M+ open access papers
 * - Full-text content
 * - Requires API key
 * - Rate limit: Depends on plan (typically 1000 req/day free tier)
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle } from '../../types/article.types.js';

interface CORESummary {
  id: number;
  title?: string;
  abstract?: string;
  authors?: string[];
  yearPublished?: number;
  publisher?: string;
  downloadUrl?: string;
  doi?: string;
  citationCount?: number;
}

export class COREService extends BaseAPIService {
  private apiKey?: string;

  constructor() {
    const apiKey = process.env.CORE_API_KEY;

    super(
      'CORE',
      'https://api.core.ac.uk/v3',
      { tokensPerSecond: 0.5, maxTokens: 2 }, // Conservative rate
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.apiKey = apiKey;

    if (this.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
      this.logger.info('CORE API key configured');
    } else {
      this.logger.error('❌ CORE API key missing! Set CORE_API_KEY env variable. Get key at: https://core.ac.uk/services/api');
    }
  }

  /**
   * Search CORE for open access papers
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      // Skip if no API key
      if (!this.apiKey) {
        this.logger.warn('Skipping - no API key');
        return [];
      }

      this.logger.debug(`Searching: "${query}" (limit: ${limit})`);

      // Make search request
      const response = await this.makeRequest<{ results?: CORESummary[]; data?: CORESummary[] }>({
        method: 'POST',
        url: '/search/works',
        data: {
          q: query,
          limit: Math.min(limit, 100), // Max 100
        },
      });

      // CORE API v3 can return results in different formats
      const works = response.results || response.data || [];

      if (works.length === 0) {
        this.logger.debug('CORE returned empty results', { query });
        return [];
      }

      // Parse results
      const articles = works
        .map(work => this.parseWork(work))
        .filter((article): article is AcademicArticle => article !== null);

      // Apply full-text filter if needed
      let filtered = articles;
      if (filters?.requireFullText) {
        filtered = articles.filter(a => !!a.pdfUrl);
      }

      this.logger.info(`Found ${filtered.length} articles from CORE`);
      return filtered;
    } catch (error: any) {
      // Don't spam logs with CORE errors if API is down
      if (error.message.includes('500')) {
        this.logger.warn(`CORE API unavailable (error 500) - check API key or service status`);
      } else {
        this.logger.error(`Search failed: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Search by DOI (for enrichment)
   */
  async searchByDOI(doi: string): Promise<AcademicArticle | null> {
    try {
      if (!this.apiKey || !doi) {
        return null;
      }

      // Clean DOI
      const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

      this.logger.debug(`Searching by DOI: ${cleanDOI}`);

      // Search with DOI as query
      const response = await this.makeRequest<{ results?: CORESummary[]; data?: CORESummary[] }>({
        method: 'POST',
        url: '/search/works',
        data: {
          q: `doi:${cleanDOI}`,
          limit: 1,
        },
      });

      const works = response.results || response.data || [];
      if (works.length > 0) {
        return this.parseWork(works[0]);
      }

      return null;
    } catch (error: any) {
      this.logger.debug(`DOI not found: ${doi}`);
      return null;
    }
  }

  /**
   * Search by title (fallback for articles without DOI)
   */
  async searchByTitle(title: string): Promise<AcademicArticle | null> {
    try {
      if (!this.apiKey || !title) {
        return null;
      }

      this.logger.debug(`Searching by title: ${title.substring(0, 50)}...`);

      // Search with title as query
      const response = await this.makeRequest<{ results?: CORESummary[]; data?: CORESummary[] }>({
        method: 'POST',
        url: '/search/works',
        data: {
          q: `title:"${title}"`,
          limit: 1,
        },
      });

      const works = response.results || response.data || [];
      if (works.length > 0) {
        const work = works[0];
        // Verify title similarity (avoid false positives)
        if (work.title && this.titleSimilarity(title, work.title) > 0.8) {
          return this.parseWork(work);
        }
      }

      return null;
    } catch (error: any) {
      this.logger.debug(`Title not found: ${title.substring(0, 50)}`);
      return null;
    }
  }

  /**
   * Simple title similarity check (Jaccard similarity on words)
   */
  private titleSimilarity(title1: string, title2: string): number {
    const words1 = new Set(title1.toLowerCase().split(/\W+/).filter(Boolean));
    const words2 = new Set(title2.toLowerCase().split(/\W+/).filter(Boolean));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Parse CORE work to AcademicArticle
   */
  private parseWork(work: CORESummary): AcademicArticle | null {
    try {
      if (!work.title) return null;

      // CORE only has open access content
      const isOpenAccess = true;

      return {
        id: `core_${work.id}`,
        doi: work.doi,
        title: work.title,
        abstract: work.abstract,
        authors: work.authors || [],
        year: work.yearPublished,
        journal: work.publisher,
        source: 'CORE',
        citationCount: work.citationCount || 0,
        isOpenAccess,
        pdfUrl: work.downloadUrl,
        url: work.downloadUrl || `https://core.ac.uk/display/${work.id}`,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse work: ${error.message}`);
      return null;
    }
  }
}
