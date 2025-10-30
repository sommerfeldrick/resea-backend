/**
 * AI Providers Configuration
 * NOVA PRIORIDADE: Ollama (1M tokens/dia) → Groq (100k tokens/dia) → OpenRouter (flexível) → Gemini (250 req/dia)
 */

import { ProviderConfig, AIProvider } from '../types.js';

export const providerConfigs: Record<AIProvider, ProviderConfig> = {
  // 1️⃣ OLLAMA CLOUD (1M TOKENS/DIA - MÁXIMA CAPACIDADE)
  ollama: {
    provider: 'ollama',
    apiKey: process.env.OLLAMA_API_KEY, // Chave para Ollama Cloud
    model: process.env.OLLAMA_MODEL || 'gpt-oss:120b-cloud', // Modelo default
    baseUrl: process.env.OLLAMA_BASE_URL || 'https://ollama.com', // Nuvem por default
    enabled: !!process.env.OLLAMA_API_KEY, // Habilitado se tiver API key
    priority: 1, // PRIMEIRA OPÇÃO - Maior capacidade
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000, // 1M tokens/dia no plano free
      tokensPerMinute: 20000
    }
  },

  // 2️⃣ GROQ (100K TOKENS/DIA - MUITO RÁPIDO)
  groq: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: !!process.env.GROQ_API_KEY,
    priority: 2, // SEGUNDA OPÇÃO
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerDay: 100000, // 100k tokens/dia grátis
      tokensPerMinute: 1667
    }
  },

  // 3️⃣ OPENROUTER (CRÉDITOS FLEXÍVEIS - MUITOS MODELOS GRÁTIS)
  openrouter: {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'nousresearch/hermes-3-llama-3.1-405b:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: !!process.env.OPENROUTER_API_KEY,
    priority: 3, // TERCEIRA OPÇÃO
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000,
      tokensPerMinute: 20000
    }
  },

  // 4️⃣ GOOGLE GEMINI (250 REQ/DIA - ÚLTIMO RECURSO)
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'google/gemini-2.0-flash-exp:free',
    enabled: !!process.env.GEMINI_API_KEY,
    priority: 4, // QUARTA OPÇÃO - Limitado a 250 req/dia
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000, // 1M tokens/dia grátis
      tokensPerMinute: 20000
    }
  }
};

/**
 * Ordem de fallback dos provedores (nova prioridade por capacidade free tier)
 * 1. Ollama Cloud: 1M tokens/dia
 * 2. Groq: 100k tokens/dia + 30 req/min (super rápido)
 * 3. OpenRouter: Créditos flexíveis + muitos modelos gratuitos
 * 4. Gemini: 250 req/dia (último recurso)
 */
export const fallbackOrder: AIProvider[] = [
  'ollama',       // 1️⃣ Máxima capacidade
  'groq',         // 2️⃣ Muito rápido
  'openrouter',   // 3️⃣ Flexível
  'gemini'        // 4️⃣ Limitado
];

/**
 * Pricing information (USD per 1M tokens)
 */
export const providerPricing: Record<AIProvider, { input: number; output: number }> = {
  gemini: {
    input: 0.075,    // Flash: $0.075 per 1M
    output: 0.30     // Flash: $0.30 per 1M
  },
  groq: {
    input: 0,        // GRÁTIS
    output: 0
  },
  openrouter: {
    input: 0.0,      // Variável por modelo
    output: 0.0      // Usar créditos iniciais
  },
  ollama: {
    input: 0,        // LOCAL - GRÁTIS
    output: 0
  }
};

/**
 * Model configurations for different use cases
 */
export const modelsByUseCase = {
  academic_writing: {
    primary: 'ollama',
    model: 'gpt-oss:120b-cloud'
  },
  fast_generation: {
    primary: 'groq',
    model: 'llama-3.1-70b-versatile'
  },
  flexible_fallback: {
    primary: 'openrouter',
    model: 'nousresearch/hermes-3-llama-3.1-405b:free'
  },
  quality_fallback: {
    primary: 'gemini',
    model: 'google/gemini-2.0-flash-exp:free'
  }
};

/**
 * Get enabled providers sorted by priority
 */
export function getEnabledProviders(): AIProvider[] {
  return fallbackOrder.filter(provider => providerConfigs[provider].enabled);
}

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return providerConfigs[provider];
}

/**
 * Check if provider is available
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  return providerConfigs[provider]?.enabled ?? false;
}
