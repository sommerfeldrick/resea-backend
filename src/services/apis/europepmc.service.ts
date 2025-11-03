/**
 * Europe PMC API Service
 * https://europepmc.org/RestfulWebService
 *
 * Life sciences literature database with:
 * - 40M+ abstracts
 * - 8M+ full-text articles
 * - No API key required
 * - Rate limit: ~3 req/s
 */

import { BaseAPIService } from './base-api.service';
import type { AcademicArticle } from '../../types/article.types';

interface EuropePMCResult {
  id: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  pubYear?: string;
  journalTitle?: string;
  abstractText?: string;
  citedByCount?: number;
  isOpenAccess?: string;
  fullTextUrlList?: {
    fullTextUrl?: Array<{
      url?: string;
      documentStyle?: string;
    }>;
  };
}

export class EuropePMCService extends BaseAPIService {
  constructor() {
    super(
      'EuropePMC',
      'https://www.ebi.ac.uk/europepmc/webservices/rest',
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
        format: 'json',
        pageSize: Math.min(limit, 1000),
        resultType: 'core',
      };

      if (filters?.requireFullText) {
        params.query = `${query} AND OPEN_ACCESS:Y`;
      }

      const response = await this.makeRequest<{ resultList: { result: EuropePMCResult[] } }>({
        method: 'GET',
        url: '/search',
        params,
      });

      const articles = response.resultList.result
        .map(r => this.parseResult(r))
        .filter((a): a is AcademicArticle => a !== null);

      this.logger.info(`Found ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  private parseResult(result: EuropePMCResult): AcademicArticle | null {
    try {
      if (!result.title) return null;

      const authors = result.authorString?.split(', ') || [];
      const year = result.pubYear ? parseInt(result.pubYear, 10) : undefined;
      const isOpenAccess = result.isOpenAccess === 'Y';

      // Find PDF URL
      const pdfUrl = result.fullTextUrlList?.fullTextUrl?.find(
        u => u.documentStyle === 'pdf'
      )?.url;

      const url = pdfUrl || `https://europepmc.org/article/MED/${result.pmid || result.id}`;

      return {
        id: result.pmcid || result.pmid || result.id,
        doi: result.doi,
        title: result.title,
        abstract: result.abstractText,
        authors,
        year,
        journal: result.journalTitle,
        source: 'EuropePMC',
        citationCount: result.citedByCount || 0,
        isOpenAccess,
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse result: ${error.message}`);
      return null;
    }
  }
}
