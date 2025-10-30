/**
 * AI Strategy Router
 * Seleciona o melhor provider com base em:
 * - Disponibilidade
 * - Rate limits
 * - Rotação de modelos
 * - Fallback automático
 */

import type { AIProvider, AIGenerationOptions, AIResponse } from './types.js';
import {
  getEnabledProviders,
  fallbackOrder,
  getProviderConfig
} from './config/providers.config.js';
import { 
  rotationStrategy, 
  ModelQuality,
  recommendedModels 
} from './config/ModelSelection.js';
import { ProviderFactory } from './providers/ProviderFactory.js';
import { logger } from '../../config/logger.js';

// Track usage for rate limiting
interface ProviderUsage {
  requestsToday: number;
  tokensUsedToday: number;
  costToday: number;
  lastRequestTime: number;
  lastError?: string;
  failureCount: number;
}

export class AIStrategyRouter {
  private static usage: Map<AIProvider, ProviderUsage> = new Map();
  private static requestQueue: Array<{
    timestamp: number;
    provider: AIProvider;
  }> = [];

  /**
   * Initialize usage tracking
   */
  private static initializeUsage(provider: AIProvider): void {
    if (!this.usage.has(provider)) {
      this.usage.set(provider, {
        requestsToday: 0,
        tokensUsedToday: 0,
        costToday: 0,
        lastRequestTime: 0,
        failureCount: 0
      });
    }
  }

  /**
   * Get best provider for current conditions
   */
  static async getBestProvider(): Promise<AIProvider> {
    const enabledProviders = getEnabledProviders();

    if (enabledProviders.length === 0) {
      throw new Error('No AI providers available');
    }

    logger.info('Selecting best provider', {
      availableProviders: enabledProviders.length
    });

    // Check each provider in priority order
    for (const provider of fallbackOrder) {
      if (!enabledProviders.includes(provider)) continue;

      this.initializeUsage(provider);
      const usage = this.usage.get(provider)!;

      // Check if provider can be used
      if (await this.canUseProvider(provider, usage)) {
        logger.info('Selected AI provider', { provider });
        return provider;
      }
    }

    // Fallback to first available
    logger.warn('No optimal provider found, using first available');
    return enabledProviders[0];
  }

