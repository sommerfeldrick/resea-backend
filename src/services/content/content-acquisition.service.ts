/**
 * Content Acquisition Service
 * Downloads and parses academic content in multiple formats
 * Handles format prioritization, fallback, and error recovery
 */

import axios from 'axios';
import type { AcademicArticle, AvailableFormat } from '../../types';
import { parserFactory, type ParsedContent } from './parser-factory.service';
import { multiFormatDetector } from './multi-format-detector.service';
import { Logger } from '../../utils/simple-logger';

export interface AcquisitionResult {
  success: boolean;
  content?: ParsedContent;
  format?: string;
  url?: string;
  error?: string;
  fallbackAttempts?: number;
}

export class ContentAcquisitionService {
  private logger: Logger;
  private maxRetries: number = 3;
  private timeout: number = 30000; // 30 seconds

  constructor() {
    this.logger = new Logger('ContentAcquisition');
  }

  /**
   * Acquire full-text content for an article
   * Tries formats in priority order with automatic fallback
   */
  async acquireContent(article: AcademicArticle): Promise<AcquisitionResult> {
    // Ensure article has availableFormats
    let formats = article.availableFormats;

    if (!formats || formats.length === 0) {
      this.logger.info(`No formats available, detecting formats for ${article.doi || article.id}`);
      const enriched = await multiFormatDetector.enrichArticle(article);
      formats = enriched.availableFormats || [];
    }

    if (formats.length === 0) {
      return {
        success: false,
        error: 'No formats available for download',
      };
    }

    this.logger.info(
      `Attempting to acquire content for ${article.doi || article.id} from ${formats.length} formats`
    );

    // Try each format in priority order
    let fallbackAttempts = 0;

    for (const format of formats) {
      try {
        this.logger.debug(`Trying format: ${format.format} from ${format.url}`);

        const result = await this.downloadAndParse(format);

        if (result.success && result.content) {
          this.logger.info(`Successfully acquired content as ${format.format}`);
          return {
            ...result,
            fallbackAttempts,
          };
        }

        fallbackAttempts++;
      } catch (error: any) {
        this.logger.warn(
          `Failed to acquire ${format.format}: ${error.message}, trying next format...`
        );
        fallbackAttempts++;
        continue;
      }
    }

    return {
      success: false,
      error: `All ${formats.length} format(s) failed to download`,
      fallbackAttempts,
    };
  }

  /**
   * Download and parse content from a specific format
   */
  private async downloadAndParse(format: AvailableFormat): Promise<AcquisitionResult> {
    if (!format.url) {
      return {
        success: false,
        error: 'No URL available',
      };
    }

    try {
      // Download content
      const content = await this.downloadContent(format.url);

      if (!content) {
        return {
          success: false,
          error: 'Empty content received',
        };
      }

      // If format provides content directly (e.g., CORE API)
      if (format.content) {
        const parsed = await parserFactory.parse(format.content, format.format);
        return {
          success: !!parsed,
          content: parsed || undefined,
          format: format.format,
          url: format.url,
        };
      }

      // Parse downloaded content
      const parsed = await parserFactory.parse(content, format.format);

      if (!parsed) {
        return {
          success: false,
          error: 'Failed to parse content',
        };
      }

      return {
        success: true,
        content: parsed,
        format: format.format,
        url: format.url,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Download content from URL with retries
   */
  private async downloadContent(url: string): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Download attempt ${attempt}/${this.maxRetries}: ${url}`);

        const response = await axios.get(url, {
          timeout: this.timeout,
          maxRedirects: 5,
          responseType: 'text',
          headers: {
            'User-Agent': 'Resea Research Assistant (academic@resea.app)',
          },
        });

        if (response.data && typeof response.data === 'string') {
          this.logger.debug(`Downloaded ${response.data.length} bytes from ${url}`);
          return response.data;
        }

        return null;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Download attempt ${attempt} failed: ${error.message}`);

        // Exponential backoff
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after all retries');
  }

  /**
   * Acquire content from specific URL and format
   */
  async acquireFromUrl(url: string, format: string): Promise<AcquisitionResult> {
    const availableFormat: AvailableFormat = {
      format,
      url,
      priority: 5,
      validated: false,
    };

    return this.downloadAndParse(availableFormat);
  }

  /**
   * Enrich article with full-text content
   */
  async enrichArticle(article: AcademicArticle): Promise<AcademicArticle> {
    const result = await this.acquireContent(article);

    if (!result.success || !result.content) {
      this.logger.warn(`Failed to acquire content for ${article.doi || article.id}`);
      return article;
    }

    const parsed = result.content;

    return {
      ...article,
      title: parsed.title || article.title,
      abstract: parsed.abstract || article.abstract,
      authors: parsed.metadata?.authors || article.authors,
      year: parsed.metadata?.year || article.year,
      journal: parsed.metadata?.journal || article.journal,
      sections: parsed.sections,
      references: parsed.references,
      fullText: {
        raw: parsed.fullText,
        structured: parsed.sections,
      },
    };
  }
}

// Singleton export
export const contentAcquisition = new ContentAcquisitionService();
