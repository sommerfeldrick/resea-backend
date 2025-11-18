/**
 * Base API Service
 * Provides common functionality for all external API integrations:
 * - Rate limiting (token bucket algorithm)
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - HTTP client configuration
 * - Error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import type { AcademicArticle } from '../../types/article.types.js';
import { Logger } from '../../utils/simple-logger.js';

export interface RateLimiterConfig {
  tokensPerSecond: number; // Tokens refilled per second
  maxTokens: number; // Maximum burst size
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeoutMs: number; // Time to wait before trying again
}

export abstract class BaseAPIService {
  protected client: AxiosInstance;
  protected logger: Logger;
  protected apiName: string;

  // Rate Limiter (Token Bucket)
  private tokens: number;
  private maxTokens: number;
  private tokensPerSecond: number;
  private lastRefillTime: number;

  // Retry Configuration
  private retryConfig: RetryConfig = {
    maxRetries: 5,              // Increased from 3 to 5
    initialDelayMs: 1000,
    maxDelayMs: 15000,          // Increased from 10s to 15s
    backoffMultiplier: 2,
  };

  // Circuit Breaker
  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private failureThreshold: number;
  private resetTimeout: number;
  private nextAttemptTime: number = 0;

  constructor(
    apiName: string,
    baseURL: string,
    rateLimiter: RateLimiterConfig = { tokensPerSecond: 10, maxTokens: 20 },
    circuitBreaker: CircuitBreakerConfig = { failureThreshold: 5, resetTimeoutMs: 60000 },
    customHeaders?: Record<string, string>
  ) {
    this.apiName = apiName;
    this.logger = new Logger(apiName);

    // Initialize HTTP client
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'RESEA-Academic-Search/1.0',
        'Accept': 'application/json',
        ...customHeaders,
      },
    });

    // Initialize Rate Limiter
    this.tokensPerSecond = rateLimiter.tokensPerSecond;
    this.maxTokens = rateLimiter.maxTokens;
    this.tokens = rateLimiter.maxTokens;
    this.lastRefillTime = Date.now();

    // Initialize Circuit Breaker
    this.failureThreshold = circuitBreaker.failureThreshold;
    this.resetTimeout = circuitBreaker.resetTimeoutMs;
  }

  /**
   * Main search method - must be implemented by subclasses
   */
  abstract search(
    query: string,
    limit: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]>;

  /**
   * Make rate-limited and retryable HTTP request
   */
  protected async makeRequest<T>(
    config: AxiosRequestConfig,
    requiredTokens: number = 1
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitState === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        this.logger.warn('Circuit breaker OPEN - request blocked');
        throw new Error(`${this.apiName} circuit breaker is OPEN`);
      }
      // Try half-open
      this.circuitState = 'HALF_OPEN';
      this.logger.info('Circuit breaker HALF_OPEN - attempting request');
    }

    // Wait for rate limit
    await this.waitForTokens(requiredTokens);

    // Make request with retry logic
    return this.retryableRequest<T>(config);
  }

  /**
   * Retryable HTTP request with exponential backoff
   */
  private async retryableRequest<T>(config: AxiosRequestConfig): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.client.request<T>(config);

        // Success - reset circuit breaker
        this.onSuccess();

        return response.data;
      } catch (error) {
        lastError = this.handleRequestError(error as AxiosError);

        // Don't retry on client errors (4xx)
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 429) {
            this.logger.warn(`Client error ${status} - not retrying`);
            break;
          }

          // Special handling for 429 (rate limit) - wait longer
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(delay * 2, 10000);
            this.logger.warn(`Rate limit hit (429) - waiting ${waitTime}ms before retry`);
            if (attempt < this.retryConfig.maxRetries) {
              await this.sleep(waitTime);
              delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
              continue;
            } else {
              break;
            }
          }
        }

        // Retry logic
        if (attempt < this.retryConfig.maxRetries) {
          this.logger.info(`Retry ${attempt + 1}/${this.retryConfig.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
        }
      }
    }

    // All retries failed
    this.onFailure();
    throw lastError || new Error(`${this.apiName} request failed after ${this.retryConfig.maxRetries} retries`);
  }

  /**
   * Rate Limiter: Wait for available tokens (Token Bucket Algorithm)
   */
  private async waitForTokens(requiredTokens: number): Promise<void> {
    while (true) {
      // Refill tokens based on time elapsed
      const now = Date.now();
      const elapsedSeconds = (now - this.lastRefillTime) / 1000;
      const tokensToAdd = elapsedSeconds * this.tokensPerSecond;

      this.tokens = Math.min(this.tokens + tokensToAdd, this.maxTokens);
      this.lastRefillTime = now;

      // Check if enough tokens available
      if (this.tokens >= requiredTokens) {
        this.tokens -= requiredTokens;
        return;
      }

      // Wait for tokens to refill
      const tokensNeeded = requiredTokens - this.tokens;
      const waitTimeMs = (tokensNeeded / this.tokensPerSecond) * 1000;

      this.logger.debug(`Rate limit: waiting ${waitTimeMs.toFixed(0)}ms for tokens`);
      await this.sleep(Math.min(waitTimeMs, 5000)); // Max 5s wait
    }
  }

  /**
   * Circuit Breaker: Handle success
   */
  private onSuccess(): void {
    if (this.circuitState === 'HALF_OPEN') {
      this.logger.info('Circuit breaker CLOSED - service recovered');
      this.circuitState = 'CLOSED';
    }
    this.failureCount = 0;
  }

  /**
   * Circuit Breaker: Handle failure
   */
  private onFailure(): void {
    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      this.logger.error(
        `Circuit breaker OPEN - ${this.failureCount} failures (reset in ${this.resetTimeout}ms)`
      );
    }
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = `${this.apiName} API error ${status}: ${error.message}`;
      this.logger.error(message);
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      const message = `${this.apiName} no response: ${error.message}`;
      this.logger.error(message);
      return new Error(message);
    } else {
      // Error setting up request
      const message = `${this.apiName} request setup error: ${error.message}`;
      this.logger.error(message);
      return new Error(message);
    }
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker state
   */
  public getCircuitState(): string {
    return this.circuitState;
  }

  /**
   * Manually reset circuit breaker (for testing)
   */
  public resetCircuit(): void {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    this.logger.info('Circuit breaker manually reset');
  }
}
