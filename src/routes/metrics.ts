import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics.service.js';
import { circuitBreakerService } from '../services/circuitBreaker.service.js';

const router = Router();

/**
 * GET /api/metrics
 * Expõe métricas no formato Prometheus
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', 'text/plain');
    const metrics = await metricsService.getMetrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

/**
 * GET /api/metrics/json
 * Retorna métricas em formato JSON
 */
router.get('/json', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetricsJSON();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Error collecting metrics' });
  }
});

/**
 * GET /api/metrics/circuit-breakers
 * Status dos circuit breakers
 */
router.get('/circuit-breakers', (req: Request, res: Response) => {
  try {
    const status = circuitBreakerService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Error getting circuit breaker status' });
  }
});

/**
 * POST /api/metrics/circuit-breakers/:name/open
 * Força abertura de um circuit breaker
 */
router.post('/circuit-breakers/:name/open', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    circuitBreakerService.open(name);
    res.json({ message: `Circuit breaker '${name}' opened` });
  } catch (error) {
    res.status(500).json({ error: 'Error opening circuit breaker' });
  }
});

/**
 * POST /api/metrics/circuit-breakers/:name/close
 * Força fechamento de um circuit breaker
 */
router.post('/circuit-breakers/:name/close', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    circuitBreakerService.close(name);
    res.json({ message: `Circuit breaker '${name}' closed` });
  } catch (error) {
    res.status(500).json({ error: 'Error closing circuit breaker' });
  }
});

export default router;
