/**
 * Plagiarism Check Service
 *
 * Uses embeddings to detect similarity between generated content and source articles
 * Prevents unintentional plagiarism by flagging high-similarity paragraphs
 */

import { logger } from '../config/logger.js';
import { embeddingsService } from './embeddings.service.js';
import type { FlowEnrichedArticle } from '../types/index.js';

export interface PlagiarismCheckResult {
  overallSimilarity: number;
  isPlagiarized: boolean;
  flaggedParagraphs: FlaggedParagraph[];
  totalParagraphs: number;
  safeParagraphs: number;
  warnings: string[];
}

export interface FlaggedParagraph {
  index: number;
  text: string;
  similarity: number;
  mostSimilarSource: {
    title: string;
    authors: string[];
    similarity: number;
  };
}

class PlagiarismCheckService {
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold
  private readonly WARNING_THRESHOLD = 0.75; // 75% for warnings
  private readonly MIN_PARAGRAPH_LENGTH = 100; // Minimum chars to check

  /**
   * Check generated content for plagiarism against source articles
   */
  async checkPlagiarism(
    generatedContent: string,
    sourceArticles: FlowEnrichedArticle[]
  ): Promise<PlagiarismCheckResult> {
    try {
      logger.info('Starting plagiarism check', {
        contentLength: generatedContent.length,
        sourceArticlesCount: sourceArticles.length
      });

      // 1. Split generated content into paragraphs
      const paragraphs = this.splitIntoParagraphs(generatedContent);

      if (paragraphs.length === 0) {
        return this.createEmptyResult();
      }

      // 2. Generate embeddings for paragraphs (filter short ones)
      const validParagraphs = paragraphs.filter(
        (p) => p.text.length >= this.MIN_PARAGRAPH_LENGTH
      );

      if (validParagraphs.length === 0) {
        return this.createEmptyResult();
      }

      logger.info('Generating embeddings for paragraphs', {
        totalParagraphs: paragraphs.length,
        validParagraphs: validParagraphs.length
      });

      const paragraphEmbeddings = await this.generateParagraphEmbeddings(
        validParagraphs.map((p) => p.text)
      );

      // 3. Generate embeddings for source articles
      const sourceEmbeddings = await this.generateSourceEmbeddings(
        sourceArticles
      );

      // 4. Calculate similarities
      const similarities = this.calculateSimilarities(
        paragraphEmbeddings,
        sourceEmbeddings,
        validParagraphs,
        sourceArticles
      );

      // 5. Identify flagged paragraphs
      const flagged = similarities.filter(
        (s) => s.similarity >= this.SIMILARITY_THRESHOLD
      );

      const warnings = similarities.filter(
        (s) =>
          s.similarity >= this.WARNING_THRESHOLD &&
          s.similarity < this.SIMILARITY_THRESHOLD
      );

      // 6. Calculate overall similarity
      const overallSimilarity =
        similarities.reduce((sum, s) => sum + s.similarity, 0) /
        similarities.length;

      const result: PlagiarismCheckResult = {
        overallSimilarity,
        isPlagiarized: flagged.length > 0,
        flaggedParagraphs: flagged,
        totalParagraphs: validParagraphs.length,
        safeParagraphs: validParagraphs.length - flagged.length - warnings.length,
        warnings: warnings.map(
          (w) =>
            `Parágrafo ${w.index + 1} tem similaridade moderada (${(w.similarity * 100).toFixed(1)}%) com "${w.mostSimilarSource.title}"`
        )
      };

      logger.info('Plagiarism check completed', {
        overallSimilarity: (overallSimilarity * 100).toFixed(1) + '%',
        flaggedCount: flagged.length,
        warningCount: warnings.length,
        safeCount: result.safeParagraphs
      });

      return result;
    } catch (error: any) {
      logger.error('Plagiarism check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Split content into paragraphs
   */
  private splitIntoParagraphs(
    content: string
  ): Array<{ index: number; text: string }> {
    // Split by double newlines or markdown headers
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs.map((text, index) => ({ index, text }));
  }

  /**
   * Generate embeddings for paragraphs in batches
   */
  private async generateParagraphEmbeddings(
    paragraphs: string[]
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches of 10 to avoid overwhelming the embedding service
    const batchSize = 10;

    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);

      const batchEmbeddings = await Promise.all(
        batch.map((text) => embeddingsService.generateEmbedding(text))
      );

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Generate embeddings for source articles
   */
  private async generateSourceEmbeddings(
    articles: FlowEnrichedArticle[]
  ): Promise<Array<{ article: FlowEnrichedArticle; embedding: number[] }>> {
    const results = await Promise.all(
      articles.map(async (article) => {
        // Use fullContent if available, otherwise abstract
        const text =
          article.fullContent ||
          article.abstract ||
          `${article.title}. ${article.abstract || ''}`;

        // Limit text length to avoid token limits
        const truncatedText = text.substring(0, 5000);

        const embedding = await embeddingsService.generateEmbedding(
          truncatedText
        );

        return { article, embedding };
      })
    );

    return results;
  }

  /**
   * Calculate similarities between paragraphs and sources
   */
  private calculateSimilarities(
    paragraphEmbeddings: number[][],
    sourceEmbeddings: Array<{ article: FlowEnrichedArticle; embedding: number[] }>,
    paragraphs: Array<{ index: number; text: string }>,
    sourceArticles: FlowEnrichedArticle[]
  ): FlaggedParagraph[] {
    return paragraphEmbeddings.map((paragraphEmb, i) => {
      // Find most similar source
      let maxSimilarity = 0;
      let mostSimilarSource = sourceArticles[0];

      sourceEmbeddings.forEach(({ article, embedding }) => {
        const similarity = this.cosineSimilarity(paragraphEmb, embedding);

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilarSource = article;
        }
      });

      return {
        index: paragraphs[i].index,
        text: paragraphs[i].text,
        similarity: maxSimilarity,
        mostSimilarSource: {
          title: mostSimilarSource.title,
          authors: mostSimilarSource.authors,
          similarity: maxSimilarity
        }
      };
    });
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Create empty result for cases with no content
   */
  private createEmptyResult(): PlagiarismCheckResult {
    return {
      overallSimilarity: 0,
      isPlagiarized: false,
      flaggedParagraphs: [],
      totalParagraphs: 0,
      safeParagraphs: 0,
      warnings: []
    };
  }

  /**
   * Generate report with recommendations
   */
  generateReport(result: PlagiarismCheckResult): string {
    const report: string[] = [];

    report.push('# 🔍 RELATÓRIO DE VERIFICAÇÃO DE PLÁGIO\n');

    // Overall status
    if (result.isPlagiarized) {
      report.push('## ⚠️ STATUS: ALTA SIMILARIDADE DETECTADA\n');
      report.push(
        `Encontramos **${result.flaggedParagraphs.length} parágrafos** com similaridade superior a ${this.SIMILARITY_THRESHOLD * 100}% com os artigos fonte.\n`
      );
    } else if (result.warnings.length > 0) {
      report.push('## ⚡ STATUS: ATENÇÃO RECOMENDADA\n');
      report.push(
        `Encontramos **${result.warnings.length} parágrafos** com similaridade moderada.\n`
      );
    } else {
      report.push('## ✅ STATUS: CONTEÚDO ORIGINAL\n');
      report.push(
        'O conteúdo gerado apresenta baixa similaridade com os artigos fonte.\n'
      );
    }

    // Statistics
    report.push('## 📊 ESTATÍSTICAS\n');
    report.push(`- **Parágrafos analisados:** ${result.totalParagraphs}`);
    report.push(
      `- **Similaridade média:** ${(result.overallSimilarity * 100).toFixed(1)}%`
    );
    report.push(`- **Parágrafos seguros:** ${result.safeParagraphs}`);
    report.push(
      `- **Parágrafos com aviso:** ${result.warnings.length}`
    );
    report.push(
      `- **Parágrafos problemáticos:** ${result.flaggedParagraphs.length}\n`
    );

    // Flagged paragraphs
    if (result.flaggedParagraphs.length > 0) {
      report.push('## 🚨 PARÁGRAFOS PROBLEMÁTICOS\n');

      result.flaggedParagraphs.forEach((flagged, i) => {
        report.push(`### ${i + 1}. Parágrafo ${flagged.index + 1}`);
        report.push(
          `**Similaridade:** ${(flagged.similarity * 100).toFixed(1)}%`
        );
        report.push(`**Fonte similar:** ${flagged.mostSimilarSource.title}`);
        report.push(`**Autores:** ${flagged.mostSimilarSource.authors.join(', ')}`);
        report.push(`**Texto:**\n> ${flagged.text.substring(0, 200)}...\n`);
      });
    }

    // Recommendations
    report.push('## 💡 RECOMENDAÇÕES\n');

    if (result.isPlagiarized) {
      report.push(
        '1. **Reescrever parágrafos problemáticos** com suas próprias palavras'
      );
      report.push('2. **Adicionar mais citações** aos trechos baseados em fontes');
      report.push(
        '3. **Parafrasear adequadamente** mantendo o sentido mas alterando a estrutura'
      );
      report.push(
        '4. **Considerar gerar novamente** com temperatura mais alta para maior variação'
      );
    } else if (result.warnings.length > 0) {
      report.push('1. Revisar parágrafos com avisos para garantir paráfrase adequada');
      report.push('2. Adicionar citações onde apropriado');
    } else {
      report.push('✅ Conteúdo aprovado para uso acadêmico');
      report.push('✅ Manter as citações adequadas ao longo do texto');
    }

    return report.join('\n');
  }
}

export const plagiarismCheckService = new PlagiarismCheckService();
