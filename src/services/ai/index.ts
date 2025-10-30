/**
 * AI Service Exports
 * Ponto de entrada principal para usar o AI Service
 */

export { generateText, generateTextStream, getAIServiceHealth, resetDailyStats } from './aiService.js';
export { AIStrategyRouter } from './AIStrategyRouter.js';
export { ProviderFactory } from './providers/ProviderFactory.js';
export type { AIProvider, AIGenerationOptions, AIResponse, ProviderConfig, ProviderStats } from './types.js';
export { getEnabledProviders, getProviderConfig, isProviderAvailable } from './config/providers.config.js';
