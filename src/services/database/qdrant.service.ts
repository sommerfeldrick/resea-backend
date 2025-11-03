/**
 * Qdrant Service
 * Vector database for semantic search
 * Uses Qdrant Cloud or local instance
 * Supports both article-level and chunk-level indexing
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { AcademicArticle } from '../../types/article.types.js';
import type { ContentChunk } from '../../types/content.types.js';
import { Logger } from '../../utils/simple-logger.js';
import { v4 as uuidv4 } from 'uuid';

export class QdrantService {
  private client: QdrantClient;
  private logger: Logger;
  private collectionName: string = 'academic_articles';
  private chunksCollectionName: string = 'article_chunks';
  private vectorSize: number = 768; // nomic-embed-text dimension

  constructor() {
    this.logger = new Logger('QdrantService');

    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = process.env.QDRANT_API_KEY;

    this.client = new QdrantClient({
      url,
      apiKey,
    });

    this.logger.info(`Qdrant client initialized: ${url}`);
    this.ensureCollection();
  }

  /**
   * Ensure collection exists
   */
  private async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();

      // Check articles collection
      const articlesExists = collections.collections.some(c => c.name === this.collectionName);
      if (!articlesExists) {
        this.logger.info(`Creating collection: ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });
        this.logger.info(`Collection created: ${this.collectionName}`);
      }

      // Check chunks collection
      const chunksExists = collections.collections.some(c => c.name === this.chunksCollectionName);
      if (!chunksExists) {
        this.logger.info(`Creating collection: ${this.chunksCollectionName}`);
        await this.client.createCollection(this.chunksCollectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });
        this.logger.info(`Collection created: ${this.chunksCollectionName}`);
      }
    } catch (error: any) {
      this.logger.warn(`Could not ensure collection: ${error.message}`);
    }
  }

  /**
   * Search for similar articles using vector embeddings
   */
  async search(
    embedding: number[],
    limit: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`Vector search: ${limit} results`);

      const searchParams: any = {
        vector: embedding,
        limit,
        with_payload: true,
      };

      // Apply filters if provided
      if (filters?.requireFullText) {
        searchParams.filter = {
          must: [
            {
              key: 'hasFullText',
              match: {
                value: true,
              },
            },
          ],
        };
      }

      const results = await this.client.search(this.collectionName, searchParams);

      return results.map(result => ({
        ...(result.payload as any),
        score: result.score,
      })) as AcademicArticle[];
    } catch (error: any) {
      this.logger.error(`Vector search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Index an article with its embedding
   */
  async index(article: AcademicArticle, embedding: number[]): Promise<void> {
    try {
      const id = article.doi || article.id || this.generateId(article);

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload: {
              ...article,
              hasFullText: !!(
                article.fullText ||
                article.pdfUrl ||
                (article.availableFormats && article.availableFormats.length > 0)
              ),
              indexedAt: new Date().toISOString(),
            },
          },
        ],
      });

      this.logger.debug(`Indexed article: ${id}`);
    } catch (error: any) {
      this.logger.error(`Failed to index article: ${error.message}`);
    }
  }

  /**
   * Index multiple articles in batch
   */
  async indexBatch(
    articles: Array<{ article: AcademicArticle; embedding: number[] }>
  ): Promise<void> {
    try {
      this.logger.info(`Batch indexing ${articles.length} articles`);

      const points = articles.map(({ article, embedding }) => {
        const id = article.doi || article.id || this.generateId(article);

        return {
          id,
          vector: embedding,
          payload: {
            ...article,
            hasFullText: !!(
              article.fullText ||
              article.pdfUrl ||
              (article.availableFormats && article.availableFormats.length > 0)
            ),
            indexedAt: new Date().toISOString(),
          },
        };
      });

      // Batch insert (max 100 at a time)
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);

        await this.client.upsert(this.collectionName, {
          wait: true,
          points: batch,
        });

        this.logger.info(`Indexed batch ${i / batchSize + 1}/${Math.ceil(points.length / batchSize)}`);
      }

      this.logger.info(`Successfully indexed ${articles.length} articles`);
    } catch (error: any) {
      this.logger.error(`Batch indexing failed: ${error.message}`);
    }
  }

  /**
   * Delete article by ID
   */
  async delete(articleId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [articleId],
      });

      this.logger.debug(`Deleted article: ${articleId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete article: ${error.message}`);
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo() {
    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error: any) {
      this.logger.error(`Failed to get collection info: ${error.message}`);
      return null;
    }
  }

  /**
   * Index chunks for RAG
   */
  async indexChunks(chunks: ContentChunk[]): Promise<void> {
    try {
      this.logger.info(`Indexing ${chunks.length} chunks`);

      const points = chunks.map(chunk => ({
        id: chunk.id || uuidv4(),
        vector: chunk.embedding!,
        payload: {
          ...chunk,
          embedding: undefined, // Don't duplicate embedding in payload
        },
      }));

      // Batch insert (max 100 at a time)
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);

        await this.client.upsert(this.chunksCollectionName, {
          wait: true,
          points: batch,
        });

        this.logger.info(
          `Indexed chunk batch ${i / batchSize + 1}/${Math.ceil(points.length / batchSize)}`
        );
      }

      this.logger.info(`Successfully indexed ${chunks.length} chunks`);
    } catch (error: any) {
      this.logger.error(`Failed to index chunks: ${error.message}`);
    }
  }

  /**
   * Search for relevant chunks using vector embeddings
   */
  async searchChunks(
    embedding: number[],
    limit: number = 20,
    filters?: { section?: string[] }
  ): Promise<ContentChunk[]> {
    try {
      this.logger.info(`Chunk search: ${limit} results`);

      const searchParams: any = {
        vector: embedding,
        limit,
        with_payload: true,
      };

      // Apply section filter if provided
      if (filters?.section && filters.section.length > 0) {
        searchParams.filter = {
          must: [
            {
              key: 'section',
              match: {
                any: filters.section,
              },
            },
          ],
        };
      }

      const results = await this.client.search(this.chunksCollectionName, searchParams);

      return results.map(result => result.payload as any as ContentChunk);
    } catch (error: any) {
      this.logger.error(`Chunk search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate unique ID for article
   */
  private generateId(article: AcademicArticle): string {
    const text = `${article.title}-${article.authors?.[0] || ''}-${article.year || ''}`;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `article_${Math.abs(hash)}`;
  }
}