  /**
   * Check if provider can be used (not rate-limited, available)
   */
  private static async canUseProvider(
    provider: AIProvider,
    usage: ProviderUsage
  ): Promise<boolean> {
    try {
      // Check rate limits
      const config = getProviderConfig(provider);

      // Daily tokens limit
      if (usage.tokensUsedToday >= config.rateLimits.tokensPerDay) {
        logger.warn(`Provider ${provider} reached daily token limit`, {
          used: usage.tokensUsedToday,
          limit: config.rateLimits.tokensPerDay
        });
        return false;
      }

      // Requests per minute
      const oneMinuteAgo = Date.now() - 60000;
      const recentRequests = this.requestQueue.filter(
        (r) => r.timestamp > oneMinuteAgo && r.provider === provider
      ).length;

      if (recentRequests >= config.rateLimits.requestsPerMinute) {
        logger.warn(`Provider ${provider} rate limited (requests/min)`, {
          recent: recentRequests,
          limit: config.rateLimits.requestsPerMinute
        });
        return false;
      }

      // Check if provider is available
      const providerInstance = ProviderFactory.getProvider(provider);
      const available = await providerInstance.isAvailable();

      if (!available) {
        usage.failureCount++;
        logger.warn(`Provider ${provider} not available`, {
          failureCount: usage.failureCount
        });
        return false;
      }

      // Reset failure count on successful check
      if (usage.failureCount > 0) {
        usage.failureCount = 0;
      }

      return true;
    } catch (error: any) {
      logger.error(`Error checking provider ${provider}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate text with automatic fallback and model rotation
   */
  static async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<AIResponse> {
    let lastError: Error | null = null;
    const providersToTry = options.provider
      ? [options.provider, ...fallbackOrder]
      : fallbackOrder;

    for (const provider of providersToTry) {
      if (!getEnabledProviders().includes(provider)) continue;

      // Declare modelToUse here so it's accessible in catch block
      let modelToUse: string = '';

      try {
        this.initializeUsage(provider);
        const usage = this.usage.get(provider)!;

        // Check if provider can be used
        if (!await this.canUseProvider(provider, usage)) {
          continue;
        }

        // Selecionar modelo com rotação inteligente
        const quality = (options as any).quality as ModelQuality || 'balanced';
        modelToUse = this.selectModel(provider, quality);

        logger.info('Generating text with provider', {
          provider,
          model: modelToUse,
          quality,
          promptLength: prompt.length
        });

        // Get provider instance
        const providerInstance = ProviderFactory.getProvider(provider);

        // Override model se necessário
        const enhancedOptions = {
          ...options,
          provider: provider as AIProvider
        };
        
        // Se a opção incluir modelo específico, passar
        if ((options as any).model) {
          (enhancedOptions as any).model = (options as any).model;
        } else {
          // Usar modelo selecionado
          (enhancedOptions as any).model = modelToUse;
        }

        // Generate response
        const startTime = Date.now();
        const response = await providerInstance.generate(prompt, options);
        const duration = Date.now() - startTime;

        // Registrar uso do modelo para rotação
        rotationStrategy.markUsage(modelToUse, true);

        // Update usage tracking
        usage.requestsToday++;
        usage.tokensUsedToday += response.tokensUsed || 0;
        usage.costToday += response.cost || 0;
        usage.lastRequestTime = Date.now();
        usage.failureCount = 0;

        // Add to request queue
        this.requestQueue.push({
          timestamp: Date.now(),
          provider
        });

        // Clean old requests from queue
        const oneHourAgo = Date.now() - 3600000;
        this.requestQueue = this.requestQueue.filter(
          (r) => r.timestamp > oneHourAgo
        );

        logger.info('Text generation successful', {
          provider,
          duration: `${duration}ms`,
          tokensUsed: response.tokensUsed,
          cost: `$${(response.cost || 0).toFixed(6)}`
        });

        return response;
      } catch (error: any) {
        lastError = error;
        logger.warn(`Generation failed with ${provider}`, {
          error: error.message,
          model: modelToUse
        });

        // Registrar falha do modelo para rotação
        rotationStrategy.markUsage(modelToUse, false);

        const usage = this.usage.get(provider);
        if (usage) {
          usage.failureCount++;
          usage.lastError = error.message;
        }

        // Try next provider
        continue;
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Get usage statistics
   */
  static getStats() {
    const stats: Record<string, any> = {};

    this.usage.forEach((usage, provider) => {
      stats[provider] = {
        ...usage,
        available: getEnabledProviders().includes(provider),
        config: getProviderConfig(provider)
      };
    });

    return stats;
  }

  /**
   * Reset daily usage stats
   */
  static resetDailyStats(): void {
    this.usage.forEach((usage) => {
      usage.requestsToday = 0;
      usage.tokensUsedToday = 0;
      usage.costToday = 0;
    });
    logger.info('Daily usage stats reset');
  }

  /**
   * Get health status
   */
  static async getHealth() {
    const providers = getEnabledProviders();
    const health: Record<string, any> = {};

    for (const provider of providers) {
      try {
        const instance = ProviderFactory.getProvider(provider);
        const available = await instance.isAvailable();
        const usage = this.usage.get(provider);

        // Get rotation statistics - use default model for this provider
        const defaultModel = getProviderConfig(provider).model;
        const successRate = rotationStrategy.getSuccessRate(defaultModel || '', 60);

        health[provider] = {
          available,
          enabled: true,
          usage: usage || {},
          config: getProviderConfig(provider),
          rotation: {
            successRate: `${(successRate * 100).toFixed(2)}%`,
            model: defaultModel
          }
        };
      } catch (error: any) {
        health[provider] = {
          available: false,
          enabled: true,
          error: error.message
        };
      }
    }

    return health;
  }

  /**
   * Selecionar modelo com base na qualidade e estratégia de rotação
   * Retorna o melhor modelo disponível de um array
   */
  private static selectModel(provider: AIProvider, quality: ModelQuality = 'balanced'): string {
    try {
      // Obter array de modelos
      const availableModels = rotationStrategy.selectModels(provider as any, quality);
      
      // Retornar modelo com melhor taxa de sucesso
      return rotationStrategy.getNextModel(availableModels);
    } catch (error: any) {
      logger.error('Error selecting model', {
        provider,
        error: error.message
      });
      
      // Fallback para modelo padrão
      const config = getProviderConfig(provider);
      return config.model || 'default';
    }
  }
}
