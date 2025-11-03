/**
 * PubMed API Service
 * https://www.ncbi.nlm.nih.gov/home/develop/api/
 *
 * Biomedical literature database with:
 * - 35M+ citations
 * - MEDLINE abstracts
 * - PMC full-text articles
 * - Rate limit: 3 req/s without API key, 10 req/s with key
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle } from '../../types/article.types.js';

interface PubMedArticle {
  uid: string;
  title?: string;
  sortpubdate?: string;
  authors?: Array<{ name?: string }>;
  source?: string;
  pubdate?: string;
  epubdate?: string;
  fulljournalname?: string;
  elocationid?: string;
  doi?: string[];
}

export class PubMedService extends BaseAPIService {
  private apiKey?: string;

  constructor() {
    const apiKey = process.env.PUBMED_API_KEY;

    super(
      'PubMed',
      'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      // Rate limit: 10 req/s with key, 3 req/s without
      { tokensPerSecond: apiKey ? 8 : 2, maxTokens: apiKey ? 16 : 4 },
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.apiKey = apiKey;

    if (this.apiKey) {
      this.logger.info('Using API key for higher rate limits');
    } else {
      this.logger.warn('No API key - using rate limit 3 req/s');
    }
  }

  /**
   * Search PubMed for articles
   * Uses two-step process: esearch → esummary
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      // Step 1: Search for IDs
      const searchParams: any = {
        db: 'pubmed',
        term: query,
        retmode: 'json',
        retmax: Math.min(limit, 500), // Max 500
      };

      if (this.apiKey) {
        searchParams.api_key = this.apiKey;
      }

      // Apply PMC filter for full text
      if (filters?.requireFullText) {
        searchParams.term = `${query} AND pmc[filter]`;
      }

      const searchResponse = await this.makeRequest<{
        esearchresult: { idlist: string[] };
      }>({
        method: 'GET',
        url: '/esearch.fcgi',
        params: searchParams,
      });

      const ids = searchResponse.esearchresult.idlist;

      if (!ids || ids.length === 0) {
        this.logger.info('No articles found');
        return [];
      }

      this.logger.info(`Found ${ids.length} IDs, fetching summaries...`);

      // Step 2: Get article summaries
      const summaryParams: any = {
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'json',
      };

      if (this.apiKey) {
        summaryParams.api_key = this.apiKey;
      }

      const summaryResponse = await this.makeRequest<{
        result: Record<string, PubMedArticle>;
      }>({
        method: 'GET',
        url: '/esummary.fcgi',
        params: summaryParams,
      });

      // Parse results
      const articles = ids
        .map(id => this.parseArticle(summaryResponse.result[id], id))
        .filter((article): article is AcademicArticle => article !== null);

      this.logger.info(`Parsed ${articles.length} articles`);
      return articles;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse PubMed article to AcademicArticle
   */
  private parseArticle(
    article: PubMedArticle,
    pmid: string
  ): AcademicArticle | null {
    try {
      if (!article || !article.title) return null;

      // Extract DOI
      const doi = article.elocationid?.startsWith('doi:')
        ? article.elocationid.replace('doi:', '').trim()
        : article.doi?.[0];

      // Extract year from sortpubdate (format: YYYY/MM/DD)
      const year = article.sortpubdate
        ? parseInt(article.sortpubdate.split('/')[0], 10)
        : undefined;

      // Extract authors
      const authors = article.authors?.map(a => a.name).filter(Boolean) || [];

      // Build URLs
      const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
      const pdfUrl = doi ? `https://europepmc.org/articles/PMC${pmid}?pdf=render` : undefined;

      return {
        id: pmid,
        doi,
        title: article.title,
        abstract: undefined, // Not included in summary (would need efetch for full record)
        authors: authors as string[],
        year,
        journal: article.fulljournalname || article.source,
        source: 'PubMed',
        citationCount: 0, // Not available in PubMed
        isOpenAccess: false, // Would need PMC check
        pdfUrl,
        url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse article: ${error.message}`);
      return null;
    }
  }
}
