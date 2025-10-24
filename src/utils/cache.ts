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

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, entry);
    logger.debug('Cache set', { key, ttl: entry.ttl });
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

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', { removed, remaining: this.cache.size });
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
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

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await this.client.setex(key, ttl || this.defaultTTL, serialized);
      logger.debug('Cache set', { key, ttl: ttl || this.defaultTTL });
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
