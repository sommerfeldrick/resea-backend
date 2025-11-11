/**
 * Unpaywall API Service
 * https://unpaywall.org/products/api
 *
 * Largest database of open access articles:
 * - 27M+ open access articles with direct PDF links
 * - NO API KEY required (just email for polite usage)
 * - Rate limit: 100,000 requests/day
 * - Response time: ~200-500ms
 *
 * How it works:
 * - Query by DOI only (not keyword search)
 * - Returns best OA location (PDF URL)
 * - Includes license information
 */

import { BaseAPIService } from './base-api.service.js';
import type { AcademicArticle, LicenseType } from '../../types/article.types.js';

interface UnpaywallResponse {
  doi: string;
  doi_url: string;
  title: string;
  is_oa: boolean;
  best_oa_location?: {
    url: string; // Direct PDF URL
    url_for_pdf?: string;
    url_for_landing_page?: string;
    license?: string; // 'cc-by', 'cc0', etc
    version?: string; // 'publishedVersion', 'acceptedVersion', 'submittedVersion'
  };
  oa_status?: string; // 'gold', 'green', 'hybrid', 'bronze', 'closed'
  published_date?: string;
  year?: number;
  journal_name?: string;
  publisher?: string;
  authors?: Array<{ family?: string; given?: string }>;
  z_authors?: Array<{ family?: string; given?: string }>;
}

export class UnpaywallService extends BaseAPIService {
  private email: string;

  constructor() {
    // Email required for polite API usage (NO API KEY needed)
    const email = process.env.UNPAYWALL_EMAIL || 'contato@smileai.com.br';

    super(
      'Unpaywall',
      'https://api.unpaywall.org/v2',
      { tokensPerSecond: 2, maxTokens: 5 }, // 100k/day = ~1 req/s
      { failureThreshold: 5, resetTimeoutMs: 60000 }
    );

    this.email = email;
    this.logger.info(`Using email: ${email}`);
  }

  /**
   * Unpaywall doesn't support keyword search, only DOI lookup
   * This method is here for interface compatibility but returns empty array
   */
  async search(
    query: string,
    limit: number = 25,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    this.logger.warn('Unpaywall does not support keyword search - use getByDOI() instead');
    return [];
  }

  /**
   * Get article by DOI (main method for Unpaywall)
   *
   * @param doi - Article DOI (e.g., '10.1038/nature12373')
   * @returns Article with PDF URL if OA, null if not found or closed access
   */
  async getByDOI(doi: string): Promise<AcademicArticle | null> {
    try {
      if (!doi) {
        return null;
      }

      // Clean DOI (remove URL prefix if present)
      const cleanDOI = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

      this.logger.debug(`Looking up DOI: ${cleanDOI}`);

      // Make request: GET /v2/{doi}?email={email}
      const response = await this.makeRequest<UnpaywallResponse>({
        method: 'GET',
        url: `/${cleanDOI}`,
        params: { email: this.email },
      });

      // Parse response
      return this.parseResponse(response);
    } catch (error: any) {
      // 404 is normal (DOI not in Unpaywall or not OA)
      if (error.message?.includes('404')) {
        this.logger.debug(`DOI not found or not OA: ${doi}`);
        return null;
      }

      this.logger.warn(`Failed to fetch DOI ${doi}: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch lookup multiple DOIs (efficient for enrichment)
   *
   * @param dois - Array of DOIs
   * @returns Map of DOI -> Article (only OA articles)
   */
  async getBatch(dois: string[]): Promise<Map<string, AcademicArticle>> {
    const results = new Map<string, AcademicArticle>();

    // Process in parallel (respecting rate limit)
    const promises = dois.map(async (doi) => {
      const article = await this.getByDOI(doi);
      if (article && article.pdfUrl) {
        results.set(doi, article);
      }
    });

    await Promise.allSettled(promises);

    this.logger.info(`Batch lookup: ${results.size}/${dois.length} DOIs found as OA`);
    return results;
  }

  /**
   * Parse Unpaywall response to AcademicArticle
   */
  private parseResponse(response: UnpaywallResponse): AcademicArticle | null {
    try {
      // Only return if truly open access with PDF
      if (!response.is_oa || !response.best_oa_location) {
        return null;
      }

      const oaLocation = response.best_oa_location;
      const pdfUrl = oaLocation.url_for_pdf || oaLocation.url;

      if (!pdfUrl) {
        return null;
      }

      // Parse authors
      const authorsList = response.z_authors || response.authors || [];
      const authors = authorsList.map((author) => {
        const family = author.family || '';
        const given = author.given || '';
        return given ? `${given} ${family}` : family;
      }).filter(Boolean);

      // Convert license string to LicenseType
      const licenseStr = oaLocation.license?.toLowerCase() || '';
      let license: LicenseType | undefined;
      if (licenseStr.includes('cc-by-nc-sa')) license = 'CC BY-NC-SA';
      else if (licenseStr.includes('cc-by-nc')) license = 'CC BY-NC';
      else if (licenseStr.includes('cc-by-nd')) license = 'CC BY-ND';
      else if (licenseStr.includes('cc-by-sa')) license = 'CC BY-SA';
      else if (licenseStr.includes('cc-by')) license = 'CC BY';
      else if (licenseStr.includes('cc0')) license = 'CC0';
      else if (licenseStr) license = 'unknown';

      return {
        id: `unpaywall_${response.doi}`,
        doi: response.doi,
        title: response.title,
        authors,
        year: response.year,
        journal: response.journal_name,
        source: 'Unpaywall',
        isOpenAccess: true,
        license,
        pdfUrl,
        url: response.doi_url,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to parse response: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if DOI is open access (quick check without full metadata)
   */
  async isOpenAccess(doi: string): Promise<boolean> {
    try {
      const article = await this.getByDOI(doi);
      return article !== null && !!article.pdfUrl;
    } catch {
      return false;
    }
  }
}
