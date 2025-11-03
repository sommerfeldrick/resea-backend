/**
 * TEI XML Parser (GROBID output)
 * Parses TEI XML format from GROBID PDF processing
 */

import { BaseParser } from './base.parser.js';
import type { ParserOutput, ContentSection } from '../../types/content.types.js';
import { DOMParser } from '@xmldom/xmldom';
import { select, SelectedValue } from 'xpath';

export class TEIXMLParser extends BaseParser {
  async parse(content: Buffer | string): Promise<ParserOutput> {
    const xmlString = content.toString();
    const dom = new DOMParser().parseFromString(xmlString, 'text/xml');

    return {
      metadata: this.extractMetadata(dom),
      fullContent: {
        abstract: this.extractAbstract(dom),
        sections: this.extractSections(dom),
        references: this.extractReferences(dom),
      },
      format: 'tei-xml',
      quality: 7,
      extractionDate: new Date(),
    };
  }

  private extractMetadata(dom: Document): any {
    return {
      titulo: this.getTextByXPath(dom, '//tei:titleStmt/tei:title'),
      autores: this.extractAuthors(dom),
      ano: this.getTextByXPath(dom, '//tei:publicationStmt/tei:date/@when')?.substring(0, 4),
    };
  }

  private extractAbstract(dom: Document): ContentSection | undefined {
    const abstractText = this.getTextByXPath(dom, '//tei:abstract');

    if (!abstractText) return undefined;

    return {
      text: this.cleanText(abstractText),
      wordCount: this.countWords(abstractText),
    };
  }

  private extractSections(dom: Document): ContentSection[] {
    const sections: ContentSection[] = [];
    const divNodes = this.selectNodes(dom, '//tei:body//tei:div');

    for (const div of divNodes) {
      const heading = this.getTextByXPath(div, './tei:head');
      const paragraphs = this.selectNodes(div, './/tei:p');
      const text = paragraphs.map(p => this.extractTextFromNode(p)).join('\n\n');

      if (text.trim().length > 100) {
        sections.push({
          heading: heading || 'Section',
          text: this.cleanText(text),
          wordCount: this.countWords(text),
        });
      }
    }

    return sections;
  }

  private extractAuthors(dom: Document): string[] {
    const authors: string[] = [];
    const authorNodes = this.selectNodes(dom, '//tei:author');

    for (const author of authorNodes) {
      const forename = this.getTextByXPath(author, './/tei:forename');
      const surname = this.getTextByXPath(author, './/tei:surname');

      if (surname) {
        authors.push(`${surname}, ${forename || ''}`.trim());
      }
    }

    return authors;
  }

  private extractReferences(dom: Document): any[] {
    const references: any[] = [];
    const biblNodes = this.selectNodes(dom, '//tei:listBibl/tei:biblStruct');

    for (const bibl of biblNodes) {
      const citation = this.getTextByXPath(bibl, '.');

      if (citation) {
        references.push({
          id: bibl.getAttribute?.('xml:id') || '',
          citation: this.cleanText(citation),
        });
      }
    }

    return references;
  }

  private selectNodes(node: any, xpath: string): any[] {
    const result = select(xpath, node);

    if (!result) return [];
    if (Array.isArray(result)) return result;
    return [result];
  }

  private getTextByXPath(node: any, xpath: string): string {
    const result = select(xpath, node) as SelectedValue;

    if (!result) return '';

    return this.extractTextFromNode(result);
  }

  private extractTextFromNode(node: any): string {
    if (!node) return '';

    if (typeof node === 'string') return node;

    if (node.textContent) {
      return node.textContent;
    }

    return '';
  }
}
