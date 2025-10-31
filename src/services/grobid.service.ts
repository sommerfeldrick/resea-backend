/**
 * GROBID Service - Extração estruturada de PDFs científicos
 *
 * Opções de uso:
 * 1. GROBID público (science-parse.allenai.org) - GRÁTIS
 * 2. GROBID self-hosted (Docker) - Requer infraestrutura
 * 3. Fallback: PDF.js + regex parsing
 */

import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../config/logger.js';
import { circuitBreakerService } from './circuitBreaker.service.js';

export interface GrobidExtraction {
  title: string;
  authors: string[];
  abstract?: string;
  sections: {
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
  references: Array<{
    title: string;
    authors: string[];
    year?: number;
  }>;
  metadata: {
    doi?: string;
    publicationDate?: string;
    journal?: string;
  };
}

export class GrobidService {
  private grobidUrl: string;
  private enabled: boolean;
  private useFallback: boolean;

  constructor() {
    // Preferência: GROBID self-hosted > Público > Desabilitado
    this.grobidUrl = process.env.GROBID_URL || 'https://kermitt2-grobid.hf.space';
    this.enabled = process.env.GROBID_ENABLED !== 'false'; // Habilitado por padrão
    this.useFallback = process.env.GROBID_FALLBACK !== 'false';

    if (this.enabled) {
      logger.info(`GROBID service initialized: ${this.grobidUrl}`);
    } else {
      logger.warn('GROBID service disabled');
    }
  }

  /**
   * Extrai estrutura completa de um PDF usando GROBID
   */
  async extractFromPDF(pdfBuffer: Buffer, filename: string = 'document.pdf'): Promise<GrobidExtraction | null> {
    if (!this.enabled) {
      logger.debug('GROBID disabled, skipping extraction');
      return null;
    }

    try {
      return await circuitBreakerService.execute(
        'grobid-extraction',
        async () => this._extractWithGrobid(pdfBuffer, filename),
        this.useFallback ? async () => this._fallbackExtraction(pdfBuffer) : undefined,
        {
          timeout: 60000, // 60s para PDFs grandes
          errorThresholdPercentage: 60,
          resetTimeout: 120000
        }
      );
    } catch (error: any) {
      logger.error('GROBID extraction failed', { error: error.message, filename });

      if (this.useFallback) {
        logger.info('Using fallback PDF extraction');
        return this._fallbackExtraction(pdfBuffer);
      }

      return null;
    }
  }

  /**
   * Extração usando GROBID API
   */
  private async _extractWithGrobid(pdfBuffer: Buffer, filename: string): Promise<GrobidExtraction> {
    const formData = new FormData();
    formData.append('input', pdfBuffer, {
      filename,
      contentType: 'application/pdf'
    });

    // GROBID processFulltextDocument endpoint
    const response = await axios.post(
      `${this.grobidUrl}/api/processFulltextDocument`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/xml'
        },
        timeout: 60000
      }
    );

    // Parse XML response (TEI format)
    return this._parseTEI(response.data);
  }

  /**
   * Parse GROBID TEI XML output
   */
  private _parseTEI(xml: string): GrobidExtraction {
    // Simplified parsing (você pode usar uma lib como 'xml2js' para parsing robusto)
    const extraction: GrobidExtraction = {
      title: this._extractBetween(xml, '<title', '</title>') || 'Unknown Title',
      authors: this._extractAuthors(xml),
      abstract: this._extractAbstract(xml),
      sections: this._extractSections(xml),
      references: this._extractReferences(xml),
      metadata: this._extractMetadata(xml)
    };

    return extraction;
  }

  /**
   * Fallback: Extração básica sem GROBID
   */
  private async _fallbackExtraction(pdfBuffer: Buffer): Promise<GrobidExtraction | null> {
    logger.warn('GROBID fallback not fully implemented - returning null');
    // Aqui você poderia usar pdf-parse ou outra lib
    // Por enquanto, retorna null para usar o web scraper existente
    return null;
  }

  /**
   * Helpers para parsing TEI XML
   */
  private _extractBetween(xml: string, start: string, end: string): string | null {
    const startIndex = xml.indexOf(start);
    if (startIndex === -1) return null;

    const contentStart = xml.indexOf('>', startIndex) + 1;
    const endIndex = xml.indexOf(end, contentStart);
    if (endIndex === -1) return null;

    return xml.substring(contentStart, endIndex).trim();
  }

  private _extractAuthors(xml: string): string[] {
    const authors: string[] = [];
    const authorRegex = /<author>(.*?)<\/author>/gs;
    let match;

    while ((match = authorRegex.exec(xml)) !== null) {
      const persName = this._extractBetween(match[1], '<persName>', '</persName>');
      if (persName) {
        authors.push(persName.replace(/<[^>]+>/g, '').trim());
      }
    }

    return authors;
  }

  private _extractAbstract(xml: string): string | undefined {
    const abstract = this._extractBetween(xml, '<abstract>', '</abstract>');
    return abstract?.replace(/<[^>]+>/g, '').trim();
  }

  private _extractSections(xml: string): GrobidExtraction['sections'] {
    const sections: GrobidExtraction['sections'] = {};

    // Simplified section extraction
    const divRegex = /<div[^>]*>(.*?)<\/div>/gs;
    let match;

    while ((match = divRegex.exec(xml)) !== null) {
      const content = match[1];
      const head = this._extractBetween(content, '<head>', '</head>')?.toLowerCase();

      if (head?.includes('introduction')) {
        sections.introduction = content.replace(/<[^>]+>/g, '').trim();
      } else if (head?.includes('method')) {
        sections.methodology = content.replace(/<[^>]+>/g, '').trim();
      } else if (head?.includes('result')) {
        sections.results = content.replace(/<[^>]+>/g, '').trim();
      } else if (head?.includes('discussion')) {
        sections.discussion = content.replace(/<[^>]+>/g, '').trim();
      } else if (head?.includes('conclusion')) {
        sections.conclusion = content.replace(/<[^>]+>/g, '').trim();
      }
    }

    return sections;
  }

  private _extractReferences(xml: string): GrobidExtraction['references'] {
    const references: GrobidExtraction['references'] = [];
    const biblRegex = /<biblStruct[^>]*>(.*?)<\/biblStruct>/gs;
    let match;

    while ((match = biblRegex.exec(xml)) !== null) {
      const ref = match[1];
      const title = this._extractBetween(ref, '<title', '</title>');
      const authors = this._extractAuthors(ref);
      const year = this._extractBetween(ref, '<date', '</date>');

      if (title) {
        references.push({
          title: title.replace(/<[^>]+>/g, '').trim(),
          authors,
          year: year ? parseInt(year.match(/\d{4}/)?.[0] || '0') : undefined
        });
      }
    }

    return references.slice(0, 20); // Limita a 20 referências
  }

  private _extractMetadata(xml: string): GrobidExtraction['metadata'] {
    return {
      doi: this._extractBetween(xml, '<idno type="DOI">', '</idno>') || undefined,
      publicationDate: this._extractBetween(xml, '<date', '</date>') || undefined,
      journal: this._extractBetween(xml, '<title level="j">', '</title>') || undefined
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await axios.get(`${this.grobidUrl}/api/isalive`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('GROBID health check failed', { url: this.grobidUrl });
      return false;
    }
  }
}

// Singleton export
export const grobidService = new GrobidService();
