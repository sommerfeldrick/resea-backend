/**
 * DataCite API Service
 * https://support.datacite.org/docs/api
 *
 * DOI registration agency with:
 * - Research datasets and publications
 * - Metadata for DOIs
 * - No API key required
 * - Rate limit: Be conservative
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface DataCiteWork {
  id: string;
  attributes?: {
    doi?: string;
    titles?: Array<{ title?: string }>;
    descriptions?: Array<{ description?: string }>;
    creators?: Array<{ name?: string }>;
    publicationYear?: number;
    publisher?: string;
    types?: {
      resourceTypeGeneral?: string;
    };
    citationCount?: number;
  };
}

export class DataCiteService extends BaseAPIService {
  constructor() {
    super(
      'DataCite',
      'https://api.datacite.org',
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

      const params: any = {
        query,
        'page[size]': Math.min(limit, 100),
        'resource-type-id': 'text', // Focus on publications, not datasets
      };

      const response = await this.makeRequest<{ data: DataCiteWork[] }>({
        method: 'GET',
        url: '/dois',
        params,
      });

      const articles = response.data
        .map(w => this.parseWork(w))
        .filter((a): a is AcademicArticle => a !== null);

      // Filter by full text if needed
      let filtered = articles;
      if (filters?.requireFullText) {
        // DataCite doesn't indicate full text availability, so we skip this filter
        this.logger.warn('Full text filter not applicable for DataCite');
      }

      this.logger.info(`Found ${filtered.length} articles`);
      return filtered;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseWork(work: DataCiteWork): AcademicArticle | null {
    try {
      const attrs = work.attributes;
      if (!attrs) return null;

      // Extract title
      const title = attrs.titles?.[0]?.title;
      if (!title) return null;

      // Extract DOI
      const doi = attrs.doi;

      // Extract authors
      const authors = attrs.creators?.map(c => c.name).filter(Boolean) || [];

      // Extract abstract/description
      const abstract = attrs.descriptions?.[0]?.description;

      // Build URL
      const url = doi ? `https://doi.org/${doi}` : undefined;

      return {
        id: work.id,
        doi,
        title,
        abstract,
        authors: authors as string[],
        year: attrs.publicationYear,
        journal: attrs.publisher,
        source: 'DataCite',
        citationCount: attrs.citationCount || 0,
        isOpenAccess: false, // Not indicated by DataCite
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse work: ${error.message}`);
      return null;
    }
  }
}
