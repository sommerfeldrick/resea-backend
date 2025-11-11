/**
 * Crossref REST API Service
 * https://api.crossref.org
 *
 * World's largest DOI registry:
 * - 150M+ DOIs (journal articles, books, datasets)
 * - Rich metadata (authors, citations, references, licenses)
 * - NO API KEY required (polite usage with email recommended)
 * - Rate limit: 50 req/s (polite pool with email), 1 req/s (public pool)
 * - Response time: ~200-800ms
 *
 * Key advantages:
 * - Most comprehensive DOI metadata
 * - Reliable license information (OA status)
 * - Links to fulltext when available
 * - Citation counts and references
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle, LicenseType } from '../../types/article.types.js';

interface CrossrefAuthor {
  given?: string;
  family?: string;
  sequence?: string;
  affiliation?: Array<{ name?: string }>;
}

interface CrossrefLicense {
  URL?: string;
  'content-version'?: string;
  'delay-in-days'?: number;
  start?: { 'date-parts'?: number[][] };
}

interface CrossrefLink {
  URL: string;
  'content-type'?: string;
  'content-version'?: string;
  'intended-application'?: string;
}

interface CrossrefWork {
  DOI: string;
  title?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  published?: { 'date-parts'?: number[][] };
  'published-print'?: { 'date-parts'?: number[][] };
  'published-online'?: { 'date-parts'?: number[][] };
  'container-title'?: string[];
  publisher?: string;
  'is-referenced-by-count'?: number;
  license?: CrossrefLicense[];
  link?: CrossrefLink[];
  URL?: string;
  type?: string;
  subject?: string[];
}

interface CrossrefResponse {
  status: string;
  'message-type': string;
  'message-version': string;
  message: {
    items?: CrossrefWork[];
    'total-results'?: number;
  };
}

export class CrossrefService extends BaseAPIService {
  private email: string;

  constructor() {
    // Email for polite API usage (gets 50 req/s instead of 1 req/s)
    const email = process.env.CROSSREF_EMAIL || process.env.UNPAYWALL_EMAIL || 'contato@smileai.com.br';

    super(
      'Crossref',
      'https://api.crossref.org',
      { tokensPerSecond: 5, maxTokens: 10 }, // Conservative: 5 req/s
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.email = email;
    this.client.defaults.params = { mailto: email };
    this.logger.info(`Using email: ${email} (polite pool)`);
  }

  /**
   * Search Crossref for articles
   *
   * @param query - Search query
   * @param limit - Number of results (max 1000)
   * @param filters - Optional filters
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean; type?: string; year?: number }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Searching: "${query}" (limit: ${limit})`);

      // Build query parameters
      const params: any = {
        query: query,
        rows: Math.min(limit, 1000),
        sort: 'relevance', // Options: relevance, score, updated, deposited, indexed, published
        order: 'desc',
      };

      // Apply filters
      if (filters?.type) {
        params.filter = `type:${filters.type}`; // journal-article, book-chapter, etc
      }

      if (filters?.year) {
        params.filter = (params.filter ? params.filter + ',' : '') + `from-pub-date:${filters.year}`;
      }

      // Make request
      const response = await this.makeRequest<CrossrefResponse>({
        method: 'GET',
        url: '/works',
        params,
      });

      // Parse results
      const articles = (response.message.items || [])
        .map(work => this.parseWork(work))
        .filter((article): article is AcademicArticle => article !== null);

      // Apply fulltext filter if needed
      let filtered = articles;
      if (filters?.requireFullText) {
        filtered = articles.filter(a => a.isOpenAccess && !!a.pdfUrl);
      }

      this.logger.info(`Found ${filtered.length} articles`);
      return filtered;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get article by DOI
   *
   * @param doi - Article DOI
   */
  async getByDOI(doi: string): Promise<AcademicArticle | null> {
    try {
      if (!doi) {
        return null;
      }

      // Clean DOI
      const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

      this.logger.debug(`Looking up DOI: ${cleanDOI}`);

      // Make request: GET /works/{doi}
      const response = await this.makeRequest<{ message: CrossrefWork }>({
        method: 'GET',
        url: `/works/${cleanDOI}`,
      });

      return this.parseWork(response.message);
    } catch (error: any) {
      if (error.message?.includes('404')) {
        this.logger.debug(`DOI not found: ${doi}`);
        return null;
      }

      this.logger.warn(`Failed to fetch DOI ${doi}: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch lookup multiple DOIs
   */
  async getBatch(dois: string[]): Promise<Map<string, AcademicArticle>> {
    const results = new Map<string, AcademicArticle>();

    // Process in parallel (respecting rate limit)
    const promises = dois.map(async (doi) => {
      const article = await this.getByDOI(doi);
      if (article) {
        results.set(doi, article);
      }
    });

    await Promise.allSettled(promises);

    this.logger.info(`Batch lookup: ${results.size}/${dois.length} DOIs found`);
    return results;
  }

  /**
   * Parse Crossref work to AcademicArticle
   */
  private parseWork(work: CrossrefWork): AcademicArticle | null {
    try {
      if (!work.DOI || !work.title?.[0]) {
        return null;
      }

      // Parse authors
      const authors = (work.author || []).map((author) => {
        const given = author.given || '';
        const family = author.family || '';
        return given ? `${given} ${family}` : family;
      }).filter(Boolean);

      // Parse publication year
      const datePartsArray = work.published?.['date-parts'] ||
        work['published-print']?.['date-parts'] ||
        work['published-online']?.['date-parts'];
      const year = datePartsArray?.[0]?.[0];

      // Determine OA status from licenses
      const licenses = work.license || [];
      const hasOpenLicense = licenses.some(lic =>
        lic.URL?.toLowerCase().includes('creativecommons') ||
        lic.URL?.toLowerCase().includes('cc-by') ||
        lic.URL?.toLowerCase().includes('cc0')
      );

      // Get license string (convert to LicenseType)
      let license: LicenseType | undefined;
      if (licenses.length > 0 && licenses[0].URL) {
        const url = licenses[0].URL.toLowerCase();
        if (url.includes('cc-by-nc-sa')) license = 'CC BY-NC-SA';
        else if (url.includes('cc-by-nc')) license = 'CC BY-NC';
        else if (url.includes('cc-by-nd')) license = 'CC BY-ND';
        else if (url.includes('cc-by-sa')) license = 'CC BY-SA';
        else if (url.includes('cc-by')) license = 'CC BY';
        else if (url.includes('cc0')) license = 'CC0';
        else license = 'unknown';
      }

      // Try to find PDF link
      let pdfUrl: string | undefined;
      const links = work.link || [];
      const pdfLink = links.find(link =>
        link['content-type']?.includes('pdf') ||
        link['intended-application']?.includes('text-mining')
      );
      if (pdfLink) {
        pdfUrl = pdfLink.URL;
      }

      return {
        id: `crossref_${work.DOI}`,
        doi: work.DOI,
        title: work.title[0],
        abstract: work.abstract,
        authors,
        year,
        journal: work['container-title']?.[0],
        source: 'Crossref',
        citationCount: work['is-referenced-by-count'] || 0,
        isOpenAccess: hasOpenLicense,
        license,
        pdfUrl,
        url: work.URL || `https://doi.org/${work.DOI}`,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse work: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if DOI has open license
   */
  async isOpenAccess(doi: string): Promise<boolean> {
    try {
      const article = await this.getByDOI(doi);
      return article !== null && article.isOpenAccess === true;
    } catch {
      return false;
    }
  }

  /**
   * Get OA status and license for DOI (lightweight check)
   */
  async getOAInfo(doi: string): Promise<{ isOA: boolean; license?: string; pdfUrl?: string } | null> {
    try {
      const article = await this.getByDOI(doi);
      if (!article) return null;

      return {
        isOA: article.isOpenAccess || false,
        license: article.license,
        pdfUrl: article.pdfUrl,
      };
    } catch {
      return null;
    }
  }
}
