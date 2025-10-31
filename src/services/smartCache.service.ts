/**
 * Smart Cache Service v2.0
 * Multi-layer caching: Memory (L1) + Redis (L2) + Semantic Cache
 * Uses redis v4 (modern API with full TypeScript support)
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../config/logger.js';
import { embeddingsService } from './embeddings.service.js';

interface CacheEntry<T> {
  value: T;
  expiry: number;
  hits: number;
  embedding?: number[];
}

interface CacheStats {
  l1: {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryMB: number;
  };
  l2: {
    connected: boolean;
    hits: number;
    misses: number;
  };
  semantic: {
    enabled: boolean;
    threshold: number;
  };
}

export class SmartCache {
  private localCache: Map<string, CacheEntry<any>>;
  private redisClient: RedisClientType | null = null;
  private maxLocalCacheSize: number = 1000;
  private redisConnected: boolean = false;

  // Semantic cache
  private semanticCacheEnabled: boolean = true;
  private semanticThreshold: number = 0.85; // 85% similarity
  private embeddingCache: Map<string, { embedding: number[]; keys: string[] }> = new Map();

  // Stats
  private stats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    semanticHits: 0
  };

  constructor() {
    this.localCache = new Map();
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection (optional)
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        logger.warn('REDIS_URL not configured - using memory cache only');
        return;
      }

      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis: Max reconnection attempts reached');
              return new Error('Redis unavailable');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.redisConnected = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('✅ Redis connected');
        this.redisConnected = true;
      });

      this.redisClient.on('ready', () => {
        logger.info('✅ Redis ready');
        this.redisConnected = true;
      });

      await this.redisClient.connect();

    } catch (error) {
      logger.warn('Redis connection failed, using memory cache only:', error);
      this.redisClient = null;
      this.redisConnected = false;
    }
  }

  /**
   * L1 (Memory) + L2 (Redis) Cache Get
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: Check memory cache
    const l1Entry = this.localCache.get(key);
    if (l1Entry && Date.now() < l1Entry.expiry) {
      this.stats.l1Hits++;
      l1Entry.hits++;
      return l1Entry.value as T;
    } else if (l1Entry) {
      this.localCache.delete(key);
    }
    this.stats.l1Misses++;

    // L2: Check Redis
    if (this.redisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (data) {
          this.stats.l2Hits++;
          const parsed = JSON.parse(data) as T;

          // Promote to L1
          this.setLocal(key, parsed, 3600); // 1 hour in L1

          return parsed;
        }
        this.stats.l2Misses++;
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }

    return null;
  }

  /**
   * Set with TTL (both L1 and L2)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    // L1: Memory cache
    this.setLocal(key, value, ttlSeconds);

    // L2: Redis cache
    if (this.redisConnected && this.redisClient) {
      try {
        await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      } catch (error) {
        logger.error('Redis set error:', error);
      }
    }
  }

  /**
   * L1 (Memory only) set
   */
  private setLocal<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.localCache.size >= this.maxLocalCacheSize) {
      // LRU eviction: remove least recently used (lowest hits)
      let minHits = Infinity;
      let lruKey = '';

      for (const [k, entry] of this.localCache.entries()) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          lruKey = k;
        }
      }

      if (lruKey) {
        this.localCache.delete(lruKey);
      }
    }

    this.localCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
      hits: 0
    });
  }

  /**
   * Semantic cache: Find similar queries using embeddings
   */
  async getSemanticSimilar<T>(query: string): Promise<T | null> {
    if (!this.semanticCacheEnabled) return null;

    try {
      // Generate embedding for query
      const queryEmbedding = await embeddingsService.generateEmbedding(query);

      // Find most similar cached query
      let maxSimilarity = 0;
      let bestKey = '';

      for (const [cachedQuery, { embedding }] of this.embeddingCache.entries()) {
        const similarity = embeddingsService.cosineSimilarity(queryEmbedding, embedding);

        if (similarity > maxSimilarity && similarity >= this.semanticThreshold) {
          maxSimilarity = similarity;
          bestKey = cachedQuery;
        }
      }

      if (bestKey) {
        this.stats.semanticHits++;
        logger.info(`Semantic cache hit (${(maxSimilarity * 100).toFixed(1)}% similar)`, {
          original: bestKey.substring(0, 50),
          query: query.substring(0, 50)
        });

        return await this.get<T>(bestKey);
      }

      return null;
    } catch (error) {
      logger.error('Semantic cache error:', error);
      return null;
    }
  }

  /**
   * Set with semantic indexing
   */
  async setWithSemantic<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    await this.set(key, value, ttlSeconds);

    // Index embedding for semantic search
    if (this.semanticCacheEnabled) {
      try {
        const embedding = await embeddingsService.generateEmbedding(key);
        this.embeddingCache.set(key, {
          embedding,
          keys: [key]
        });

        // Limit semantic cache size
        if (this.embeddingCache.size > 100) {
          const firstKey = this.embeddingCache.keys().next().value;
          this.embeddingCache.delete(firstKey);
        }
      } catch (error) {
        logger.error('Semantic indexing error:', error);
      }
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    this.localCache.delete(key);
    this.embeddingCache.delete(key);

    if (this.redisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        logger.error('Redis delete error:', error);
      }
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.localCache.clear();
    this.embeddingCache.clear();

    if (this.redisConnected && this.redisClient) {
      try {
        await this.redisClient.flushDb();
        logger.info('Redis cache cleared');
      } catch (error) {
        logger.error('Redis clear error:', error);
      }
    }
  }

  /**
   * Pattern-based deletion (e.g., "user:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    let deleted = 0;

    // L1: Delete matching keys
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key);
        deleted++;
      }
    }

    // L2: Redis SCAN + DELETE
    if (this.redisConnected && this.redisClient) {
      try {
        const keys: string[] = [];
        for await (const key of this.redisClient.scanIterator({ MATCH: pattern })) {
          keys.push(key);
        }

        if (keys.length > 0) {
          await this.redisClient.del(keys);
          deleted += keys.length;
        }
      } catch (error) {
        logger.error('Redis pattern delete error:', error);
      }
    }

    return deleted;
  }

  /**
   * Calculate intelligent TTL based on data characteristics
   */
  calculateTTL(data: any): number {
    // Default: 1 hour
    let ttl = 3600;

    // Strings/small data: shorter TTL
    if (typeof data === 'string' && data.length < 100) {
      ttl = 1800; // 30 minutes
    }

    // Large objects: longer TTL (expensive to regenerate)
    const size = JSON.stringify(data).length;
    if (size > 10000) {
      ttl = 7200; // 2 hours
    }

    // Arrays with many items: longer TTL
    if (Array.isArray(data) && data.length > 50) {
      ttl = 10800; // 3 hours
    }

    return ttl;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const l1TotalRequests = this.stats.l1Hits + this.stats.l1Misses;
    const l1HitRate = l1TotalRequests > 0
      ? (this.stats.l1Hits / l1TotalRequests) * 100
      : 0;

    // Estimate L1 memory usage
    let memoryBytes = 0;
    for (const entry of this.localCache.values()) {
      memoryBytes += JSON.stringify(entry.value).length * 2; // UTF-16
    }

    return {
      l1: {
        size: this.localCache.size,
        maxSize: this.maxLocalCacheSize,
        hitRate: parseFloat(l1HitRate.toFixed(2)),
        memoryMB: parseFloat((memoryBytes / (1024 * 1024)).toFixed(2))
      },
      l2: {
        connected: this.redisConnected,
        hits: this.stats.l2Hits,
        misses: this.stats.l2Misses
      },
      semantic: {
        enabled: this.semanticCacheEnabled,
        threshold: this.semanticThreshold
      }
    };
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Redis disconnected gracefully');
      } catch (error) {
        logger.error('Redis disconnect error:', error);
      }
    }
  }

  // Compatibility methods for old API
  async setRedisCache<T>(key: string, value: T, ttl: number): Promise<void> {
    return this.set(key, value, ttl);
  }

  async getRedisCache<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }
}

// Singleton export
export const smartCache = new SmartCache();
export default SmartCache;
