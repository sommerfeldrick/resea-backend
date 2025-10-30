/**
 * Base class for AI Providers
 * Todos os provedores implementam essa interface
 */

import type { AIGenerationOptions, AIResponse } from '../types.js';

export abstract class BaseAIProvider {
  protected apiKey?: string;
  protected model: string;
  protected baseUrl?: string;

  constructor(apiKey?: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model || 'default';
    this.baseUrl = baseUrl;
  }

  /**
   * Generate text - deve ser implementado por cada provider
   */
  abstract generate(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<AIResponse>;

  /**
   * Check if provider is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get provider name
   */
  abstract getProviderName(): string;

  /**
   * Validate API configuration
   */
  protected validateConfig(): void {
    if (!this.apiKey && this.getProviderName() !== 'ollama') {
      throw new Error(`${this.getProviderName()} API key not configured`);
    }
  }

  /**
   * Format system prompt with provider-specific requirements
   */
  protected formatSystemPrompt(systemPrompt?: string): string {
    return systemPrompt || 'You are a helpful assistant for academic research.';
  }

  /**
   * Calculate cost based on tokens used
   */
  protected calculateCost(tokensUsed: number, pricePerMillion: number): number {
    return (tokensUsed / 1_000_000) * pricePerMillion;
  }
}
