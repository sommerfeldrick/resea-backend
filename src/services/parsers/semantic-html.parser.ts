/**
 * Semantic HTML Parser
 * Parses semantic HTML from publisher websites
 */

import { BaseParser } from './base.parser.js';
import type { ParserOutput, ContentSection } from '../../types/content.types.js';
import * as cheerio from 'cheerio';

export class SemanticHTMLParser extends BaseParser {
  async parse(content: Buffer | string): Promise<ParserOutput> {
    const html = content.toString();
    const $ = cheerio.load(html);

    return {
      metadata: this.extractMetadata($),
      fullContent: {
        abstract: this.extractAbstract($),
        sections: this.extractSections($),
        references: this.extractReferences($),
      },
      format: 'html-semantic',
      quality: 7,
      extractionDate: new Date(),
    };
  }

  private extractMetadata($: cheerio.CheerioAPI): any {
    return {
      titulo:
        $('h1.article-title, meta[name="citation_title"]').first().text().trim() ||
        $('title').text().trim(),
      autores: $('meta[name="citation_author"]')
        .map((_, el) => $(el).attr('content'))
        .get(),
      ano: parseInt(
        $('meta[name="citation_publication_date"]').attr('content')?.substring(0, 4) || ''
      ),
      doi: $('meta[name="citation_doi"]').attr('content'),
      keywords: $('meta[name="citation_keywords"]')
        .map((_, el) => $(el).attr('content'))
        .get(),
    };
  }

  private extractAbstract($: cheerio.CheerioAPI): ContentSection | undefined {
    const abstractSelectors = [
      'section.abstract',
      'div.abstract',
      '#abstract',
      '[data-section="abstract"]',
    ];

    for (const selector of abstractSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();

        return {
          text: this.cleanText(text),
          wordCount: this.countWords(text),
        };
      }
    }

    return undefined;
  }

  private extractSections($: cheerio.CheerioAPI): ContentSection[] {
    const sections: ContentSection[] = [];

    // Look for <section> tags or divs with relevant classes
    const sectionElements = $('section[id], div.section, article section');

    sectionElements.each((_, element) => {
      const $section = $(element);

      // Extract section title
      const heading = $section.find('h2, h3, .section-title').first().text().trim();

      // Extract text (paragraphs)
      const paragraphs = $section
        .find('p')
        .map((_, p) => $(p).text().trim())
        .get();
      const text = paragraphs.join('\n\n');

      if (text.length > 100) {
        sections.push({
          heading: heading || 'Section',
          text: this.cleanText(text),
          wordCount: this.countWords(text),
        });
      }
    });

    return sections;
  }

  private extractReferences($: cheerio.CheerioAPI): any[] {
    const references: any[] = [];

    const refSelectors = [
      '#references li',
      '.references li',
      '.reference-list li',
      'ol.references li',
    ];

    for (const selector of refSelectors) {
      const refElements = $(selector);

      if (refElements.length > 0) {
        refElements.each((idx, element) => {
          const citation = $(element).text().trim();

          if (citation.length > 20) {
            references.push({
              id: `ref${idx + 1}`,
              citation: this.cleanText(citation),
            });
          }
        });

        break; // Found references, don't try other selectors
      }
    }

    return references;
  }
}
