/**
 * Google Scholar Service (PLACEHOLDER)
 * https://scholar.google.com/
 *
 * Note: Google Scholar does NOT have an official API.
 * Possible alternatives:
 * - SerpAPI (paid service)
 * - ScraperAPI (paid service)
 * - Web scraping (violates ToS, not recommended)
 *
 * This is a placeholder that returns empty results.
 * If you have access to SerpAPI or similar, implement it here.
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle } from '../../types/article.types.js';

export class GoogleScholarService extends BaseAPIService {
  private serpApiKey?: string;

  constructor() {
    super(
      'GoogleScholar',
      'https://serpapi.com',
      { tokensPerSecond: 1, maxTokens: 2 },
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.serpApiKey = process.env.SERPAPI_KEY;

    if (!this.serpApiKey) {
      this.logger.warn(
        'Google Scholar requires SerpAPI key. Set SERPAPI_KEY to enable. Returning empty results.'
      );
    }
  }

  /**
   * Search Google Scholar (requires SerpAPI)
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    // If no API key, return empty
    if (!this.serpApiKey) {
      this.logger.warn('Skipping - no SerpAPI key');
      return [];
    }

    try {
      this.logger.info(`Searching via SerpAPI: "${query}" (limit: ${limit})`);

      // SerpAPI implementation (if key is available)
      const params = {
        engine: 'google_scholar',
        q: query,
        num: Math.min(limit, 20),
        api_key: this.serpApiKey,
      };

      const response = await this.makeRequest<{
        organic_results?: Array<{
          title?: string;
          link?: string;
          snippet?: string;
          publication_info?: {
            summary?: string;
            authors?: Array<{ name?: string }>;
          };
          inline_links?: {
            cited_by?: { total?: number };
          };
          resources?: Array<{
            file_format?: string;
            link?: string;
          }>;
        }>;
      }>({
        method: 'GET',
        url: '/search',
        params,
      });

      const results = response.organic_results || [];

      const articles = results
        .map(r => this.parseResult(r))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseResult(result: any): AcademicArticle | null {
    try {
      if (!result.title) return null;

      // Extract authors
      const authors = result.publication_info?.authors?.map((a: any) => a.name) || [];

      // Extract year from summary
      const summary = result.publication_info?.summary || '';
      const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

      // Find PDF link
      const pdfResource = result.resources?.find((r: any) => r.file_format === 'PDF');
      const pdfUrl = pdfResource?.link;

      return {
        id: result.link || result.title,
        title: result.title,
        abstract: result.snippet,
        authors,
        year,
        source: 'GoogleScholar',
        citationCount: result.inline_links?.cited_by?.total || 0,
        isOpenAccess: !!pdfUrl,
        pdfUrl,
        url: result.link,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse result: ${error.message}`);
      return null;
    }
  }
}
