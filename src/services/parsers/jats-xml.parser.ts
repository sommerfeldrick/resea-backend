/**
 * JATS XML Parser (Best quality!)
 * Parses JATS XML format from PubMed Central
 */

import { BaseParser } from './base.parser';
import type { ParserOutput, ContentSection, Reference, Figure, Table } from '../../types/content.types';
import * as xml2js from 'xml2js';
import { select } from 'xpath';
import { DOMParser } from '@xmldom/xmldom';

export class JATSXMLParser extends BaseParser {
  private parser: xml2js.Parser;

  constructor() {
    super();
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
  }

  async parse(content: Buffer | string): Promise<ParserOutput> {
    const xmlString = content.toString();
    const dom = new DOMParser().parseFromString(xmlString, 'text/xml');

    // Verify if JATS is valid
    if (!this.isJATS(dom)) {
      throw new Error('Not a valid JATS XML document');
    }

    return {
      metadata: this.extractMetadata(dom),
      fullContent: {
        abstract: this.extractAbstract(dom),
        introduction: this.extractSection(dom, 'introduction'),
        literatureReview: this.extractSection(dom, 'literature review'),
        methodology: this.extractSection(dom, 'methods'),
        results: this.extractSection(dom, 'results'),
        discussion: this.extractSection(dom, 'discussion'),
        conclusion: this.extractSection(dom, 'conclusion'),
        sections: this.extractAllSections(dom),
        references: this.extractReferences(dom),
        figures: this.extractFigures(dom),
        tables: this.extractTables(dom),
      },
      format: 'jats-xml',
      quality: 10,
      extractionDate: new Date(),
    };
  }

  private isJATS(dom: Document): boolean {
    const article = select('/article', dom);
    return article && Array.isArray(article) && article.length > 0;
  }

  private extractMetadata(dom: Document): any {
    return {
      titulo: this.getTextByXPath(dom, '//article-title'),
      autores: this.extractAuthors(dom),
      ano: parseInt(this.getTextByXPath(dom, '//pub-date/year') || ''),
      doi: this.getTextByXPath(dom, '//article-id[@pub-id-type="doi"]'),
      fonte: this.getTextByXPath(dom, '//journal-title'),
      keywords: this.extractKeywords(dom),
    };
  }

  private extractAbstract(dom: Document): ContentSection | undefined {
    const abstractText = this.getTextByXPath(dom, '//abstract');

    if (!abstractText) return undefined;

    return {
      text: this.cleanText(abstractText),
      wordCount: this.countWords(abstractText),
    };
  }

  private extractSection(dom: Document, sectionTitle: string): ContentSection | undefined {
    const titleLower = sectionTitle.toLowerCase();

    // Try to find section by title
    const sections = select('//body//sec', dom) as any[];

    for (const sec of sections) {
      const title = this.getTextByXPath(sec, 'title');

      if (title && title.toLowerCase().includes(titleLower)) {
        const paragraphs = select('.//p', sec) as any[];
        const text = paragraphs.map(p => this.extractTextFromNode(p)).join('\n\n');

        return {
          heading: title,
          text: this.cleanText(text),
          wordCount: this.countWords(text),
          citations: this.extractCitationsFromSection(sec),
          subsections: this.extractSubsections(sec),
        };
      }
    }

    return undefined;
  }

  private extractAllSections(dom: Document): ContentSection[] {
    const sections: ContentSection[] = [];
    const secNodes = select('//body/sec', dom) as any[];

    for (const sec of secNodes) {
      const title = this.getTextByXPath(sec, 'title');
      const paragraphs = select('.//p', sec) as any[];
      const text = paragraphs.map(p => this.extractTextFromNode(p)).join('\n\n');

      if (text.trim().length > 0) {
        sections.push({
          heading: title || 'Section',
          text: this.cleanText(text),
          wordCount: this.countWords(text),
          citations: this.extractCitationsFromSection(sec),
          subsections: this.extractSubsections(sec),
        });
      }
    }

    return sections;
  }

