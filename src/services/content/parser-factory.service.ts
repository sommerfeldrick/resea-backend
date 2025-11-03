/**
 * Parser Factory Service
 * Creates appropriate parser for different content formats
 */

import type { ArticleFormat } from '../../types';
import type { ParserOutput } from '../../types/content.types';
import { Logger } from '../../utils/simple-logger';
import { ContentParser } from '../parsers/base.parser';
import { JATSXMLParser } from '../parsers/jats-xml.parser';
import { LaTeXParser } from '../parsers/latex.parser';
import { JSONStructuredParser } from '../parsers/json-structured.parser';
import { SemanticHTMLParser } from '../parsers/semantic-html.parser';
import { TEIXMLParser } from '../parsers/tei-xml.parser';
import { GROBIDParser } from '../parsers/grobid-pdf.parser';

/**
 * Legacy ParsedContent interface for backward compatibility
 */
export interface ParsedContent {
  title?: string;
  abstract?: string;
  sections?: {
    [key: string]: string;
  };
  references?: Array<{
    title: string;
    authors: string[];
    year?: number;
    doi?: string;
  }>;
  metadata?: {
    authors?: string[];
    journal?: string;
    year?: number;
    doi?: string;
  };
  fullText?: string;
}

/**
 * Parser Factory
 * Returns appropriate parser for given format
 */
export class ParserFactory {
  private logger: Logger;
  private parsers: Map<string, ContentParser>;

  constructor() {
    this.logger = new Logger('ParserFactory');
    this.parsers = new Map<string, ContentParser>();

    // Register all parsers
    this.parsers.set('jats-xml', new JATSXMLParser());
    this.parsers.set('jats', new JATSXMLParser());
    this.parsers.set('tei-xml', new TEIXMLParser());
    this.parsers.set('tei', new TEIXMLParser());
    this.parsers.set('json-structured', new JSONStructuredParser());
    this.parsers.set('json', new JSONStructuredParser());
    this.parsers.set('latex-source', new LaTeXParser());
    this.parsers.set('latex', new LaTeXParser());
    this.parsers.set('html-semantic', new SemanticHTMLParser());
    this.parsers.set('html', new SemanticHTMLParser());
    this.parsers.set('pdf', new GROBIDParser());
  }

  /**
   * Get parser for given format
   */
  getParser(format: ArticleFormat | string): ContentParser | null {
    const parser = this.parsers.get(format);
    if (!parser) {
      this.logger.warn(`No parser found for format: ${format}`);
      return null;
    }
    return parser;
  }

  /**
   * Check if parser exists for format
   */
  hasParser(format: ArticleFormat | string): boolean {
    return this.parsers.has(format);
  }

  /**
   * Parse content with appropriate parser (returns full ParserOutput)
   */
  async parseContent(
    content: Buffer | string,
    format: ArticleFormat | string
  ): Promise<ParserOutput | null> {
    const parser = this.getParser(format);
    if (!parser) {
      this.logger.error(`Cannot parse format: ${format}`);
      return null;
    }

    try {
      this.logger.info(`Parsing content as ${format}...`);
      return await parser.parse(content);
    } catch (error: any) {
      this.logger.error(`Failed to parse ${format}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse content with appropriate parser (legacy method for backward compatibility)
   * Converts ParserOutput to ParsedContent
   */
  async parse(content: string, format: ArticleFormat | string): Promise<ParsedContent | null> {
    const result = await this.parseContent(content, format);

    if (!result) return null;

    // Convert ParserOutput to legacy ParsedContent format
    return this.convertToLegacyFormat(result);
  }

  /**
   * Convert ParserOutput to legacy ParsedContent format
   */
  private convertToLegacyFormat(output: ParserOutput): ParsedContent {
    const sections: { [key: string]: string } = {};

    // Convert sections
    if (output.fullContent.sections) {
      output.fullContent.sections.forEach((section, index) => {
        const key = section.heading || `section_${index}`;
        sections[key] = section.text;
      });
    }

    // Add named sections
    if (output.fullContent.abstract) {
      sections['abstract'] = output.fullContent.abstract.text;
    }
    if (output.fullContent.introduction) {
      sections['introduction'] = output.fullContent.introduction.text;
    }
    if (output.fullContent.methodology) {
      sections['methodology'] = output.fullContent.methodology.text;
    }
    if (output.fullContent.results) {
      sections['results'] = output.fullContent.results.text;
    }
    if (output.fullContent.discussion) {
      sections['discussion'] = output.fullContent.discussion.text;
    }
    if (output.fullContent.conclusion) {
      sections['conclusion'] = output.fullContent.conclusion.text;
    }

    // Convert references
    const references =
      output.fullContent.references?.map(ref => ({
        title: ref.citation,
        authors: [],
        year: undefined,
        doi: ref.doi,
      })) || [];

    return {
      title: output.metadata.titulo,
      abstract: output.fullContent.abstract?.text,
      sections,
      references,
      metadata: {
        authors: output.metadata.autores,
        journal: output.metadata.fonte,
        year: output.metadata.ano,
        doi: output.metadata.doi,
      },
      fullText: Object.values(sections).join('\n\n'),
    };
  }
}

// Singleton export
export const parserFactory = new ParserFactory();
