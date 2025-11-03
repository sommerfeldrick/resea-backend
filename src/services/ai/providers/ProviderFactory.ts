/**
 * AI Provider Factory
 * Cria instâncias dos providers com base na configuração
 */

import { GeminiProvider } from './GeminiProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { DeepSeekProvider } from './DeepSeekProvider.js';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIProvider } from '../types.js';
import { getProviderConfig } from '../config/providers.config.js';
import { logger } from '../../../config/logger.js';

export class ProviderFactory {
  private static instances: Map<AIProvider, BaseAIProvider> = new Map();

  /**
   * Get or create provider instance
   */
  static getProvider(provider: AIProvider): BaseAIProvider {
    // Return cached instance if exists
    if (this.instances.has(provider)) {
      return this.instances.get(provider)!;
    }

    // Create new instance
    const config = getProviderConfig(provider);
    let providerInstance: BaseAIProvider;

    switch (provider) {
      case 'gemini':
        providerInstance = new GeminiProvider(config.apiKey, config.model);
        break;

      case 'groq':
        providerInstance = new GroqProvider(config.apiKey, config.model);
        break;

      case 'ollama':
        providerInstance = new OllamaProvider(config.model, config.baseUrl, config.apiKey);
        break;

      case 'deepseek':
        providerInstance = new DeepSeekProvider(config.apiKey, config.model);
        break;

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Cache instance
    this.instances.set(provider, providerInstance);
    logger.info(`Provider factory created instance: ${provider}`);

    return providerInstance;
  }

  /**
   * Clear all cached instances
   */
  static clearCache(): void {
    this.instances.clear();
    logger.info('Provider factory cache cleared');
  }

  /**
   * Clear specific provider cache
   */
  static clearProviderCache(provider: AIProvider): void {
    this.instances.delete(provider);
    logger.info(`Provider cache cleared: ${provider}`);
  }
}
