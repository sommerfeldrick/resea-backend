/**
 * Multi-Format Detector Service
 * Detects all available content formats for academic articles
 * Uses DOI content negotiation, API checks, and heuristics
 */

import axios from 'axios';
import type { AcademicArticle, AvailableFormat, ArticleFormat } from '../../types';
import { FORMAT_PRIORITY } from '../../config/constants';
import { Logger } from '../../utils/simple-logger';

export class MultiFormatDetectorService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MultiFormatDetector');
  }

  /**
   * Detect all available formats for an article
   */
  async detectFormats(article: AcademicArticle): Promise<AvailableFormat[]> {
    const formats: AvailableFormat[] = [];

    // 1. Check JATS XML (PubMed Central)
    if (article.pmcid) {
      formats.push(await this.detectJATS(article.pmcid));
    }

    // 2. Check LaTeX source (arXiv)
    if (article.arxivId) {
      formats.push(await this.detectLaTeX(article.arxivId));
    }

    // 3. Check DOI content negotiation
    if (article.doi) {
      const doiFormats = await this.detectViaDOI(article.doi);
      formats.push(...doiFormats);
    }

    // 4. Check existing URLs
    if (article.pdfUrl) {
      formats.push({
        format: 'pdf',
        url: article.pdfUrl,
        priority: FORMAT_PRIORITY['pdf'] || 4,
        validated: false,
        quality: 'medium',
      });
    }

    if (article.url) {
      // Detect format from URL
      const detectedFormat = this.detectFormatFromUrl(article.url);
      formats.push({
        format: detectedFormat,
        url: article.url,
        priority: FORMAT_PRIORITY[detectedFormat] || 2,
        validated: false,
        quality: 'medium',
      });
    }

    // 5. Deduplicate by URL
    const uniqueFormats = this.deduplicateFormats(formats);

    // 6. Sort by priority (descending)
    uniqueFormats.sort((a, b) => b.priority - a.priority);

    this.logger.info(
      `Detected ${uniqueFormats.length} formats for article ${article.doi || article.id}`
    );

    return uniqueFormats;
  }

  /**
   * Detect JATS XML from PubMed Central
   */
  private async detectJATS(pmcid: string): Promise<AvailableFormat> {
    const cleanPmcid = pmcid.replace(/^PMC/i, '');

    return {
      format: 'jats-xml',
      url: `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${cleanPmcid}&metadataPrefix=pmc`,
      priority: FORMAT_PRIORITY['jats-xml'] || 10,
      validated: false,
      quality: 'high',
    };
  }

  /**
   * Detect LaTeX source from arXiv
   */
  private async detectLaTeX(arxivId: string): Promise<AvailableFormat> {
    return {
      format: 'latex-source',
      url: `https://arxiv.org/e-print/${arxivId}`,
      priority: FORMAT_PRIORITY['latex-source'] || 8,
      validated: false,
      quality: 'high',
    };
  }

  /**
   * Detect formats via DOI content negotiation
   */
  private async detectViaDOI(doi: string): Promise<AvailableFormat[]> {
    const formats: AvailableFormat[] = [];

    try {
      // Try different Accept headers for content negotiation
      const acceptHeaders = [
        { type: 'application/vnd.jats+xml', format: 'jats-xml' as ArticleFormat },
        { type: 'application/tei+xml', format: 'tei-xml' as ArticleFormat },
        { type: 'application/json', format: 'json-structured' as ArticleFormat },
        { type: 'text/html', format: 'html-semantic' as ArticleFormat },
        { type: 'application/pdf', format: 'pdf' as ArticleFormat },
      ];

      for (const { type, format } of acceptHeaders) {
        try {
          const response = await axios.head(`https://doi.org/${doi}`, {
            headers: { Accept: type },
            timeout: 3000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
          });

          if (response.status >= 200 && response.status < 400) {
            formats.push({
              format: format,
              url: response.request?.res?.responseUrl || `https://doi.org/${doi}`,
              priority: FORMAT_PRIORITY[format] || 5,
              validated: true,
              quality: 'high',
            });
          }
        } catch (error) {
          // Skip if format not available
          continue;
        }
      }

      if (formats.length > 0) {
        this.logger.debug(`DOI content negotiation found ${formats.length} formats for ${doi}`);
      }
    } catch (error: any) {
      this.logger.debug(`DOI content negotiation failed for ${doi}: ${error.message}`);
    }

    return formats;
  }

  /**
   * Detect format from URL heuristics
   */
  private detectFormatFromUrl(url: string): string {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('.pdf') || urlLower.includes('pdf')) return 'pdf';
    if (urlLower.includes('arxiv.org')) return 'latex-source';
    if (urlLower.includes('pubmed') || urlLower.includes('pmc')) return 'jats-xml';
    if (urlLower.includes('.xml')) return 'tei-xml';
    if (urlLower.includes('.html') || urlLower.includes('.htm')) return 'html-semantic';
    if (urlLower.includes('.epub')) return 'epub';
    if (urlLower.includes('.txt')) return 'txt';

    return 'html-semantic'; // Default assumption
  }

  /**
   * Deduplicate formats by URL
   */
  private deduplicateFormats(formats: AvailableFormat[]): AvailableFormat[] {
    const seen = new Set<string>();
    const unique: AvailableFormat[] = [];

    for (const format of formats) {
      if (format.url && !seen.has(format.url)) {
        seen.add(format.url);
        unique.push(format);
      }
    }

    return unique;
  }

  /**
   * Validate format availability (check if URL is accessible)
   */
  async validateFormat(format: AvailableFormat): Promise<AvailableFormat> {
    if (!format.url) {
      return { ...format, validated: false };
    }

    try {
      const response = await axios.head(format.url, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      const isValid = response.status >= 200 && response.status < 400;

      // Get content size if available
      const size = response.headers['content-length']
        ? parseInt(response.headers['content-length'], 10)
        : undefined;

      return {
        ...format,
        validated: true,
        size,
        quality: isValid ? format.quality : 'low',
      };
    } catch (error) {
      return {
        ...format,
        validated: true,
        quality: 'low',
      };
    }
  }

  /**
   * Validate all formats in parallel
   */
  async validateFormats(formats: AvailableFormat[]): Promise<AvailableFormat[]> {
    const validationResults = await Promise.all(
      formats.map((format) => this.validateFormat(format))
    );

    // Filter out invalid formats
    return validationResults.filter((f) => f.quality !== 'low');
  }

  /**
   * Enrich article with detected formats
   */
  async enrichArticle(article: AcademicArticle): Promise<AcademicArticle> {
    const formats = await this.detectFormats(article);

    if (formats.length === 0) {
      return article;
    }

    return {
      ...article,
      availableFormats: formats,
    };
  }
}

// Singleton export
export const multiFormatDetector = new MultiFormatDetectorService();
