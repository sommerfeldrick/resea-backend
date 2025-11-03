/**
 * Semantic Scholar API Service
 * https://www.semanticscholar.org/product/api
 *
 * AI-powered academic search with:
 * - 200M+ papers
 * - Citation context
 * - Influential citations
 * - Full-text availability
 * - Rate limit: 100 req/s with API key, 1 req/s without
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface SemanticScholarPaper {
  paperId: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
  };
  title?: string;
  abstract?: string;
  year?: number;
  authors?: Array<{
    name?: string;
  }>;
  venue?: string;
  citationCount?: number;
  openAccessPdf?: {
    url?: string;
  };
  isOpenAccess?: boolean;
  fieldsOfStudy?: string[];
}

export class SemanticScholarService extends BaseAPIService {
  private apiKey?: string;

  constructor() {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

    super(
      'SemanticScholar',
      'https://api.semanticscholar.org/graph/v1',
      // Rate limit: 100 req/s with API key, 1 req/s without
      { tokensPerSecond: apiKey ? 50 : 1, maxTokens: apiKey ? 100 : 2 },
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.apiKey = apiKey;

    // Add API key to headers if available
    if (this.apiKey) {
      this.client.defaults.headers.common['x-api-key'] = this.apiKey;
      this.logger.info('Using API key for higher rate limits');
    } else {
      this.logger.warn('No API key - using rate limit 1 req/s');
    }
  }

  /**
   * Search Semantic Scholar for academic papers
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      // Build request params
      const params: any = {
        query,
        limit: Math.min(limit, 100), // Max 100 per request
        fields: [
          'paperId',
          'externalIds',
          'title',
          'abstract',
          'year',
          'authors',
          'venue',
          'citationCount',
          'openAccessPdf',
          'isOpenAccess',
          'fieldsOfStudy',
        ].join(','),
      };

      // Apply filters
      if (filters?.requireFullText) {
        params.openAccessPdf = '';  // Only papers with open access PDF
      }

      // Make request
      const response = await this.makeRequest<{ data: SemanticScholarPaper[] }>({
        method: 'GET',
        url: '/paper/search',
        params,
      });

      // Parse results
      const articles = response.data
        .map(paper => this.parsePaper(paper))
        .filter((article): article is AcademicArticle => article !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse Semantic Scholar paper to AcademicArticle
   */
  private parsePaper(paper: SemanticScholarPaper): AcademicArticle | null {
    try {
      // Title is required
      if (!paper.title) return null;

      // Extract DOI
      const doi = paper.externalIds?.DOI;

      // Extract authors
      const authors = paper.authors?.map(a => a.name).filter(Boolean) || [];

      // Build URL
      const url = `https://www.semanticscholar.org/paper/${paper.paperId}`;

      // Extract PDF URL
      const pdfUrl = paper.openAccessPdf?.url;

      return {
        id: paper.paperId,
        doi,
        title: paper.title,
        abstract: paper.abstract,
        authors: authors as string[],
        year: paper.year,
        journal: paper.venue,
        source: 'SemanticScholar',
        citationCount: paper.citationCount || 0,
        isOpenAccess: paper.isOpenAccess || false,
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse paper: ${error.message}`);
      return null;
    }
  }
}
