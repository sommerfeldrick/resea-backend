/**
 * AI Service
 * Serviço principal que expõe a interface simplificada
 * para geração de conteúdo com múltiplos providers
 */

import type { AIGenerationOptions, AIResponse } from './types.js';
import type { ModelQuality } from './config/ModelSelection.js';
import { AIStrategyRouter } from './AIStrategyRouter.js';
import { logger } from '../../config/logger.js';

/**
 * Função principal para gerar texto
 * Abstrai a complexidade de múltiplos providers
 */
export async function generateText(
  prompt: string,
  options: AIGenerationOptions = {}
): Promise<AIResponse> {
  try {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    logger.info('AI Service: generating text', {
      promptLength: prompt.length,
      requestedProvider: options.provider
    });

    // Use strategy router para gerar com melhor provider
    const response = await AIStrategyRouter.generate(prompt, options);

    logger.info('AI Service: text generation completed', {
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
      cost: `$${(response.cost || 0).toFixed(6)}`
    });

    return response;
  } catch (error: any) {
    logger.error('AI Service: text generation failed', {
      error: error.message,
      promptLength: prompt.length
    });
    throw error;
  }
}

/**
 * Gerar texto com controle de qualidade vs velocidade
 * quality: 'quality' para modelos mais poderosos, 'fast' para mais rápidos, 'balanced' para meio termo
 */
export async function generateTextWithQuality(
  prompt: string,
  quality: ModelQuality = 'balanced',
  options: AIGenerationOptions = {}
): Promise<AIResponse> {
  return generateText(prompt, {
    ...options,
    quality
  } as any);
}

/**
 * Stream text generation
 * Retorna um async generator para streaming
 */
export async function* generateTextStream(
  prompt: string,
  options: AIGenerationOptions = {}
): AsyncGenerator<string, void, unknown> {
  try {
    logger.info('AI Service: starting text stream', {
      promptLength: prompt.length
    });

    // Por enquanto, gera completo e devolve em chunks
    // TODO: Implementar streaming real com providers que suportam
    const response = await generateText(prompt, options);

    // Yield em chunks de ~100 caracteres
    const chunkSize = 100;
    for (let i = 0; i < response.text.length; i += chunkSize) {
      yield response.text.slice(i, i + chunkSize);
    }
  } catch (error: any) {
    logger.error('AI Service: stream generation failed', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get AI service health and statistics
 */
export async function getAIServiceHealth() {
  try {
    const health = await AIStrategyRouter.getHealth();
    const stats = AIStrategyRouter.getStats();

    return {
      healthy: true,
      providers: health,
      stats,
      timestamp: new Date()
    };
  } catch (error: any) {
    logger.error('Failed to get AI service health', {
      error: error.message
    });

    return {
      healthy: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * Reset daily statistics
 */
export function resetDailyStats(): void {
  AIStrategyRouter.resetDailyStats();
  logger.info('AI Service: daily statistics reset');
}
