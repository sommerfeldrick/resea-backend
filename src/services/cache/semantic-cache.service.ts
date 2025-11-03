/**
 * Semantic Cache Service
 * Caches search results using semantic similarity (Redis-based)
 * Queries with similar embeddings return cached results
 */

import { createClient, RedisClientType } from 'redis';
import type { EnrichedArticle } from '../../types/article.types';
import type { WorkSection } from '../../types/search.types';
import { EmbeddingService } from '../nlp/embedding.service';
import { Logger } from '../../utils/simple-logger';
import { CACHE_TTL } from '../../config/constants';

interface CachedSearchResult {
  query: string;
  embedding: number[];
  articles: EnrichedArticle[];
  timestamp: number;
}

export class SemanticCacheService {
  private redis: RedisClientType;
  private embedding: EmbeddingService;
  private logger: Logger;
  private similarityThreshold: number = 0.95;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = createClient({
      url: redisUrl,
    });

    this.embedding = new EmbeddingService();
    this.logger = new Logger('SemanticCacheService');

    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    try {
      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        this.logger.info('Redis connected');
        this.isConnected = true;
      });

      await this.redis.connect();
    } catch (error: any) {
      this.logger.error(`Redis connection failed: ${error.message}`);
      this.isConnected = false;
    }
  }

  /**
   * Get cached results for semantically similar query
   */
  async get(query: string, section: WorkSection): Promise<EnrichedArticle[] | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected - cache disabled');
      return null;
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embedding.embed(query);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        this.logger.warn('Failed to generate query embedding');
        return null;
      }

      // Search all cache entries for this section
      const pattern = `search:${section}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        this.logger.debug('No cache entries found');
        return null;
      }

      this.logger.debug(`Checking ${keys.length} cache entries for similarity`);

      // Check similarity with each cached entry
      for (const key of keys) {
        const cached = await this.redis.get(key);

        if (!cached) continue;

        try {
          const data: CachedSearchResult = JSON.parse(cached);

          // Calculate cosine similarity
          const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);

          if (similarity >= this.similarityThreshold) {
            this.logger.info(
              `✨ Cache HIT! Similarity: ${(similarity * 100).toFixed(1)}% | Query: "${query}"`
            );
            return data.articles;
          }
        } catch (parseError: any) {
          this.logger.warn(`Failed to parse cached entry: ${parseError.message}`);
          // Delete corrupted entry
          await this.redis.del(key);
        }
      }

      this.logger.info('❌ Cache MISS');
      return null;
    } catch (error: any) {
      this.logger.error(`Cache get failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache search results
   */
  async set(
    query: string,
    section: WorkSection,
    articles: EnrichedArticle[]
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected - skipping cache');
      return;
    }

    try {
      // Generate embedding
      const embedding = await this.embedding.embed(query);

      if (!embedding || embedding.length === 0) {
        this.logger.warn('Failed to generate embedding for cache');
        return;
      }

      // Create unique key with timestamp
      const key = `search:${section}:${Date.now()}`;

      const cacheData: CachedSearchResult = {
        query,
        embedding,
        articles,
        timestamp: Date.now(),
      };

      // Save with TTL (in seconds)
      const ttlSeconds = Math.floor(CACHE_TTL.SEMANTIC_CACHE / 1000);

      await this.redis.setEx(key, ttlSeconds, JSON.stringify(cacheData));

      this.logger.info(`💾 Cached ${articles.length} articles: ${key}`);
    } catch (error: any) {
      this.logger.error(`Cache set failed: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      this.logger.warn(
        `Embedding dimension mismatch: ${a.length} vs ${b.length}`
      );
      return 0;
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

    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Clean up old cache entries
   */
  async cleanup(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const allKeys = await this.redis.keys('search:*');
      let deleted = 0;

      this.logger.info(`Cleaning up cache: ${allKeys.length} entries to check`);

      for (const key of allKeys) {
        const cached = await this.redis.get(key);

        if (!cached) {
          await this.redis.del(key);
          deleted++;
          continue;
        }

        try {
          const data: CachedSearchResult = JSON.parse(cached);
          const age = Date.now() - data.timestamp;

          // Delete if older than TTL
          if (age > CACHE_TTL.SEMANTIC_CACHE) {
            await this.redis.del(key);
            deleted++;
          }
        } catch (parseError) {
          // Delete corrupted entries
          await this.redis.del(key);
          deleted++;
        }
      }

      this.logger.info(`🧹 Cleaned up ${deleted} old cache entries`);
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Clear all cache entries for a section
   */
  async clearSection(section: WorkSection): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const pattern = `search:${section}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info(`Cleared ${keys.length} cache entries for section: ${section}`);
      }
    } catch (error: any) {
      this.logger.error(`Clear section failed: ${error.message}`);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const keys = await this.redis.keys('search:*');

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info(`Cleared all ${keys.length} cache entries`);
      }
    } catch (error: any) {
      this.logger.error(`Clear all failed: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    sections: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    if (!this.isConnected) {
      return { totalEntries: 0, sections: {}, oldestEntry: null, newestEntry: null };
    }

    try {
      const keys = await this.redis.keys('search:*');
      const sections: Record<string, number> = {};
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for (const key of keys) {
        // Extract section from key: search:section:timestamp
        const parts = key.split(':');
        if (parts.length >= 2) {
          const section = parts[1];
          sections[section] = (sections[section] || 0) + 1;
        }

        // Get timestamp
        const cached = await this.redis.get(key);
        if (cached) {
          try {
            const data: CachedSearchResult = JSON.parse(cached);
            if (oldestEntry === null || data.timestamp < oldestEntry) {
              oldestEntry = data.timestamp;
            }
            if (newestEntry === null || data.timestamp > newestEntry) {
              newestEntry = data.timestamp;
            }
          } catch {
            // Skip corrupted entries
          }
        }
      }

      return {
        totalEntries: keys.length,
        sections,
        oldestEntry,
        newestEntry,
      };
    } catch (error: any) {
      this.logger.error(`Get stats failed: ${error.message}`);
      return { totalEntries: 0, sections: {}, oldestEntry: null, newestEntry: null };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
      this.isConnected = false;
      this.logger.info('Redis connection closed');
    } catch (error: any) {
      this.logger.error(`Failed to close Redis: ${error.message}`);
    }
  }
}
