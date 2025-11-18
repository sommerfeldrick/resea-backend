/**
 * Qdrant Vector Database Service
 *
 * Manages storage and retrieval of article embeddings in Qdrant
 * Enables fast similarity search across large article collections
 */

import { logger } from '../config/logger.js';
import { embeddingsService } from './embeddings.service.js';
import type { FlowEnrichedArticle } from '../types/index.js';

// Qdrant client types (will be installed separately)
interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    articleId: string;
    title: string;
    abstract?: string;
    year?: number;
    source: string;
    doi?: string;
    score?: number;
  };
}

interface SimilarArticle {
  article: FlowEnrichedArticle;
  similarity: number;
  distance: number;
}

class QdrantService {
  private readonly COLLECTION_NAME = 'research_articles';
  private readonly VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small dimension
  private readonly QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

  private client: any = null;
  private isConnected = false;

  /**
   * Initialize Qdrant client and create collection if needed
   */
  async initialize(): Promise<void> {
    try {
      // Try to import Qdrant client (optional dependency)
      const { QdrantClient } = await import('@qdrant/js-client-rest');

      this.client = new QdrantClient({
        url: this.QDRANT_URL
      });

      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c: any) => c.name === this.COLLECTION_NAME
      );

      if (!exists) {
        // Create collection
        await this.client.createCollection(this.COLLECTION_NAME, {
          vectors: {
            size: this.VECTOR_SIZE,
            distance: 'Cosine' // Cosine distance for similarity
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });

        logger.info('Qdrant collection created', {
          collection: this.COLLECTION_NAME,
          vectorSize: this.VECTOR_SIZE
        });
      }

      this.isConnected = true;
      logger.info('Qdrant service initialized', { url: this.QDRANT_URL });
    } catch (error: any) {
      logger.warn('Qdrant not available, using in-memory fallback', {
        error: error.message
      });
      this.isConnected = false;
    }
  }

  /**
   * Store article embeddings in Qdrant
   */
  async storeArticleEmbeddings(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>
  ): Promise<void> {
    if (!this.isConnected || !this.client) {
      logger.debug('Qdrant not connected, skipping storage');
      return;
    }

    try {
      const points: QdrantPoint[] = articles
        .map(article => {
          const vector = embeddings.get(article.id);
          if (!vector) return null;

          return {
            id: article.id,
            vector,
            payload: {
              articleId: article.id,
              title: article.title,
              abstract: article.abstract,
              year: article.year,
              source: article.source,
              doi: article.doi,
              score:
                typeof article.score === 'object'
                  ? article.score.score
                  : article.score
            }
          };
        })
        .filter(Boolean) as QdrantPoint[];

      if (points.length === 0) {
        return;
      }

      // Upload points in batches of 100
      for (let i = 0; i < points.length; i += 100) {
        const batch = points.slice(i, i + 100);

        await this.client.upsert(this.COLLECTION_NAME, {
          wait: true,
          points: batch
        });

        logger.debug('Stored embeddings batch in Qdrant', {
          processed: i + batch.length,
          total: points.length
        });
      }

      logger.info('Article embeddings stored in Qdrant', {
        count: points.length,
        collection: this.COLLECTION_NAME
      });
    } catch (error: any) {
      logger.error('Failed to store embeddings in Qdrant', {
        error: error.message
      });
    }
  }

  /**
   * Find similar articles using vector search
   */
  async findSimilarArticles(
    queryArticle: FlowEnrichedArticle,
    allArticles: FlowEnrichedArticle[],
    limit: number = 10,
    minSimilarity: number = 0.7
  ): Promise<SimilarArticle[]> {
    if (!this.isConnected || !this.client) {
      logger.debug('Qdrant not connected, using fallback similarity search');
      return this.fallbackSimilaritySearch(queryArticle, allArticles, limit, minSimilarity);
    }

    try {
      // Generate embedding for query article
      const queryText = `${queryArticle.title} ${queryArticle.title} ${queryArticle.title} ${queryArticle.abstract || ''} ${queryArticle.abstract || ''}`;
      const [queryEmbedding] = await embeddingsService.generateBatchEmbeddings([
        queryText.substring(0, 8000)
      ]);

      // Search for similar vectors
      const searchResult = await this.client.search(this.COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: limit + 1, // +1 to exclude the query article itself
        with_payload: true,
        score_threshold: minSimilarity
      });

      const articleMap = new Map(allArticles.map(a => [a.id, a]));
      const similarArticles: SimilarArticle[] = [];

      for (const result of searchResult) {
        // Skip the query article itself
        if (result.id === queryArticle.id) continue;

        const article = articleMap.get(result.id);
        if (article) {
          similarArticles.push({
            article,
            similarity: result.score,
            distance: 1 - result.score
          });
        }
      }

      return similarArticles.slice(0, limit);
    } catch (error: any) {
      logger.error('Failed to search similar articles in Qdrant', {
        error: error.message
      });
      return this.fallbackSimilaritySearch(queryArticle, allArticles, limit, minSimilarity);
    }
  }

  /**
   * Batch similarity search for multiple queries
   */
  async batchSimilaritySearch(
    queryArticles: FlowEnrichedArticle[],
    allArticles: FlowEnrichedArticle[],
    limit: number = 5,
    minSimilarity: number = 0.7
  ): Promise<Map<string, SimilarArticle[]>> {
    const results = new Map<string, SimilarArticle[]>();

    for (const queryArticle of queryArticles) {
      const similarArticles = await this.findSimilarArticles(
        queryArticle,
        allArticles,
        limit,
        minSimilarity
      );
      results.set(queryArticle.id, similarArticles);
    }

    return results;
  }

  /**
   * Fallback in-memory similarity search (when Qdrant not available)
   */
  private async fallbackSimilaritySearch(
    queryArticle: FlowEnrichedArticle,
    allArticles: FlowEnrichedArticle[],
    limit: number,
    minSimilarity: number
  ): Promise<SimilarArticle[]> {
    try {
      // Generate embeddings for all articles
      const texts = allArticles.map(a => {
        const title = a.title || '';
        const abstract = a.abstract || '';
        return `${title} ${title} ${title} ${abstract} ${abstract}`.substring(0, 8000);
      });

      // Process in batches of 10
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += 10) {
        const batch = texts.slice(i, i + 10);
        const batchEmbeddings = await embeddingsService.generateBatchEmbeddings(batch);
        allEmbeddings.push(...batchEmbeddings);
      }

      // Find query article embedding
      const queryIndex = allArticles.findIndex(a => a.id === queryArticle.id);
      if (queryIndex === -1) {
        return [];
      }

      const queryEmbedding = allEmbeddings[queryIndex];

      // Calculate similarities
      const similarities: Array<{
        article: FlowEnrichedArticle;
        similarity: number;
        distance: number;
      }> = [];

      for (let i = 0; i < allArticles.length; i++) {
        if (i === queryIndex) continue; // Skip query article itself

        const similarity = this.cosineSimilarity(queryEmbedding, allEmbeddings[i]);

        if (similarity >= minSimilarity) {
          similarities.push({
            article: allArticles[i],
            similarity,
            distance: 1 - similarity
          });
        }
      }

      // Sort by similarity (descending) and take top N
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error: any) {
      logger.error('Fallback similarity search failed', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Delete collection (for cleanup/testing)
   */
  async deleteCollection(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.deleteCollection(this.COLLECTION_NAME);
      logger.info('Qdrant collection deleted', {
        collection: this.COLLECTION_NAME
      });
    } catch (error: any) {
      logger.error('Failed to delete Qdrant collection', {
        error: error.message
      });
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const info = await this.client.getCollection(this.COLLECTION_NAME);
      return info;
    } catch (error: any) {
      logger.error('Failed to get collection info', { error: error.message });
      return null;
    }
  }

  /**
   * Check if Qdrant is available and connected
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }
}

export const qdrantService = new QdrantService();
