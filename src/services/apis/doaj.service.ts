/**
 * DOAJ API Service
 * https://doaj.org/api/docs
 *
 * Directory of Open Access Journals with:
 * - 7M+ articles from 18K+ journals
 * - All open access
 * - No API key required
 * - Rate limit: None specified (be conservative)
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface DOAJArticle {
  id: string;
  bibjson?: {
    title?: string;
    abstract?: string;
    author?: Array<{ name?: string }>;
    year?: string;
    journal?: {
      title?: string;
    };
    link?: Array<{
      type?: string;
      url?: string;
    }>;
    identifier?: Array<{
      type?: string;
      id?: string;
    }>;
  };
}

export class DOAJService extends BaseAPIService {
  constructor() {
    super(
      'DOAJ',
      'https://doaj.org/api/v3',
      { tokensPerSecond: 2, maxTokens: 4 },
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );
  }

  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      const params = {
        q: query,
        pageSize: Math.min(limit, 100),
      };

      const response = await this.makeRequest<{ results: DOAJArticle[] }>({
        method: 'GET',
        url: '/search/articles',
        params,
      });

      const articles = response.results
        .map(a => this.parseArticle(a))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseArticle(article: DOAJArticle): AcademicArticle | null {
    try {
      const bibjson = article.bibjson;
      if (!bibjson?.title) return null;

      // Extract DOI
      const doi = bibjson.identifier?.find(i => i.type === 'doi')?.id;

      // Extract authors
      const authors = bibjson.author?.map(a => a.name).filter(Boolean) || [];

      // Extract year
      const year = bibjson.year ? parseInt(bibjson.year, 10) : undefined;

      // Find fulltext URL
      const pdfUrl = bibjson.link?.find(l => l.type === 'fulltext')?.url;

      return {
        id: article.id,
        doi,
        title: bibjson.title,
        abstract: bibjson.abstract,
        authors: authors as string[],
        year,
        journal: bibjson.journal?.title,
        source: 'DOAJ',
        citationCount: 0,
        isOpenAccess: true, // All DOAJ content is open access
        pdfUrl,
        url: pdfUrl || `https://doaj.org/article/${article.id}`,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse article: ${error.message}`);
      return null;
    }
  }
}
