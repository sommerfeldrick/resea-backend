/**
 * AI Providers Configuration
 * NOVA PRIORIDADE: Groq (100k tokens/dia) → OpenRouter (flexível) → Gemini (250 req/dia)
 * Ollama DESABILITADO (DNS resolution issues on Render)
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

  // 1️⃣ GROQ (100K TOKENS/DIA - ULTRA-FAST) - PRIMARY
  groq: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct', // Llama 4 Maverick 17B
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: !!process.env.GROQ_API_KEY,
    priority: 1, // PRIMEIRA OPÇÃO
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerDay: 100000, // 100k tokens/dia grátis
      tokensPerMinute: 1667
    }
  },

  // 2️⃣ OPENROUTER (CRÉDITOS FLEXÍVEIS - MUITOS MODELOS GRÁTIS) - SECONDARY
  openrouter: {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3.1:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: !!process.env.OPENROUTER_API_KEY,
    priority: 2, // SEGUNDA OPÇÃO
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000,
      tokensPerMinute: 20000
    }
  },

  // 3️⃣ GOOGLE GEMINI (250 REQ/DIA) - TERTIARY
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: !!process.env.GEMINI_API_KEY,
    priority: 3, // TERCEIRA OPÇÃO - Limitado a 250 req/dia
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000, // 1M tokens/dia grátis
      tokensPerMinute: 20000
    }
  },

  // 4️⃣ DEEPSEEK (5M TOKENS/MÊS GRÁTIS) - QUATERNARY
  deepseek: {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', // V3.1 (671B params)
    baseUrl: 'https://api.deepseek.com',
    enabled: !!process.env.DEEPSEEK_API_KEY,
    priority: 4, // QUARTA OPÇÃO - 5M tokens free/mês
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 166666, // ~5M tokens/mês ÷ 30 dias
      tokensPerMinute: 10000
    }
  }
};

/**
 * Ordem de fallback dos provedores
 * 1. Groq: 100k tokens/dia + 30 req/min (super rápido) - Llama 4 Maverick 17B
 * 2. OpenRouter: Créditos flexíveis + muitos modelos gratuitos
 * 3. Gemini: 250 req/dia + 1M tokens/dia
 * 4. DeepSeek: 5M tokens/mês grátis - DeepSeek V3.1 (671B)
 */
export const fallbackOrder: AIProvider[] = [
  'groq',         // 1️⃣ Primary - Ultra-fast
  'openrouter',   // 2️⃣ Secondary - Flexível
  'gemini',       // 3️⃣ Tertiary - Google
  'deepseek'      // 4️⃣ Quaternary - Ultra-poderoso
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
  },
  deepseek: {
    input: 0.28,     // $0.28 per 1M input tokens
    output: 0.42     // $0.42 per 1M output tokens
  }
};

/**
 * Model configurations for different use cases
 */
export const modelsByUseCase = {
  academic_writing: {
    primary: 'groq',
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct' // Llama 4 Maverick - Excelente para escrita acadêmica
  },
  fast_generation: {
    primary: 'groq',
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct' // Llama 4 Maverick - Ultra-fast
  },
  flexible_fallback: {
    primary: 'openrouter',
    model: 'deepseek/deepseek-chat-v3.1:free'
  },
  quality_fallback: {
    primary: 'gemini',
    model: 'gemini-2.0-flash'
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
