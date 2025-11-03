/**
 * Embedding Service
 * Generates vector embeddings for text using OpenRouter
 * Uses text-embedding-3-small model (1536 dimensions)
 */

import { OpenRouterService } from './openrouter.service.js';
import { Logger } from '../../utils/simple-logger.js';

export class EmbeddingService {
  private openRouter: OpenRouterService;
  private logger: Logger;
  private model: string = 'text-embedding-3-small';

  constructor() {
    this.openRouter = new OpenRouterService();
    this.logger = new Logger('EmbeddingService');
    this.logger.info('Embedding service initialized');
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        this.logger.warn('Empty text provided for embedding');
        return [];
      }

      // Truncate to avoid token limits (~8000 tokens = ~32k chars)
      const truncated = text.substring(0, 32000);

      this.logger.debug(`Generating embedding for text (${truncated.length} chars)`);

      const embedding = await this.openRouter.generateEmbedding(truncated);

      this.logger.debug(`Generated embedding with ${embedding.length} dimensions`);

      return embedding;
    } catch (error: any) {
      this.logger.error(`Embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      if (!texts || texts.length === 0) {
        this.logger.warn('Empty texts array provided for batch embedding');
        return [];
      }

      this.logger.info(`Generating embeddings for ${texts.length} texts`);

      // Truncate all texts
      const truncated = texts.map(t => (t || '').substring(0, 32000));

      const embeddings = await this.openRouter.generateEmbeddingBatch(truncated);

      this.logger.info(`Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error: any) {
      this.logger.error(`Batch embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embedding for article title + abstract
   */
  async embedArticle(title: string, abstract?: string): Promise<number[]> {
    const text = abstract ? `${title}\n\n${abstract}` : title;
    return this.embed(text);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar embedding from a list
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: number[][]
  ): { index: number; similarity: number } {
    let maxSimilarity = -1;
    let maxIndex = -1;

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbeddings[i]);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIndex = i;
      }
    }

    return { index: maxIndex, similarity: maxSimilarity };
  }

  /**
   * Get embedding model info
   */
  getModelInfo(): { name: string; dimensions: number } {
    return {
      name: this.model,
      dimensions: 1536, // text-embedding-3-small
    };
  }
}
