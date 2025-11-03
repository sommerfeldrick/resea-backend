/**
 * arXiv API Service
 * https://arxiv.org/help/api/
 *
 * Preprint repository with:
 * - 2M+ preprints
 * - Physics, Math, CS, etc.
 * - All open access
 * - No API key required
 * - Rate limit: 3 req/s
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';
import * as xml2js from 'xml2js';

interface ArXivEntry {
  id: string[];
  title: string[];
  summary: string[];
  author?: Array<{ name: string[] }>;
  published: string[];
  'arxiv:doi'?: Array<{ _: string }>;
  link?: Array<{
    $: { rel: string; href: string; type?: string };
  }>;
}

export class ArXivService extends BaseAPIService {
  constructor() {
    super(
      'arXiv',
      'https://export.arxiv.org/api',
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
        search_query: `all:${query}`,
        start: 0,
        max_results: Math.min(limit, 300),
      };

      const response = await this.makeRequest<string>({
        method: 'GET',
        url: '/query',
        params,
        responseType: 'text' as any,
      });

      // Parse XML
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response);

      const entries = result.feed?.entry || [];

      const articles = entries
        .map((e: ArXivEntry) => this.parseEntry(e))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseEntry(entry: ArXivEntry): AcademicArticle | null {
    try {
      if (!entry.title || !entry.title[0]) return null;

      // Extract arXiv ID
      const id = entry.id[0].split('/abs/')[1];

      // Extract DOI if available
      const doi = entry['arxiv:doi']?.[0]?._;

      // Extract authors
      const authors = entry.author?.map(a => a.name[0]) || [];

      // Extract year from published date
      const year = entry.published ? new Date(entry.published[0]).getFullYear() : undefined;

      // Find PDF link
      const pdfUrl = `https://arxiv.org/pdf/${id}.pdf`;

      return {
        id,
        doi,
        title: entry.title[0].trim(),
        abstract: entry.summary?.[0]?.trim(),
        authors,
        year,
        journal: 'arXiv',
        source: 'arXiv',
        citationCount: 0,
        isOpenAccess: true,
        pdfUrl,
        url: `https://arxiv.org/abs/${id}`,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse entry: ${error.message}`);
      return null;
    }
  }
}
