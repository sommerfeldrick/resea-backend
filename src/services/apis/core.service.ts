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
      this.logger.info('Using API key');
    } else {
      this.logger.error('CORE requires API key! Set CORE_API_KEY env variable');
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

      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      // Make search request
      const response = await this.makeRequest<{ results: CORESummary[] }>({
        method: 'POST',
        url: '/search/works',
        data: {
          q: query,
          limit: Math.min(limit, 100), // Max 100
        },
      });

      // Parse results
      const articles = response.results
        .map(work => this.parseWork(work))
        .filter((article): article is AcademicArticle => article !== null);

      // Apply full-text filter if needed
      let filtered = articles;
      if (filters?.requireFullText) {
        filtered = articles.filter(a => !!a.pdfUrl);
      }

      this.logger.info(`Found ${filtered.length} articles`);
      return filtered;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
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
