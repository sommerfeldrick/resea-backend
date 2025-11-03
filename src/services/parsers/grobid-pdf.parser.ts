/**
 * GROBID PDF Parser (fallback for PDFs)
 * Uses GROBID service to extract structured content from PDFs
 */

import { BaseParser } from './base.parser.js';
import type { ParserOutput } from '../../types/content.types.js';
import axios from 'axios';
import FormData from 'form-data';
import { TEIXMLParser } from './tei-xml.parser.js';

export class GROBIDParser extends BaseParser {
  private grobidUrl: string;
  private teiParser: TEIXMLParser;

  constructor() {
    super();
    this.grobidUrl = process.env.GROBID_URL || 'http://localhost:8070';
    this.teiParser = new TEIXMLParser();
  }

  async parse(content: Buffer | string): Promise<ParserOutput> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    // Send PDF to GROBID
    const teiXml = await this.processWithGrobid(buffer);

    // Parse resulting TEI XML
    return await this.teiParser.parse(teiXml);
  }

  private async processWithGrobid(pdfBuffer: Buffer): Promise<string> {
    const form = new FormData();
    form.append('input', pdfBuffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf',
    });

    try {
      const response = await axios.post(
        `${this.grobidUrl}/api/processFulltextDocument`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 120000, // 2 minutes
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error(`GROBID processing failed: ${error.message}`);
    }
  }
}
