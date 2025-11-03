/**
 * JSON Structured Parser (CORE)
 * Parses JSON-structured full-text from CORE API
 */

import { BaseParser } from './base.parser';
import type { ParserOutput, ContentSection } from '../../types/content.types';

export class JSONStructuredParser extends BaseParser {
  async parse(content: Buffer | string): Promise<ParserOutput> {
    const text = content.toString();

    // CORE already returns fullText in JSON - just structure it
    const sections = this.detectSections(text);

    return {
      metadata: {
        titulo: '',
        autores: [],
        ano: undefined,
      },
      fullContent: {
        abstract: this.extractAbstract(text),
        sections,
        references: this.extractReferencesFromText(text),
      },
      format: 'json-structured',
      quality: 9,
      extractionDate: new Date(),
    };
  }

  /**
   * Detect sections by common headers
   */
  private detectSections(text: string): ContentSection[] {
    const sections: ContentSection[] = [];

    // Common academic section patterns
    const patterns = [
      {
        name: 'Introduction',
        regex:
          /(?:^|\n)(INTRODUCTION|Introduction|1\.\s*Introduction)(?:\n|:)([\s\S]*?)(?=\n(?:METHODS?|LITERATURE|RESULTS?|DISCUSSION|CONCLUSION|References|2\.|$))/i,
      },
      {
        name: 'Literature Review',
        regex:
          /(?:^|\n)(LITERATURE REVIEW|Literature Review|2\.\s*Literature Review)(?:\n|:)([\s\S]*?)(?=\n(?:METHODS?|RESULTS?|DISCUSSION|CONCLUSION|References|3\.|$))/i,
      },
      {
        name: 'Methodology',
        regex:
          /(?:^|\n)(METHODS?|Methodology|Methods and Materials|3\.\s*Method)(?:\n|:)([\s\S]*?)(?=\n(?:RESULTS?|DISCUSSION|CONCLUSION|References|4\.|$))/i,
      },
      {
        name: 'Results',
        regex:
          /(?:^|\n)(RESULTS?|4\.\s*Results)(?:\n|:)([\s\S]*?)(?=\n(?:DISCUSSION|CONCLUSION|References|5\.|$))/i,
      },
      {
        name: 'Discussion',
        regex:
          /(?:^|\n)(DISCUSSION|5\.\s*Discussion)(?:\n|:)([\s\S]*?)(?=\n(?:CONCLUSION|References|6\.|$))/i,
      },
      {
        name: 'Conclusion',
        regex:
          /(?:^|\n)(CONCLUSION|Conclusions?|6\.\s*Conclusion)(?:\n|:)([\s\S]*?)(?=\n(?:References|Acknowledgments?|$))/i,
      },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const sectionText = match[2].trim();

        if (sectionText.length > 100) {
          sections.push({
            heading: pattern.name,
            text: this.cleanText(sectionText),
            wordCount: this.countWords(sectionText),
          });
        }
      }
    }

    return sections;
  }

  /**
   * Extract abstract
   */
  private extractAbstract(text: string): ContentSection | undefined {
    const abstractRegex =
      /(?:^|\n)(ABSTRACT|Abstract)(?:\n|:)([\s\S]*?)(?=\n(?:INTRODUCTION|Keywords?|1\.|$))/i;
    const match = text.match(abstractRegex);

    if (!match) return undefined;

    const abstractText = match[2].trim();

    return {
      text: this.cleanText(abstractText),
      wordCount: this.countWords(abstractText),
    };
  }

  /**
   * Extract references from text
   */
  private extractReferencesFromText(text: string): any[] {
    const references: any[] = [];

    // Look for references section
    const refRegex = /(?:^|\n)(REFERENCES|References|Bibliography)(?:\n|:)([\s\S]*?)$/i;
    const match = text.match(refRegex);

    if (!match) return references;

    const refSection = match[2];

    // Split by lines that start with number or [number]
    const refLines = refSection.split(/\n(?=\[\d+\]|\d+\.)/);

    refLines.forEach((line, idx) => {
      const cleaned = line.trim();
      if (cleaned.length > 20) {
        references.push({
          id: `ref${idx + 1}`,
          citation: this.cleanText(cleaned),
        });
      }
    });

    return references;
  }
}
