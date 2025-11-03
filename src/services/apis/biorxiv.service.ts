/**
 * bioRxiv API Service
 * https://api.biorxiv.org/
 *
 * Biology preprint repository with:
 * - 200K+ preprints
 * - All open access
 * - No API key required
 * - Rate limit: Be conservative
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface BioRxivMessage {
  doi?: string;
  title?: string;
  authors?: string;
  date?: string;
  category?: string;
  abstract?: string;
}

export class BioRxivService extends BaseAPIService {
  constructor() {
    super(
      'bioRxiv',
      'https://api.biorxiv.org',
      { tokensPerSecond: 1, maxTokens: 2 },
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

      // bioRxiv API is limited - search by date range and filter locally
      // Get recent preprints (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await this.makeRequest<{ collection: BioRxivMessage[] }>({
        method: 'GET',
        url: `/details/biorxiv/${this.formatDate(startDate)}/${this.formatDate(endDate)}`,
      });

      // Filter by query locally
      const queryLower = query.toLowerCase();
      const filtered = response.collection.filter(
        m =>
          m.title?.toLowerCase().includes(queryLower) ||
          m.abstract?.toLowerCase().includes(queryLower)
      );

      const articles = filtered
        .slice(0, limit)
        .map(m => this.parseMessage(m))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseMessage(message: BioRxivMessage): AcademicArticle | null {
    try {
      if (!message.title || !message.doi) return null;

      // Parse authors
      const authors = message.authors?.split(';').map(a => a.trim()) || [];

      // Parse year
      const year = message.date ? new Date(message.date).getFullYear() : undefined;

      // Build URLs
      const pdfUrl = `https://www.biorxiv.org/content/${message.doi}.full.pdf`;
      const url = `https://www.biorxiv.org/content/${message.doi}`;

      return {
        id: message.doi,
        doi: message.doi,
        title: message.title,
        abstract: message.abstract,
        authors,
        year,
        journal: 'bioRxiv',
        source: 'bioRxiv',
        citationCount: 0,
        isOpenAccess: true,
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse message: ${error.message}`);
      return null;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