  private extractSubsections(secNode: any): ContentSection[] {
    const subsections: ContentSection[] = [];
    const subSecNodes = select('./sec', secNode) as any[];

    for (const subSec of subSecNodes) {
      const title = this.getTextByXPath(subSec, 'title');
      const paragraphs = select('.//p', subSec) as any[];
      const text = paragraphs.map(p => this.extractTextFromNode(p)).join('\n\n');

      if (text.trim().length > 0) {
        subsections.push({
          heading: title,
          text: this.cleanText(text),
          wordCount: this.countWords(text),
        });
      }
    }

    return subsections;
  }

  private extractAuthors(dom: Document): string[] {
    const authors: string[] = [];
    const authorNodes = select('//contrib[@contrib-type="author"]', dom) as any[];

    for (const author of authorNodes) {
      const given = this.getTextByXPath(author, './/given-names');
      const surname = this.getTextByXPath(author, './/surname');

      if (surname) {
        authors.push(`${surname}, ${given || ''}`.trim());
      }
    }

    return authors;
  }

  private extractKeywords(dom: Document): string[] {
    const keywords: string[] = [];
    const kwdNodes = select('//kwd', dom) as any[];

    for (const kwd of kwdNodes) {
      const text = this.extractTextFromNode(kwd);
      if (text) keywords.push(text);
    }

    return keywords;
  }

  private extractReferences(dom: Document): Reference[] {
    const references: Reference[] = [];
    const refNodes = select('//ref-list/ref', dom) as any[];

    for (const ref of refNodes) {
      const id = ref.getAttribute?.('id') || '';
      const citation = this.getTextByXPath(ref, './/mixed-citation | .//element-citation');
      const doi = this.getTextByXPath(ref, './/pub-id[@pub-id-type="doi"]');
      const pmid = this.getTextByXPath(ref, './/pub-id[@pub-id-type="pmid"]');

      if (citation) {
        references.push({
          id,
          citation: this.cleanText(citation),
          doi,
          pmid,
        });
      }
    }

    return references;
  }

  private extractFigures(dom: Document): Figure[] {
    const figures: Figure[] = [];
    const figNodes = select('//fig', dom) as any[];

    for (const fig of figNodes) {
      const id = fig.getAttribute?.('id') || '';
      const caption = this.getTextByXPath(fig, './/caption');
      const graphicHref = this.getTextByXPath(fig, './/graphic/@xlink:href');

      if (caption) {
        figures.push({
          id,
          caption: this.cleanText(caption),
          url: graphicHref,
        });
      }
    }

    return figures;
  }

  private extractTables(dom: Document): Table[] {
    const tables: Table[] = [];
    const tableNodes = select('//table-wrap', dom) as any[];

    for (const tableWrap of tableNodes) {
      const id = tableWrap.getAttribute?.('id') || '';
      const caption = this.getTextByXPath(tableWrap, './/caption');

      // Extract table data (simplified)
      const rows = select('.//table//tr', tableWrap) as any[];
      const data: string[][] = [];

      for (const row of rows) {
        const cells = select('.//td | .//th', row) as any[];
        const rowData = cells.map(cell => this.extractTextFromNode(cell));
        data.push(rowData);
      }

      if (caption && data.length > 0) {
        tables.push({
          id,
          caption: this.cleanText(caption),
          data,
        });
      }
    }

    return tables;
  }

  private extractCitationsFromSection(secNode: any): string[] {
    const citations: string[] = [];
    const xrefNodes = select('.//xref[@ref-type="bibr"]', secNode) as any[];

    for (const xref of xrefNodes) {
      const rid = xref.getAttribute?.('rid');
      if (rid) citations.push(rid);
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  private getTextByXPath(node: any, xpath: string): string {
    const result = select(xpath, node);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '';
    }

    if (Array.isArray(result)) {
      return result.map(n => this.extractTextFromNode(n)).join(' ');
    }

    return this.extractTextFromNode(result);
  }

  private extractTextFromNode(node: any): string {
    if (!node) return '';

    if (typeof node === 'string') return node;

    if (node.nodeType === 2) {
      // Attribute node
      return node.nodeValue || '';
    }

    if (node.textContent) {
      return node.textContent;
    }

    return '';
  }
}
