import { logger } from '../config/logger.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any, attempt: number) => {
    // Retry on network errors, timeouts, and 5xx status codes
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    if (error.response?.status >= 500) return true;
    if (error.response?.status === 429) return true; // Rate limit
    return false;
  }
};

/**
 * Executes a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'operation'
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const shouldRetry = opts.shouldRetry(error, attempt);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        logger.error(`${context} failed after ${attempt} attempt(s)`, {
          error: error.message,
          attempt,
          context
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );

      logger.warn(`${context} failed on attempt ${attempt}, retrying in ${delay}ms`, {
        error: error.message,
        attempt,
        nextDelay: delay,
        context
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit breaker implementation to prevent cascade failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly name: string = 'circuit'
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit breaker ${this.name} closing after successful call`);
      this.state = 'CLOSED';
      this.successCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      logger.warn(`Circuit breaker ${this.name} opening after ${this.failureCount} failures`);
      this.state = 'OPEN';
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = 'CLOSED';
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}
