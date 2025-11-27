/**
 * Journal Metrics Queue Service
 *
 * Manages asynchronous processing of journal metrics lookups using BullMQ
 * - Prevents rate limiting (429 errors)
 * - Enables Redis-based caching (persistent across instances)
 * - Supports multiple concurrent users
 * - Provides real-time progress updates
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../../config/logger.js';
import axios, { AxiosInstance } from 'axios';

// ============================================
// TYPES
// ============================================

interface JournalMetrics {
  journalName: string;
  qualityScore: number;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  hIndex: number;
  twoYearCitedness: number;
  subjectAreas: string[];
  source: 'OpenAlex' | 'Cache';
}

interface JournalLookupJob {
  journalName: string;
  requestId: string;  // Para agrupar requisições do mesmo usuário
}

interface OpenAlexSource {
  display_name: string;
  summary_stats?: {
    h_index?: number;
    '2yr_mean_citedness'?: number;
  };
  x_concepts?: Array<{
    display_name: string;
    level: number;
    score: number;
  }>;
}

// ============================================
// REDIS CONNECTION
// ============================================

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// ============================================
// QUEUE SETUP
// ============================================

export const journalMetricsQueue = new Queue<JournalLookupJob>('journal-metrics', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,  // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,  // Start with 2s delay, then 4s, then 8s
    },
    removeOnComplete: 100,  // Keep last 100 completed jobs
    removeOnFail: 500,      // Keep last 500 failed jobs for debugging
  },
});

// ============================================
// REDIS CACHE (Persistent)
// ============================================

const CACHE_PREFIX = 'journal:';
const CACHE_TTL = 30 * 24 * 60 * 60;  // 30 days in seconds

/**
 * Get journal metrics from Redis cache
 */
async function getFromCache(journalName: string): Promise<JournalMetrics | null> {
  try {
    const key = `${CACHE_PREFIX}${journalName.toLowerCase()}`;
    const cached = await redisConnection.get(key);

    if (cached) {
      const metrics: JournalMetrics = JSON.parse(cached);
      logger.debug(`Cache HIT: ${journalName}`);
      return { ...metrics, source: 'Cache' };
    }

    return null;
  } catch (error: any) {
    logger.warn(`Cache read error for ${journalName}: ${error.message}`);
    return null;
  }
}

/**
 * Save journal metrics to Redis cache
 */
