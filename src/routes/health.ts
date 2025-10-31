import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { AIStrategyRouter } from '../services/ai/AIStrategyRouter.js';
import { incrementalIndexingService } from '../services/incrementalIndexing.service.js';
import { embeddingsService } from '../services/embeddings.service.js';
import { academicSearchService } from '../services/academicSearchService.js';
import { creditsService } from '../services/creditsService.js';
import { circuitBreakerService } from '../services/circuitBreaker.service.js';
import { pool } from '../config/database.js';
import { QdrantClient } from '@qdrant/js-client-rest';

const router = Router();

/**
 * GET /api/health
 * Complete health check endpoint with all services
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Parallel health checks
    const [
      aiHealth,
      databaseHealth,
      redisHealth,
      qdrantHealth,
      indexingHealth
    ] = await Promise.allSettled([
      checkAIProviders(),
      checkDatabase(),
      checkRedis(),
      checkQdrant(),
      checkIncrementalIndexing()
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      services: {
        aiProviders: aiHealth.status === 'fulfilled' ? aiHealth.value : { error: (aiHealth as any).reason?.message },
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { available: false, error: (databaseHealth as any).reason?.message },
        redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { available: false, error: (redisHealth as any).reason?.message },
        qdrant: qdrantHealth.status === 'fulfilled' ? qdrantHealth.value : { available: false, error: (qdrantHealth as any).reason?.message },
        incrementalIndexing: indexingHealth.status === 'fulfilled' ? indexingHealth.value : { error: (indexingHealth as any).reason?.message }
      },
      resources: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      stats: {
        embeddings: embeddingsService.getCacheStats(),
        academicSearch: academicSearchService.getUsageStats(),
        circuitBreakers: circuitBreakerService.getStatus()
      }
    };

    // Determine overall health
    const allHealthy = [
      aiHealth.status === 'fulfilled',
      databaseHealth.status === 'fulfilled' && (databaseHealth.value as any).available,
      qdrantHealth.status === 'fulfilled' && (qdrantHealth.value as any).available
    ].every(Boolean);

    health.status = allHealthy ? 'healthy' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;

    logger.info('Health check completed', {
      status: health.status,
      responseTime: health.responseTime
    });

    res.status(statusCode).json(health);
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/health/ai
 * Detailed AI providers health
 */
router.get('/ai', async (req: Request, res: Response) => {
  try {
    const health = await AIStrategyRouter.getHealth();
    const stats = AIStrategyRouter.getStats();

    res.json({
      success: true,
      health,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health/database
 * Database health check
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabase();
    res.json({
      success: true,
      ...dbHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      available: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health/indexing
 * Incremental indexing status
 */
router.get('/indexing', async (req: Request, res: Response) => {
  try {
    const status = incrementalIndexingService.getStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// Helper Functions
// ============================================================

async function checkAIProviders() {
  const health = await AIStrategyRouter.getHealth();
  const availableCount = Object.values(health).filter((p: any) => p.available).length;

  return {
    available: availableCount > 0,
    providers: health,
    availableCount,
    totalCount: Object.keys(health).length
  };
}

async function checkDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    return {
      available: true,
      type: 'postgresql',
      connectionPool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error: any) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function checkRedis() {
  try {
    // Try to get a test key
    const testKey = '__health_check__';
    await creditsService.connect();

    return {
      available: true,
      type: 'redis'
    };
  } catch (error: any) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function checkQdrant() {
  try {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey
    });

    const collections = await client.getCollections();

    return {
      available: true,
      type: 'qdrant',
      url: qdrantUrl,
      collections: collections.collections.length
    };
  } catch (error: any) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function checkIncrementalIndexing() {
  const status = incrementalIndexingService.getStatus();

  return {
    available: true,
    isRunning: status.isRunning,
    lastSync: status.lastSync,
    nextSync: status.nextSync,
    papersIndexed: status.papersIndexed,
    totalSyncs: status.totalSyncs,
    lastError: status.lastError
  };
}

export default router;
