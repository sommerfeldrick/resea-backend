/**
 * Semantic Cache Service
 * Caches search results with semantic similarity matching
 */

import type { EnrichedArticle } from '../../types/article.types';
import type { WorkSection } from '../../types/search.types';
import { embeddingsService } from '../embeddings.service';
import { Logger } from '../../utils/simple-logger';

interface CacheEntry {
  query: string;
  section: WorkSection;
  embedding: number[];
  results: EnrichedArticle[];
  timestamp: number;
  ttl: number; // milliseconds
}

export class SemanticCacheService {
  private cache: Map<string, CacheEntry>;
  private logger: Logger;
  private similarityThreshold: number = 0.9; // 90% similarity to match

  constructor() {
    this.cache = new Map();
    this.logger = new Logger('SemanticCache');
  }

  /**
   * Get cached results if query is semantically similar
   */
  async get(query: string, section: WorkSection): Promise<EnrichedArticle[] | null> {
    const queryEmbedding = await embeddingsService.generateEmbedding(query);

    // Find most similar cached query
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.cache.values()) {
      // Check if same section
      if (entry.section !== section) continue;

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(this.getCacheKey(entry.query, entry.section));
        continue;
      }

      // Calculate similarity
      const similarity = embeddingsService.cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestSimilarity >= this.similarityThreshold) {
      this.logger.info(
        `Cache HIT! Similarity: ${(bestSimilarity * 100).toFixed(1)}% - "${bestMatch.query}"`
      );
      return bestMatch.results;
    }

    this.logger.debug(`Cache MISS - Best similarity: ${(bestSimilarity * 100).toFixed(1)}%`);
    return null;
  }

  /**
   * Cache search results
   */
  async set(
    query: string,
    section: WorkSection,
    results: EnrichedArticle[],
    ttl: number = 3600000 // 1 hour default
  ): Promise<void> {
    const embedding = await embeddingsService.generateEmbedding(query);

    const entry: CacheEntry = {
      query,
      section,
      embedding,
      results,
      timestamp: Date.now(),
      ttl,
    };

    const key = this.getCacheKey(query, section);
    this.cache.set(key, entry);

    this.logger.info(`Cached ${results.length} results for "${query}" (${section})`);

    // Clean old entries
    this.cleanExpired();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    return {
      size: this.cache.size,
      validEntries: entries.filter(e => now - e.timestamp < e.ttl).length,
      expiredEntries: entries.filter(e => now - e.timestamp >= e.ttl).length,
      sections: [...new Set(entries.map(e => e.section))],
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, section: WorkSection): string {
    return `${section}:${query.toLowerCase().trim()}`;
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }
}
