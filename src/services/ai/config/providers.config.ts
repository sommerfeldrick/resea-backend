/**
 * AI Providers Configuration
 * NOVA PRIORIDADE: Gemini (1M tokens/dia, 32K output) → DeepSeek (5M tokens/mês, 8K output) → OpenAI (pago)
 * Ollama e OpenRouter REMOVIDOS
 */

import { ProviderConfig, AIProvider } from '../types.js';

export const providerConfigs: Record<AIProvider, ProviderConfig> = {
  // ❌ OLLAMA CLOUD - DESABILITADO (DNS resolution issues on Render)
  ollama: {
    provider: 'ollama',
    apiKey: process.env.OLLAMA_API_KEY,
    model: process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud',
    baseUrl: process.env.OLLAMA_BASE_URL || 'https://api.ollama.com',
    enabled: false, // DESABILITADO - DNS issues
    priority: 99, // Desabilitado
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000,
      tokensPerMinute: 20000
    }
  },

  // 1️⃣ GOOGLE GEMINI (1M TOKENS/DIA, 32K OUTPUT) - PRIMARY
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: !!process.env.GEMINI_API_KEY,
    priority: 1, // PRIMEIRA OPÇÃO - 1M tokens/dia + 32K output tokens
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000, // 1M tokens/dia grátis
      tokensPerMinute: 20000
    }
  },

  // 2️⃣ DEEPSEEK (5M TOKENS/MÊS, 8K OUTPUT) - SECONDARY
  deepseek: {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', // V3.2-Exp: deepseek-chat (normal) ou deepseek-reasoner (thinking mode)
    baseUrl: 'https://api.deepseek.com',
    enabled: !!process.env.DEEPSEEK_API_KEY,
    priority: 2, // SEGUNDA OPÇÃO - 5M tokens free/mês, mas limitado a 8K output
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 166666, // ~5M tokens/mês ÷ 30 dias
      tokensPerMinute: 10000
    }
  },

  // 3️⃣ OPENAI (PAGO - GPT-4o-mini) - TERTIARY
  openai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    enabled: !!process.env.OPENAI_API_KEY,
    priority: 3, // TERCEIRA OPÇÃO
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000,
      tokensPerMinute: 20000
    }
  },

};

/**
 * Ordem de fallback dos provedores
 * 1. Gemini: 1M tokens/dia + 32K output tokens - Gemini 2.0 Flash
 * 2. DeepSeek: 5M tokens/mês grátis, 8K output - DeepSeek V3.2-Exp (deepseek-chat ou deepseek-reasoner)
 * 3. OpenAI: GPT-4o-mini (pago)
 */
export const fallbackOrder: AIProvider[] = [
  'gemini',       // 1️⃣ Primary - 32K output, melhor para geração de conteúdo
  'deepseek',     // 2️⃣ Secondary - 8K output, ultra-poderoso mas limitado
  'openai'        // 3️⃣ Tertiary - OpenAI (pago)
];

/**
 * Pricing information (USD per 1M tokens)
 */
export const providerPricing: Record<AIProvider, { input: number; output: number }> = {
  deepseek: {
    input: 0.28,     // $0.28 per 1M input tokens
    output: 0.42     // $0.42 per 1M output tokens
  },
  gemini: {
    input: 0.075,    // Flash: $0.075 per 1M
    output: 0.30     // Flash: $0.30 per 1M
  },
  openai: {
    input: 0.15,     // GPT-4o-mini: $0.15 per 1M
    output: 0.60     // GPT-4o-mini: $0.60 per 1M
  },
  ollama: {
    input: 0,        // REMOVIDO
    output: 0
  }
};

/**
 * Model configurations for different use cases
 */
export const modelsByUseCase = {
  academic_writing: {
    primary: 'gemini',
    model: 'gemini-2.0-flash' // Gemini 2.0 Flash - 32K output, perfeito para textos longos
  },
  fast_generation: {
    primary: 'gemini',
    model: 'gemini-2.0-flash' // Gemini 2.0 Flash - Rápido e eficiente
  },
  quality_reasoning: {
    primary: 'deepseek',
    model: 'deepseek-reasoner' // DeepSeek V3.2-Exp Reasoner - Qualidade máxima com thinking
  },
  fallback: {
    primary: 'deepseek',
    model: 'deepseek-chat'
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
