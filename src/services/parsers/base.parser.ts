/**
 * Base Parser Interface and Implementation
 * All parsers extend this base class
 */

import type { ParserOutput } from '../../types/content.types.js';

export interface ContentParser {
  /**
   * Parse content and return structured format
   */
  parse(content: Buffer | string): Promise<ParserOutput>;

  /**
   * Validate if content is the expected format
   */
  validate?(content: Buffer | string): boolean;
}

export abstract class BaseParser implements ContentParser {
  abstract parse(content: Buffer | string): Promise<ParserOutput>;

  /**
   * Count words in text
   */
  protected countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Extract text from multiple nodes
   */
  protected extractText(node: any, selector?: string): string {
    if (!node) return '';

    if (typeof node === 'string') return node;

    if (Array.isArray(node)) {
      return node.map(n => this.extractText(n)).join(' ');
    }

    if (node._ || node.$t) {
      return node._ || node.$t;
    }

    return '';
  }

  /**
   * Clean text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
