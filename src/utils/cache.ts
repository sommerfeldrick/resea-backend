import { logger } from '../config/logger.js';
import type { CacheEntry } from '../types/index.js';

/**
 * In-memory cache implementation with TTL support
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTTL: number = 3600000) { // 1 hour default
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug('Cache miss (expired)', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttl?: number | null): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl === null ? Infinity : (ttl ?? this.defaultTTL) // null = persistent (Infinity TTL)
    };

    this.cache.set(key, entry);
    logger.debug('Cache set', {
      key,
      ttl: entry.ttl === Infinity ? 'persistent' : `${entry.ttl}ms`
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    logger.debug('Cache delete', { key });
  }

  async clear(): Promise<void> {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    let persistent = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Não remove entradas persistentes (ttl === Infinity)
      if (entry.ttl === Infinity) {
        persistent++;
        continue;
      }

      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', {
        removed,
        persistent,
        remaining: this.cache.size
      });
    }
  }

  getStats() {
    let persistent = 0;
    let expiring = 0;

    for (const entry of this.cache.values()) {
      if (entry.ttl === Infinity) {
        persistent++;
      } else {
        expiring++;
      }
    }

    return {
      size: this.cache.size,
      persistent,
      expiring,
      keys: Array.from(this.cache.keys()).slice(0, 10) // Mostra apenas 10 primeiras chaves
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/**
 * Redis cache implementation (optional)
 */
export class RedisCache {
  private client: any; // Redis client type

  constructor(client: any, private defaultTTL: number = 3600) { // 1 hour in seconds
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) {
        logger.debug('Cache miss', { key });
        return null;
      }

      logger.debug('Cache hit', { key });
      return JSON.parse(data) as T;
    } catch (error: any) {
      logger.error('Redis get error', { key, error: error.message });
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number | null): Promise<void> {
    try {
      const serialized = JSON.stringify(data);

      if (ttl === null) {
        // Set persistent data without TTL
        await this.client.set(key, serialized);
        logger.debug('Cache set (persistent)', { key });
      } else {
        // Set data with TTL
        await this.client.setex(key, ttl || this.defaultTTL, serialized);
        logger.debug('Cache set', { key, ttl: ttl || this.defaultTTL });
      }
    } catch (error: any) {
      logger.error('Redis set error', { key, error: error.message });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug('Cache delete', { key });
    } catch (error: any) {
      logger.error('Redis delete error', { key, error: error.message });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.info('Cache cleared');
    } catch (error: any) {
      logger.error('Redis clear error', { error: error.message });
    }
  }
}

/**
 * Cache factory
 */
export function createCache(redisClient?: any): MemoryCache | RedisCache {
  if (redisClient && process.env.REDIS_ENABLED === 'true') {
    logger.info('Using Redis cache');
    return new RedisCache(redisClient);
  }

  logger.info('Using in-memory cache');
  return new MemoryCache();
}

// Singleton cache instance
let cacheInstance: MemoryCache | RedisCache | null = null;

export function getCache(): MemoryCache | RedisCache {
  if (!cacheInstance) {
    cacheInstance = createCache();
  }
  return cacheInstance;
}

export function setCacheInstance(cache: MemoryCache | RedisCache): void {
  cacheInstance = cache;
}
