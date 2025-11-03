/**
 * PLOS (Public Library of Science) API Service
 * https://api.plos.org/
 *
 * Open access scientific publisher with:
 * - PLOS ONE, PLOS Biology, etc.
 * - All open access
 * - No API key required
 * - Rate limit: Be conservative
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle } from '../../types/article.types.js';

interface PLOSDoc {
  id: string;
  title_display?: string[];
  abstract?: string[];
  author_display?: string[];
  publication_date?: string;
  journal?: string;
  article_type?: string;
  counter_total_all?: number;
}

export class PLOSService extends BaseAPIService {
  constructor() {
    super(
      'PLOS',
      'https://api.plos.org',
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
        rows: Math.min(limit, 100),
        wt: 'json',
        fl: 'id,title_display,abstract,author_display,publication_date,journal,article_type,counter_total_all',
      };

      const response = await this.makeRequest<{
        response: { docs: PLOSDoc[] };
      }>({
        method: 'GET',
        url: '/search',
        params,
      });

      const articles = response.response.docs
        .map(doc => this.parseDoc(doc))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseDoc(doc: PLOSDoc): AcademicArticle | null {
    try {
      // Extract title
      const title = doc.title_display?.[0];
      if (!title) return null;

      // Extract DOI from ID
      const doi = doc.id.replace('10.1371/journal.', '10.1371/journal.');

      // Extract authors
      const authors = doc.author_display || [];

      // Extract year
      const year = doc.publication_date
        ? new Date(doc.publication_date).getFullYear()
        : undefined;

      // Extract abstract
      const abstract = doc.abstract?.[0];

      // Build URLs (PLOS is all open access)
      const url = `https://journals.plos.org/plosone/article?id=${doc.id}`;
      const pdfUrl = `https://journals.plos.org/plosone/article/file?id=${doc.id}&type=printable`;

      return {
        id: doc.id,
        doi,
        title,
        abstract,
        authors,
        year,
        journal: doc.journal || 'PLOS',
        source: 'PLOS',
        citationCount: doc.counter_total_all || 0,
        isOpenAccess: true, // All PLOS content is open access
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse doc: ${error.message}`);
      return null;
    }
  }
}
