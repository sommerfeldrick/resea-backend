/**
 * Serviço de Métricas com Prometheus
 * Monitora performance e uso do sistema
 */

import promClient from 'prom-client';
const { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } = promClient;

export class MetricsService {
  private register: promClient.Registry;

  // Contadores
  public searchesTotal: promClient.Counter;
  public extractionsTotal: promClient.Counter;
  public indexingTotal: promClient.Counter;
  public errorsTotal: promClient.Counter;

  // Histogramas (latência)
  public searchDuration: promClient.Histogram;
  public extractionDuration: promClient.Histogram;
  public indexingDuration: promClient.Histogram;
  public rerankDuration: promClient.Histogram;

  // Gauges (estado atual)
  public indexedPapers: promClient.Gauge;
  public cacheSize: promClient.Gauge;
  public activeRequests: promClient.Gauge;

  constructor() {
    this.register = new Registry();
    
    // Métricas padrão do Node.js
    collectDefaultMetrics({ register: this.register });

    // === CONTADORES ===
    
    this.searchesTotal = new Counter({
      name: 'resea_searches_total',
      help: 'Total de buscas realizadas',
      labelNames: ['method', 'status'], // method: hybrid/vector/bm25, status: success/error
      registers: [this.register],
    });

    this.extractionsTotal = new Counter({
      name: 'resea_extractions_total',
      help: 'Total de extrações de texto completo',
      labelNames: ['method', 'status'], // method: grobid/pdf-parse, status: success/error
      registers: [this.register],
    });

    this.indexingTotal = new Counter({
      name: 'resea_indexing_total',
      help: 'Total de papers indexados',
      labelNames: ['status'], // status: success/error
      registers: [this.register],
    });

    this.errorsTotal = new Counter({
      name: 'resea_errors_total',
      help: 'Total de erros do sistema',
      labelNames: ['service', 'error_type'], // service: grobid/qdrant/etc
      registers: [this.register],
    });

    // === HISTOGRAMAS (Latência) ===

    this.searchDuration = new Histogram({
      name: 'resea_search_duration_seconds',
      help: 'Duração das buscas em segundos',
      labelNames: ['method'], // method: hybrid/vector/bm25
      buckets: [0.1, 0.5, 1, 2, 5, 10], // Buckets em segundos
      registers: [this.register],
    });

    this.extractionDuration = new Histogram({
      name: 'resea_extraction_duration_seconds',
      help: 'Duração das extrações em segundos',
      labelNames: ['method'], // method: grobid/pdf-parse
      buckets: [1, 5, 10, 30, 60, 120], // Buckets em segundos
      registers: [this.register],
    });

    this.indexingDuration = new Histogram({
      name: 'resea_indexing_duration_seconds',
      help: 'Duração da indexação em segundos',
      buckets: [0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.rerankDuration = new Histogram({
      name: 'resea_rerank_duration_seconds',
      help: 'Duração do reranking em segundos',
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // === GAUGES (Estado) ===

    this.indexedPapers = new Gauge({
      name: 'resea_indexed_papers',
      help: 'Número total de papers indexados',
      registers: [this.register],
    });

    this.cacheSize = new Gauge({
      name: 'resea_cache_size_bytes',
      help: 'Tamanho do cache em bytes',
      labelNames: ['cache_type'], // cache_type: embeddings/results
      registers: [this.register],
    });

    this.activeRequests = new Gauge({
      name: 'resea_active_requests',
      help: 'Número de requisições ativas',
      labelNames: ['type'], // type: search/extract/index
      registers: [this.register],
    });
  }

  /**
   * Retorna métricas em formato Prometheus
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Retorna métricas em formato JSON
   */
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Registra uma busca
   */
  recordSearch(method: 'hybrid' | 'vector' | 'bm25', durationSeconds: number, success: boolean = true) {
    this.searchesTotal.inc({
      method,
      status: success ? 'success' : 'error',
    });
    this.searchDuration.observe({ method }, durationSeconds);
  }

  /**
   * Registra uma extração
   */
  recordExtraction(method: 'grobid' | 'pdf-parse', durationSeconds: number, success: boolean = true) {
    this.extractionsTotal.inc({
      method,
      status: success ? 'success' : 'error',
    });
    this.extractionDuration.observe({ method }, durationSeconds);
  }

  /**
   * Registra indexação
   */
  recordIndexing(durationSeconds: number, success: boolean = true) {
    this.indexingTotal.inc({
      status: success ? 'success' : 'error',
    });
    this.indexingDuration.observe(durationSeconds);
  }

  /**
   * Registra reranking
   */
  recordRerank(durationSeconds: number) {
    this.rerankDuration.observe(durationSeconds);
  }

  /**
   * Registra erro
   */
  recordError(service: string, errorType: string) {
    this.errorsTotal.inc({
      service,
      error_type: errorType,
    });
  }

  /**
   * Atualiza número de papers indexados
   */
  setIndexedPapersCount(count: number) {
    this.indexedPapers.set(count);
  }

  /**
   * Atualiza tamanho do cache
   */
  setCacheSize(cacheType: string, sizeBytes: number) {
    this.cacheSize.set({ cache_type: cacheType }, sizeBytes);
  }

  /**
   * Incrementa requisições ativas
   */
  incrementActiveRequests(type: string) {
    this.activeRequests.inc({ type });
  }

  /**
   * Decrementa requisições ativas
   */
  decrementActiveRequests(type: string) {
    this.activeRequests.dec({ type });
  }

  /**
   * Reseta todas as métricas
   */
  reset() {
    this.register.resetMetrics();
  }

  /**
   * Retorna registro para uso customizado
   */
  getRegister(): promClient.Registry {
    return this.register;
  }
}

// Singleton export
export const metricsService = new MetricsService();

/**
 * Helper para medir duração de operações
 */
export function measureDuration<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationSeconds: number }> {
  const start = Date.now();
  
  return fn().then(result => {
    const durationSeconds = (Date.now() - start) / 1000;
    return { result, durationSeconds };
  });
}

/**
 * Decorator para medir tempo automaticamente
 */
export function Measure(metricName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = (Date.now() - start) / 1000;
        console.log(`⏱️ ${metricName}: ${duration.toFixed(2)}s`);
        return result;
      } catch (error) {
        const duration = (Date.now() - start) / 1000;
        console.error(`❌ ${metricName} failed after ${duration.toFixed(2)}s`);
        throw error;
      }
    };

    return descriptor;
  };
}
