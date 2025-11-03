/**
 * NLP Enrichment Service
 * Provides text analysis and enrichment using OpenRouter AI
 * Uses minimax/minimax-m2:free model
 */

import { OpenRouterService } from './openrouter.service.js';
import type { StructuredContent } from '../../types/content.types.js';
import { Logger } from '../../utils/simple-logger.js';

export class NLPEnrichmentService {
  private openRouter: OpenRouterService;
  private logger: Logger;

  constructor() {
    this.openRouter = new OpenRouterService();
    this.logger = new Logger('NLPEnrichmentService');
    this.logger.info('NLP enrichment service initialized');
  }

  /**
   * Generate 3-sentence summary of article
   */
  async summarize(content: StructuredContent): Promise<string> {
    try {
      const text = this.extractMainText(content);

      if (!text || text.length < 50) {
        this.logger.warn('Text too short for summarization');
        return '';
      }

      const prompt = `Resuma este artigo acadêmico em EXATAMENTE 3 frases objetivas em português brasileiro.

Título: ${content.articleId}
Texto: ${text.substring(0, 3000)}

Responda APENAS com as 3 frases do resumo, sem introduções ou explicações adicionais:`;

      this.logger.debug('Generating summary');

      const summary = await this.openRouter.complete(prompt, {
        temperature: 0.3,
        max_tokens: 200,
      });

      this.logger.info('Summary generated successfully');

      return summary.trim();
    } catch (error: any) {
      this.logger.error(`Summarization failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Extract key points from a section
   */
  async extractKeyPoints(sectionText: string, maxPoints: number = 5): Promise<string[]> {
    try {
      if (!sectionText || sectionText.length < 100) {
        this.logger.warn('Text too short for key point extraction');
        return [];
      }

      const prompt = `Extraia os ${maxPoints} pontos-chave mais importantes deste texto acadêmico em português:

${sectionText.substring(0, 3000)}

Liste APENAS os pontos-chave, um por linha, sem numeração ou marcadores:`;

      this.logger.debug('Extracting key points');

      const response = await this.openRouter.complete(prompt, {
        temperature: 0.3,
        max_tokens: 300,
      });

      const points = response
        .split('\n')
        .map(line => line.replace(/^[-•*\d.)\]]\s*/, '').trim())
        .filter(line => line.length > 10)
        .slice(0, maxPoints);

      this.logger.info(`Extracted ${points.length} key points`);

      return points;
    } catch (error: any) {
      this.logger.error(`Key points extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate questions about the content
   */
  async generateQuestions(content: StructuredContent, count: number = 5): Promise<string[]> {
    try {
      const text = this.extractMainText(content);

      if (!text || text.length < 100) {
        this.logger.warn('Text too short for question generation');
        return [];
      }

      const prompt = `Com base neste artigo acadêmico, gere ${count} perguntas relevantes que um pesquisador poderia fazer:

${text.substring(0, 2000)}

Liste APENAS as perguntas, uma por linha:`;

      this.logger.debug('Generating questions');

      const response = await this.openRouter.complete(prompt, {
        temperature: 0.5,
        max_tokens: 300,
      });

      const questions = response
        .split('\n')
        .map(line => line.replace(/^[-•*\d.)\]]\s*/, '').trim())
        .filter(line => line.length > 10 && line.includes('?'))
        .slice(0, count);

      this.logger.info(`Generated ${questions.length} questions`);

      return questions;
    } catch (error: any) {
      this.logger.error(`Question generation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Classify article into research categories
   */
  async classifyArticle(title: string, abstract?: string): Promise<string[]> {
    try {
      const text = abstract ? `${title}\n\n${abstract}` : title;

      const prompt = `Classifique este artigo acadêmico nas categorias de pesquisa mais relevantes:

${text.substring(0, 1500)}

Liste de 2 a 4 categorias principais (ex: Machine Learning, Educação, Saúde, etc), uma por linha:`;

      this.logger.debug('Classifying article');

      const response = await this.openRouter.complete(prompt, {
        temperature: 0.2,
        max_tokens: 100,
      });

      const categories = response
        .split('\n')
        .map(line => line.replace(/^[-•*\d.)\]]\s*/, '').trim())
        .filter(line => line.length > 2 && line.length < 50)
        .slice(0, 4);

      this.logger.info(`Classified into ${categories.length} categories`);

      return categories;
    } catch (error: any) {
      this.logger.error(`Classification failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract methodology description
   */
  async extractMethodology(content: StructuredContent): Promise<string> {
    try {
      const methodologyText = content.sections['methodology']?.content ||
                             content.sections['methods']?.content;

      if (!methodologyText) {
        this.logger.warn('No methodology section found');
        return '';
      }

      const prompt = `Resuma a metodologia deste estudo em 2-3 frases claras e objetivas:

${methodologyText.substring(0, 2000)}

Responda APENAS com o resumo da metodologia:`;

      this.logger.debug('Extracting methodology');

      const methodology = await this.openRouter.complete(prompt, {
        temperature: 0.3,
        max_tokens: 150,
      });

      this.logger.info('Methodology extracted');

      return methodology.trim();
    } catch (error: any) {
      this.logger.error(`Methodology extraction failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Compare two articles and find similarities
   */
  async compareArticles(article1Text: string, article2Text: string): Promise<string> {
    try {
      const prompt = `Compare estes dois artigos acadêmicos e identifique as principais semelhanças e diferenças:

ARTIGO 1:
${article1Text.substring(0, 1500)}

ARTIGO 2:
${article2Text.substring(0, 1500)}

Responda em português de forma concisa (máximo 5 frases):`;

      this.logger.debug('Comparing articles');

      const comparison = await this.openRouter.complete(prompt, {
        temperature: 0.4,
        max_tokens: 250,
      });

      this.logger.info('Articles compared');

      return comparison.trim();
    } catch (error: any) {
      this.logger.error(`Article comparison failed: ${error.message}`);
      return '';
    }
  }

  /**
   * Extract main text from structured content
   */
  private extractMainText(content: StructuredContent): string {
    const parts: string[] = [];

    // Collect text from sections in order of importance
    const sectionOrder = ['abstract', 'introduction', 'methodology', 'results', 'conclusion'];

    for (const sectionName of sectionOrder) {
      const section = content.sections[sectionName];
      if (section && section.content) {
        parts.push(section.content);
      }
    }

    // If no specific sections, use raw or cleaned text
    if (parts.length === 0) {
      if (content.cleaned) {
        parts.push(content.cleaned);
      } else if (content.raw) {
        parts.push(content.raw);
      }
    }

    return parts.join('\n\n').substring(0, 5000);
  }
}
