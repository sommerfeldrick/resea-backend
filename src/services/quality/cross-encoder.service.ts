/**
 * Cross-Encoder Reranking Service
 * Deep reranking using cross-encoder models for improved relevance
 * Can use HuggingFace Inference API or local model endpoint
 */

import axios from 'axios';
import type { EnrichedArticle } from '../../types/index.js';
import { Logger } from '../../utils/simple-logger.js';

export class CrossEncoderService {
  private logger: Logger;
  private apiUrl: string;
  private enabled: boolean;

  constructor() {
    this.logger = new Logger('CrossEncoder');
    // Can use HuggingFace Inference API or local model
    this.apiUrl = process.env.CROSS_ENCODER_API || 'http://localhost:8001/rerank';
    this.enabled = process.env.ENABLE_CROSS_ENCODER === 'true';

    if (this.enabled) {
      this.logger.info(`Cross-encoder enabled: ${this.apiUrl}`);
    } else {
      this.logger.info('Cross-encoder disabled (set ENABLE_CROSS_ENCODER=true to enable)');
    }
  }

  /**
   * Deep reranking using cross-encoder model
   * Returns articles sorted by cross-encoder relevance scores
   */
  async rerank(
    query: string,
    articles: EnrichedArticle[],
    topK?: number
  ): Promise<EnrichedArticle[]> {
    if (!this.enabled) {
      this.logger.warn('Cross-encoder disabled, returning original order');
      return articles;
    }

    if (articles.length === 0) return articles;

    try {
      // Prepare query-document pairs
      const pairs = articles.map((article) => ({
        id: article.doi || article.url || article.id,
        text: `${article.title} ${article.abstract || ''}`.substring(0, 512),
      }));

      this.logger.info(`Reranking ${pairs.length} articles for query: ${query.substring(0, 50)}...`);

      // Call reranking API
      const response = await axios.post(
        this.apiUrl,
        {
          query,
          documents: pairs,
          top_k: topK || articles.length,
        },
        { timeout: 30000 }
      );

      const scores = response.data.scores as number[];

      if (!Array.isArray(scores) || scores.length !== articles.length) {
        throw new Error('Invalid response from cross-encoder API');
      }

      // Update semantic relevance scores with cross-encoder scores
      const reranked = articles.map((article, idx) => ({
        ...article,
        metrics: {
          ...article.metrics,
          semanticRelevance: scores[idx] || article.metrics.semanticRelevance,
        },
      }));

      // Sort by cross-encoder score (descending)
      reranked.sort((a, b) => b.metrics.semanticRelevance - a.metrics.semanticRelevance);

      this.logger.info(`Reranking completed successfully`);

      return reranked;
    } catch (error: any) {
      this.logger.warn(`Reranking failed, returning original order: ${error.message}`);
      return articles;
    }
  }

  /**
   * Rerank in batches to handle large article sets
   */
  async rerankBatch(
    query: string,
    articles: EnrichedArticle[],
    batchSize: number = 100
  ): Promise<EnrichedArticle[]> {
    if (!this.enabled || articles.length === 0) {
      return articles;
    }

    // Split into batches
    const batches: EnrichedArticle[][] = [];
    for (let i = 0; i < articles.length; i += batchSize) {
      batches.push(articles.slice(i, i + batchSize));
    }

    this.logger.info(`Reranking ${articles.length} articles in ${batches.length} batches`);

    // Rerank each batch in parallel
    const rerankedBatches = await Promise.all(
      batches.map((batch) => this.rerank(query, batch))
    );

    // Flatten and return
    return rerankedBatches.flat();
  }

  /**
   * Check if cross-encoder service is available
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Cross-encoder health check failed');
      return false;
    }
  }
}

// Singleton export
export const crossEncoder = new CrossEncoderService();
