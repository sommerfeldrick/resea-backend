/**
 * Journal Metrics Service
 *
 * Provides journal quality metrics for article scoring:
 * - Journal Quality Score (0-100) - based on h-index and citation metrics
 * - Quartile (Q1, Q2, Q3, Q4) - calculated from percentile ranking
 * - Subject Areas - primary research areas
 *
 * Data source: OpenAlex Venues API
 * https://docs.openalex.org/api-entities/venues
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/simple-logger.js';
import pLimit from 'p-limit';

const logger = new Logger('JournalMetrics');

interface OpenAlexVenue {
  id: string;
  display_name: string;
  issn_l?: string;
  issn?: string[];
  summary_stats?: {
    '2yr_mean_citedness'?: number;
    h_index?: number;
    i10_index?: number;
  };
  x_concepts?: Array<{
    display_name: string;
    level: number;
    score: number;
  }>;
  works_count?: number;
  cited_by_count?: number;
}

export interface JournalMetrics {
  journalName: string;
  qualityScore: number;  // 0-100 based on h-index and citation metrics
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  hIndex: number;
  twoYearCitedness: number;  // Average citations per paper (2yr window)
  subjectAreas: string[];
  source: 'OpenAlex' | 'Cache';
}

export class JournalMetricsService {
  private client: AxiosInstance;
  private cache: Map<string, JournalMetrics>;
  private cacheExpiry: Map<string, number>;
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private rateLimiter: ReturnType<typeof pLimit>;  // Rate limiter: 8 concurrent requests (safe for 10 req/s limit)

  constructor() {
    const email = process.env.OPENALEX_EMAIL || process.env.UNPAYWALL_EMAIL || 'contato@smileai.com.br';

    this.client = axios.create({
      baseURL: 'https://api.openalex.org',
      timeout: 30000,  // Increased from 10s to 30s to handle high load
      headers: {
        'User-Agent': `RESEA-JournalMetrics/1.0 (mailto:${email})`,
      },
    });

    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.rateLimiter = pLimit(1);  // VERY SAFE: 1 concurrent (sequential) - prevents all rate limit errors

    logger.info('✅ Journal Metrics Service initialized with rate limiting (1 concurrent - sequential mode)');
  }

  /**
   * Get journal metrics by journal name
   */
  async getMetricsByJournalName(journalName: string): Promise<JournalMetrics | null> {
    if (!journalName) {
      return null;
    }

    // Normalize journal name (lowercase, trim) to improve cache hits
    const normalizedName = journalName.trim().toLowerCase();

    // Check cache (immediate, no rate limiting needed)
    const cached = this.getFromCache(normalizedName);
    if (cached) {
      logger.debug(`Cache HIT: ${journalName}`);
      return cached;
    }

    // 🔥 FIX: Wrap API call in rate limiter to prevent overwhelming OpenAlex
    // When scoring thousands of articles in parallel, this prevents 100+ simultaneous requests
    return this.rateLimiter(async () => {
      try {
        logger.debug(`Looking up journal: ${journalName}`);

        // Add minimum delay between requests to prevent burst (150ms = ~6 req/s max, very safe)
        await new Promise(resolve => setTimeout(resolve, 150));

        // Search for source by name (OpenAlex renamed /venues to /sources)
        const response = await this.client.get('/sources', {
          params: {
            search: journalName,
            per_page: 1,
          },
        });

        const sources: OpenAlexVenue[] = response.data?.results || [];

        if (sources.length === 0) {
          logger.debug(`Journal not found: ${journalName}`);
          return null;
        }

        const source = sources[0];
        const metrics = this.parseVenue(source);

        // Cache result (using normalized name)
        this.saveToCache(normalizedName, metrics);

        return metrics;
      } catch (error: any) {
        logger.warn(`Failed to fetch journal metrics for "${journalName}": ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Get journal metrics by ISSN
   */
  async getMetricsByISSN(issn: string): Promise<JournalMetrics | null> {
    if (!issn) {
      return null;
    }

    const cacheKey = `issn:${issn}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 🔥 FIX: Wrap API call in rate limiter (same as getMetricsByJournalName)
    return this.rateLimiter(async () => {
      try {
        logger.debug(`Looking up journal by ISSN: ${issn}`);

        // Add minimum delay between requests to prevent burst (150ms = ~6 req/s max, very safe)
        await new Promise(resolve => setTimeout(resolve, 150));

        // Search by ISSN (OpenAlex renamed /venues to /sources)
        const response = await this.client.get('/sources', {
          params: {
            filter: `issn:${issn}`,
          },
        });

        const sources: OpenAlexVenue[] = response.data?.results || [];

        if (sources.length === 0) {
          return null;
        }

        const metrics = this.parseVenue(sources[0]);
        this.saveToCache(cacheKey, metrics);

        return metrics;
      } catch (error: any) {
        logger.warn(`Failed to fetch journal metrics by ISSN "${issn}": ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Batch lookup multiple journals with rate limiting
   *
   * Processes journals in controlled batches to respect OpenAlex API limits (10 req/s)
   */
  async getBatch(journalNames: string[]): Promise<Map<string, JournalMetrics>> {
    const results = new Map<string, JournalMetrics>();
    const startTime = Date.now();

    logger.info(`🔍 Starting batch lookup for ${journalNames.length} journals (sequential mode - 1 req every 150ms)`);

    // Use rate limiter to control concurrency
    const promises = journalNames.map((name) =>
      this.rateLimiter(async () => {
        try {
          const metrics = await this.getMetricsByJournalName(name);
          if (metrics) {
            results.set(name, metrics);
          }
        } catch (error: any) {
          logger.debug(`Failed to fetch metrics for "${name}": ${error.message}`);
        }
      })
    );

    await Promise.allSettled(promises);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const cached = Array.from(results.values()).filter(m => m.source === 'Cache').length;
    const fetched = results.size - cached;

    logger.info(
      `✅ Batch lookup complete: ${results.size}/${journalNames.length} found ` +
      `(${cached} cached, ${fetched} fetched) in ${elapsed}s`
    );

    return results;
  }

  /**
   * Parse OpenAlex venue to JournalMetrics
   */
  private parseVenue(venue: OpenAlexVenue): JournalMetrics {
    const stats = venue.summary_stats || {};
    const hIndex = stats.h_index || 0;
    const twoYearCitedness = stats['2yr_mean_citedness'] || 0;

    // Calculate quality score (0-100)
    // Based on h-index and 2-year citedness
    const qualityScore = this.calculateQualityScore(hIndex, twoYearCitedness);

    // Determine quartile based on quality score
    const quartile = this.calculateQuartile(qualityScore);

    // Extract subject areas (top 3 by score)
    const subjectAreas = (venue.x_concepts || [])
      .filter(c => c.level === 0) // Only top-level concepts
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.display_name);

    return {
      journalName: venue.display_name,
      qualityScore,
      quartile,
      hIndex,
      twoYearCitedness,
      subjectAreas,
      source: 'OpenAlex',
    };
  }

  /**
   * Calculate journal quality score (0-100)
   *
   * Formula:
   * - h-index component (70%): normalized to 0-70 scale
   *   - h >= 100 → 70 pts (top journals like Nature, Science)
   *   - h >= 50 → 50-70 pts (high-impact journals)
   *   - h >= 20 → 30-50 pts (solid journals)
   *   - h < 20 → 0-30 pts (emerging/niche journals)
   *
   * - 2-year citedness component (30%): normalized to 0-30 scale
   *   - citedness >= 5.0 → 30 pts (highly cited)
   *   - citedness >= 2.0 → 15-30 pts (well cited)
   *   - citedness < 2.0 → 0-15 pts (moderately cited)
   */
  private calculateQualityScore(hIndex: number, twoYearCitedness: number): number {
    // H-index component (0-70 points)
    let hScore = 0;
    if (hIndex >= 100) {
      hScore = 70; // Nature, Science, Cell, etc.
    } else if (hIndex >= 50) {
      hScore = 50 + ((hIndex - 50) / 50) * 20; // 50-70 pts
    } else if (hIndex >= 20) {
      hScore = 30 + ((hIndex - 20) / 30) * 20; // 30-50 pts
    } else {
      hScore = (hIndex / 20) * 30; // 0-30 pts
    }

    // 2-year citedness component (0-30 points)
    let citednessScore = 0;
    if (twoYearCitedness >= 5.0) {
      citednessScore = 30;
    } else if (twoYearCitedness >= 2.0) {
      citednessScore = 15 + ((twoYearCitedness - 2.0) / 3.0) * 15; // 15-30 pts
    } else {
      citednessScore = (twoYearCitedness / 2.0) * 15; // 0-15 pts
    }

    const total = Math.min(100, Math.round(hScore + citednessScore));

    logger.debug(
      `Quality Score: ${total} (h-index: ${hIndex} → ${hScore.toFixed(1)}, ` +
      `citedness: ${twoYearCitedness.toFixed(2)} → ${citednessScore.toFixed(1)})`
    );

    return total;
  }

  /**
   * Calculate quartile from quality score
   *
   * Q1 (top 25%): score >= 70
   * Q2 (25-50%): score 50-69
   * Q3 (50-75%): score 30-49
   * Q4 (bottom 25%): score < 30
   */
  private calculateQuartile(qualityScore: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
    if (qualityScore >= 70) return 'Q1';
    if (qualityScore >= 50) return 'Q2';
    if (qualityScore >= 30) return 'Q3';
    return 'Q4';
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): JournalMetrics | null {
    const cached = this.cache.get(key.toLowerCase());
    const expiry = this.cacheExpiry.get(key.toLowerCase());

    if (cached && expiry && Date.now() < expiry) {
      return { ...cached, source: 'Cache' };
    }

    // Expired or not found
    this.cache.delete(key.toLowerCase());
    this.cacheExpiry.delete(key.toLowerCase());
    return null;
  }

  /**
   * Save to cache
   */
  private saveToCache(key: string, metrics: JournalMetrics): void {
    this.cache.set(key.toLowerCase(), metrics);
    this.cacheExpiry.set(key.toLowerCase(), Date.now() + this.CACHE_TTL);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL,
    };
  }
}

// Singleton instance
export const journalMetricsService = new JournalMetricsService();