async function saveToCache(journalName: string, metrics: JournalMetrics): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${journalName.toLowerCase()}`;
    await redisConnection.setex(key, CACHE_TTL, JSON.stringify(metrics));
    logger.debug(`Cache SAVE: ${journalName}`);
  } catch (error: any) {
    logger.warn(`Cache write error for ${journalName}: ${error.message}`);
  }
}

// ============================================
// WORKER SETUP
// ============================================

const openAlexClient: AxiosInstance = axios.create({
  baseURL: 'https://api.openalex.org',
  timeout: 30000,
  headers: {
    'User-Agent': `RESEA-JournalMetrics/1.0 (mailto:${process.env.UNPAYWALL_EMAIL || 'contato@smileai.com.br'})`,
  },
});

/**
 * Calculate journal quality score (0-100)
 */
function calculateQualityScore(hIndex: number, twoYearCitedness: number): number {
  // H-index component (0-70 points)
  let hScore = 0;
  if (hIndex >= 100) {
    hScore = 70;
  } else if (hIndex >= 50) {
    hScore = 50 + ((hIndex - 50) / 50) * 20;
  } else if (hIndex >= 20) {
    hScore = 30 + ((hIndex - 20) / 30) * 20;
  } else {
    hScore = (hIndex / 20) * 30;
  }

  // 2-year citedness component (0-30 points)
  let citednessScore = 0;
  if (twoYearCitedness >= 5.0) {
    citednessScore = 30;
  } else if (twoYearCitedness >= 2.0) {
    citednessScore = 15 + ((twoYearCitedness - 2.0) / 3.0) * 15;
  } else {
    citednessScore = (twoYearCitedness / 2.0) * 15;
  }

  return Math.round(hScore + citednessScore);
}

/**
 * Calculate quartile from quality score
 */
function calculateQuartile(qualityScore: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null {
  if (qualityScore >= 75) return 'Q1';
  if (qualityScore >= 50) return 'Q2';
  if (qualityScore >= 25) return 'Q3';
  if (qualityScore > 0) return 'Q4';
  return null;
}

/**
 * Parse OpenAlex source to JournalMetrics
 */
function parseSource(source: OpenAlexSource): JournalMetrics {
  const stats = source.summary_stats || {};
  const hIndex = stats.h_index || 0;
  const twoYearCitedness = stats['2yr_mean_citedness'] || 0;

  const qualityScore = calculateQualityScore(hIndex, twoYearCitedness);
  const quartile = calculateQuartile(qualityScore);

  const subjectAreas = (source.x_concepts || [])
    .filter(c => c.level === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.display_name);

  return {
    journalName: source.display_name,
    qualityScore,
    quartile,
    hIndex,
    twoYearCitedness,
    subjectAreas,
    source: 'OpenAlex',
  };
}

/**
 * Fetch journal metrics from OpenAlex API
 */
async function fetchFromOpenAlex(journalName: string): Promise<JournalMetrics | null> {
  try {
    // Add delay to respect rate limits (150ms = ~6 req/s)
    await new Promise(resolve => setTimeout(resolve, 150));

    const response = await openAlexClient.get('/sources', {
      params: {
        search: journalName,
        per_page: 1,
      },
    });

    const sources: OpenAlexSource[] = response.data?.results || [];

    if (sources.length === 0) {
      logger.debug(`Journal not found in OpenAlex: ${journalName}`);
      return null;
    }

    return parseSource(sources[0]);
  } catch (error: any) {
    logger.warn(`OpenAlex lookup failed for "${journalName}": ${error.message}`);
    throw error;  // Let BullMQ retry
  }
}

/**
 * Worker processor function
 */
async function processJournalLookup(job: Job<JournalLookupJob>): Promise<JournalMetrics | null> {
  const { journalName, requestId } = job.data;

  logger.debug(`Processing journal lookup: ${journalName} (request: ${requestId})`);

  // Try cache first
  const cached = await getFromCache(journalName);
  if (cached) {
    return cached;
  }

  // Fetch from OpenAlex
  const metrics = await fetchFromOpenAlex(journalName);

  // Save to cache if found
  if (metrics) {
    await saveToCache(journalName, metrics);
  }

  return metrics;
}

// Create worker
export const journalMetricsWorker = new Worker<JournalLookupJob, JournalMetrics | null>(
  'journal-metrics',
  processJournalLookup,
  {
    connection: redisConnection,
    concurrency: 1,  // Process one at a time to respect rate limits
    limiter: {
      max: 6,        // Max 6 jobs
      duration: 1000, // Per second (6 req/s to stay under 10 req/s limit)
    },
  }
);

// Worker event handlers
journalMetricsWorker.on('completed', (job) => {
  logger.debug(`Job ${job.id} completed: ${job.data.journalName}`);
});

journalMetricsWorker.on('failed', (job, err) => {
  logger.warn(`Job ${job?.id} failed: ${job?.data.journalName} - ${err.message}`);
});

journalMetricsWorker.on('error', (err) => {
  logger.error(`Worker error: ${err.message}`);
});

logger.info('✅ Journal Metrics Queue & Worker initialized (Redis-backed, 6 req/s limit)');

// ============================================
// PUBLIC API
// ============================================

/**
 * Add journal lookups to queue (batch)
 */
export async function queueJournalLookups(
  journalNames: string[],
  requestId: string
): Promise<void> {
  const jobs = journalNames.map(name => ({
    name: `lookup-${name}`,
    data: { journalName: name, requestId },
  }));

  await journalMetricsQueue.addBulk(jobs);

  logger.info(`Queued ${jobs.length} journal lookups for request ${requestId}`);
}

/**
 * Get results for a request (non-blocking)
 */
export async function getJournalMetricsResults(
  journalNames: string[],
  requestId: string
): Promise<Map<string, JournalMetrics>> {
  const results = new Map<string, JournalMetrics>();

  for (const name of journalNames) {
    const metrics = await getFromCache(name);
    if (metrics) {
      results.set(name, metrics);
    }
  }

  return results;
}

/**
 * Get queue progress for a request
 */
export async function getQueueProgress(requestId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  active: number;
}> {
  const jobs = await journalMetricsQueue.getJobs(['active', 'waiting', 'completed', 'failed']);

  const requestJobs = jobs.filter(job => job.data.requestId === requestId);

  return {
    total: requestJobs.length,
    completed: requestJobs.filter(j => j.isCompleted()).length,
    failed: requestJobs.filter(j => j.isFailed()).length,
    active: requestJobs.filter(j => j.isActive()).length,
  };
}
