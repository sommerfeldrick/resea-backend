/**
 * OpenAIRE API Service
 * https://graph.openaire.eu/develop/
 *
 * European open science infrastructure with:
 * - 200M+ research products
 * - Focus on EU-funded research
 * - No API key required
 * - Rate limit: Be conservative
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface OpenAIREResult {
  header?: {
    'dri:objIdentifier'?: string;
  };
  metadata?: {
    'oaf:entity'?: {
      'oaf:result'?: {
        title?: Array<{ $: { classid?: string }; _?: string }>;
        description?: Array<{ _?: string }>;
        creator?: Array<{ _?: string }>;
        dateofacceptance?: Array<{ _?: string }>;
        publisher?: Array<{ _?: string }>;
        pid?: Array<{
          $?: { classid?: string };
          _?: string;
        }>;
        bestaccessright?: Array<{
          $?: { classname?: string };
        }>;
      };
    };
  };
}

export class OpenAIREService extends BaseAPIService {
  constructor() {
    super(
      'OpenAIRE',
      'https://api.openaire.eu',
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

      const params: any = {
        keywords: query,
        size: Math.min(limit, 100),
        format: 'json',
      };

      if (filters?.requireFullText) {
        params.OA = 'true';
      }

      const response = await this.makeRequest<{ results?: { result?: OpenAIREResult[] } }>({
        method: 'GET',
        url: '/search/publications',
        params,
      });

      const results = response.results?.result || [];

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

  private parseResult(result: OpenAIREResult): AcademicArticle | null {
    try {
      const oafResult = result.metadata?.['oaf:entity']?.['oaf:result'];
      if (!oafResult) return null;

      // Extract title
      const title = oafResult.title?.find(t => t.$ ?.classid === 'main title')?._
        || oafResult.title?.[0]?._;
      if (!title) return null;

      // Extract DOI
      const doi = oafResult.pid?.find(p => p.$?.classid === 'doi')?._;

      // Extract authors
      const authors = oafResult.creator?.map(c => c._).filter(Boolean) || [];

      // Extract year
      const dateStr = oafResult.dateofacceptance?.[0]?._;
      const year = dateStr ? new Date(dateStr).getFullYear() : undefined;

      // Extract abstract
      const abstract = oafResult.description?.[0]?._;

      // Check open access
      const accessRight = oafResult.bestaccessright?.[0]?.$?.classname;
      const isOpenAccess = accessRight?.toLowerCase().includes('open') || false;

      // Generate ID
      const id = result.header?.['dri:objIdentifier'] || doi || title;

      return {
        id,
        doi,
        title,
        abstract,
        authors: authors as string[],
        year,
        journal: oafResult.publisher?.[0]?._,
        source: 'OpenAIRE',
        citationCount: 0,
        isOpenAccess,
        url: doi ? `https://doi.org/${doi}` : undefined,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse result: ${error.message}`);
      return null;
    }
  }
}
