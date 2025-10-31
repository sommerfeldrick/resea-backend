/**
 * Serviço de Circuit Breakers para resiliência
 * Protege contra falhas em cascata de serviços externos
 */

import CircuitBreaker from 'opossum';

export interface CircuitBreakerConfig {
  timeout: number;           // Timeout em ms
  errorThresholdPercentage: number; // % de erros para abrir circuito
  resetTimeout: number;      // Tempo para tentar fechar circuito
  rollingCountTimeout: number; // Janela de análise
  volumeThreshold: number;   // Mínimo de chamadas para análise
}

export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig = {
    timeout: 10000, // 10s
    errorThresholdPercentage: 50, // 50% de erro
    resetTimeout: 30000, // 30s
    rollingCountTimeout: 10000, // 10s de janela
    volumeThreshold: 10, // Mínimo 10 chamadas
  };

  /**
   * Cria ou retorna circuit breaker existente
   */
  getBreaker<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker<any[], T> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    
    const breaker = new CircuitBreaker(fn, {
      timeout: finalConfig.timeout,
      errorThresholdPercentage: finalConfig.errorThresholdPercentage,
      resetTimeout: finalConfig.resetTimeout,
      rollingCountTimeout: finalConfig.rollingCountTimeout,
      volumeThreshold: finalConfig.volumeThreshold,
    });

    // Event listeners para monitoring
    breaker.on('open', () => {
      console.warn(`🔴 Circuit breaker OPENED: ${name}`);
    });

    breaker.on('halfOpen', () => {
      console.log(`🟡 Circuit breaker HALF-OPEN: ${name}`);
    });

    breaker.on('close', () => {
      console.log(`🟢 Circuit breaker CLOSED: ${name}`);
    });

    breaker.on('timeout', () => {
      console.warn(`⏱️ Circuit breaker TIMEOUT: ${name}`);
    });

    breaker.on('failure', (error) => {
      console.error(`❌ Circuit breaker FAILURE in ${name}:`, error.message);
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Executa função protegida por circuit breaker
   */
  async execute<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    fallback?: (...args: any[]) => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(name, fn, config);
    
    // Configura fallback se fornecido
    if (fallback) {
      breaker.fallback(fallback);
    }

    return breaker.fire();
  }

  /**
   * Status de todos os circuit breakers
   */
  getStatus() {
    const status: Record<string, any> = {};

    this.breakers.forEach((breaker, name) => {
      const stats = breaker.stats;
      status[name] = {
        state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
        stats: {
          fires: stats.fires,
          successes: stats.successes,
          failures: stats.failures,
          timeouts: stats.timeouts,
          fallbacks: stats.fallbacks,
          rejects: stats.rejects,
          latencyMean: stats.latencyMean,
          percentiles: stats.percentiles,
        },
      };
    });

    return status;
  }

  /**
   * Força abertura de um circuit breaker
   */
  open(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.open();
      console.log(`🔴 Forcibly opened circuit breaker: ${name}`);
    }
  }

  /**
   * Fecha um circuit breaker
   */
  close(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      console.log(`🟢 Forcibly closed circuit breaker: ${name}`);
    }
  }

  /**
   * Reseta estatísticas de um circuit breaker
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.clearStats();
      console.log(`🔄 Reset stats for circuit breaker: ${name}`);
    }
  }

  /**
   * Remove um circuit breaker
   */
  remove(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.shutdown();
      this.breakers.delete(name);
      console.log(`🗑️ Removed circuit breaker: ${name}`);
    }
  }

  /**
   * Remove todos os circuit breakers
   */
  clear(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.shutdown();
    });
    this.breakers.clear();
    console.log(`🗑️ Cleared all circuit breakers`);
  }
}

// Singleton export
export const circuitBreakerService = new CircuitBreakerService();

// Circuit breakers pré-configurados para serviços comuns

/**
 * Circuit breaker para GROBID
 */
export const grobidBreaker = circuitBreakerService.getBreaker(
  'grobid',
  async (fn: () => Promise<any>) => fn(),
  {
    timeout: 60000, // 60s (PDFs podem demorar)
    errorThresholdPercentage: 60,
    resetTimeout: 120000, // 2 minutos
  }
);

/**
 * Circuit breaker para HuggingFace API
 */
export const huggingfaceBreaker = circuitBreakerService.getBreaker(
  'huggingface',
  async (fn: () => Promise<any>) => fn(),
  {
    timeout: 30000, // 30s
    errorThresholdPercentage: 50,
    resetTimeout: 60000, // 1 minuto
  }
);

/**
 * Circuit breaker para Qdrant
 */
export const qdrantBreaker = circuitBreakerService.getBreaker(
  'qdrant',
  async (fn: () => Promise<any>) => fn(),
  {
    timeout: 5000, // 5s
    errorThresholdPercentage: 40,
    resetTimeout: 30000, // 30s
  }
);

/**
 * Circuit breaker para Unpaywall API
 */
export const unpaywallBreaker = circuitBreakerService.getBreaker(
  'unpaywall',
  async (fn: () => Promise<any>) => fn(),
  {
    timeout: 10000, // 10s
    errorThresholdPercentage: 70,
    resetTimeout: 60000, // 1 minuto
  }
);
