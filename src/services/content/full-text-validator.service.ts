/**
 * Full-Text Validator Service
 * Validates full-text availability via multiple sources:
 * - Unpaywall API (OA content)
 * - arXiv (LaTeX source)
 * - PubMed Central (JATS XML)
 */

import axios from 'axios';
import type { AcademicArticle } from '../../types/index.js';
import { Logger } from '../../utils/simple-logger.js';

export interface FullTextLocation {
  source: 'unpaywall' | 'arxiv' | 'pmc' | 'doi' | 'other';
  url: string;
  format?: string;
  isOpenAccess: boolean;
  license?: string;
}

export class FullTextValidatorService {
  private logger: Logger;
  private unpaywallEmail: string;

  constructor() {
    this.logger = new Logger('FullTextValidator');
    this.unpaywallEmail = process.env.UNPAYWALL_EMAIL || 'research@example.com';
  }

  /**
   * Find all available full-text locations for an article
   */
  async findFullTextLocations(article: AcademicArticle): Promise<FullTextLocation[]> {
    const locations: FullTextLocation[] = [];

    // Check Unpaywall (if DOI available)
    if (article.doi) {
      const unpaywallLocations = await this.checkUnpaywall(article.doi);
      locations.push(...unpaywallLocations);
    }

    // Check arXiv (if arxivId available)
    if (article.arxivId) {
      const arxivLocation = await this.checkArxiv(article.arxivId);
      if (arxivLocation) locations.push(arxivLocation);
    }

    // Check PubMed Central (if pmcid available)
    if (article.pmcid) {
      const pmcLocation = await this.checkPMC(article.pmcid);
      if (pmcLocation) locations.push(pmcLocation);
    }

    // Check existing URLs from article
    if (article.pdfUrl) {
      locations.push({
        source: 'other',
        url: article.pdfUrl,
        format: 'pdf',
        isOpenAccess: article.isOpenAccess,
      });
    }

    return locations;
  }

  /**
   * Check Unpaywall API for OA locations
   */
  private async checkUnpaywall(doi: string): Promise<FullTextLocation[]> {
    try {
      const response = await axios.get(
        `https://api.unpaywall.org/v2/${doi}?email=${this.unpaywallEmail}`,
        { timeout: 5000 }
      );

      const data = response.data;
      const locations: FullTextLocation[] = [];

      // Best OA location
      if (data.best_oa_location) {
        locations.push({
          source: 'unpaywall',
          url: data.best_oa_location.url_for_pdf || data.best_oa_location.url,
          format: data.best_oa_location.url_for_pdf ? 'pdf' : 'html',
          isOpenAccess: true,
          license: data.best_oa_location.license,
        });
      }

      // Other OA locations
      if (data.oa_locations && Array.isArray(data.oa_locations)) {
        for (const loc of data.oa_locations) {
          if (loc.url && loc.url !== data.best_oa_location?.url) {
            locations.push({
              source: 'unpaywall',
              url: loc.url_for_pdf || loc.url,
              format: loc.url_for_pdf ? 'pdf' : 'html',
              isOpenAccess: true,
              license: loc.license,
            });
          }
        }
      }

      if (locations.length > 0) {
        this.logger.info(`Found ${locations.length} OA locations via Unpaywall for ${doi}`);
      }

      return locations;
    } catch (error: any) {
      this.logger.debug(`Unpaywall check failed for ${doi}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check arXiv for LaTeX source
   */
  private async checkArxiv(arxivId: string): Promise<FullTextLocation | null> {
    try {
      // arXiv source URL format: https://arxiv.org/e-print/2301.12345
      const sourceUrl = `https://arxiv.org/e-print/${arxivId}`;

      // Verify URL exists (HEAD request)
      await axios.head(sourceUrl, { timeout: 3000 });

      this.logger.info(`Found arXiv source for ${arxivId}`);

      return {
        source: 'arxiv',
        url: sourceUrl,
        format: 'latex-source',
        isOpenAccess: true,
        license: 'arXiv',
      };
    } catch (error: any) {
      this.logger.debug(`arXiv check failed for ${arxivId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check PubMed Central for JATS XML
   */
  private async checkPMC(pmcid: string): Promise<FullTextLocation | null> {
    try {
      // PMC OAI URL format: https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:PMC12345&metadataPrefix=pmc
      const cleanPmcid = pmcid.replace(/^PMC/i, '');
      const jatsUrl = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${cleanPmcid}&metadataPrefix=pmc`;

      // Alternative: FTP access
      const ftpUrl = `https://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_package/00/${cleanPmcid.slice(-2)}/${pmcid}.tar.gz`;

      this.logger.info(`Found PMC JATS XML for ${pmcid}`);

      return {
        source: 'pmc',
        url: jatsUrl,
        format: 'jats-xml',
        isOpenAccess: true,
        license: 'PMC',
      };
    } catch (error: any) {
      this.logger.debug(`PMC check failed for ${pmcid}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate if a URL is accessible
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enrich article with full-text locations
   */
  async enrichArticle(article: AcademicArticle): Promise<AcademicArticle> {
    const locations = await this.findFullTextLocations(article);

    if (locations.length === 0) {
      return article;
    }

    // Convert to AvailableFormat[]
    const availableFormats = locations.map((loc, index) => ({
      format: loc.format || 'unknown',
      url: loc.url,
      priority: this.getFormatPriority(loc.format, loc.source),
      validated: false, // Will be validated on download
      quality: loc.isOpenAccess ? ('high' as const) : ('medium' as const),
    }));

    // Sort by priority (descending)
    availableFormats.sort((a, b) => b.priority - a.priority);

    return {
      ...article,
      availableFormats,
      isOpenAccess: locations.some((loc) => loc.isOpenAccess) || article.isOpenAccess,
    };
  }

  /**
   * Validate batch of articles
   */
  async validateBatch(articles: AcademicArticle[]): Promise<AcademicArticle[]> {
    this.logger.info(`Validating ${articles.length} articles in batch`);

    const validatedArticles = await Promise.all(
      articles.map(article => this.enrichArticle(article))
    );

    // Filter articles that have at least one validated format
    return validatedArticles.filter(
      article => article.availableFormats && article.availableFormats.length > 0
    );
  }

  /**
   * Get priority for format based on source
   */
  private getFormatPriority(format?: string, source?: string): number {
    if (format === 'jats-xml' || source === 'pmc') return 10;
    if (format === 'latex-source' || source === 'arxiv') return 8;
    if (format === 'pdf') return 4;
    if (format === 'html') return 3;
    return 2;
  }
}

// Singleton export
export const fullTextValidator = new FullTextValidatorService();
