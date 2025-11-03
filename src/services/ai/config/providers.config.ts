/**
 * AI Providers Configuration
 * NOVA PRIORIDADE: DeepSeek (5M tokens/mês) → Gemini (1M tokens/dia) → OpenAI (pago)
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

  // 1️⃣ DEEPSEEK (5M TOKENS/MÊS GRÁTIS) - PRIMARY
  deepseek: {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', // V3.2-Exp: deepseek-chat (normal) ou deepseek-reasoner (thinking mode)
    baseUrl: 'https://api.deepseek.com',
    enabled: !!process.env.DEEPSEEK_API_KEY,
    priority: 1, // PRIMEIRA OPÇÃO - 5M tokens free/mês
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 166666, // ~5M tokens/mês ÷ 30 dias
      tokensPerMinute: 10000
    }
  },

  // 2️⃣ GOOGLE GEMINI (250 REQ/DIA) - SECONDARY
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: !!process.env.GEMINI_API_KEY,
    priority: 2, // SEGUNDA OPÇÃO - Limitado a 250 req/dia
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerDay: 1000000, // 1M tokens/dia grátis
      tokensPerMinute: 20000
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

  // GROQ (100K TOKENS/DIA - GRÁTIS) - QUATERNARY
  groq: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct',
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: !!process.env.GROQ_API_KEY,
    priority: 4, // QUARTA OPÇÃO
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerDay: 100000,
      tokensPerMinute: 1667
    }
  }
};

/**
 * Ordem de fallback dos provedores
 * 1. DeepSeek: 5M tokens/mês grátis - DeepSeek V3.2-Exp (deepseek-chat ou deepseek-reasoner)
 * 2. Gemini: 250 req/dia + 1M tokens/dia
 * 3. OpenAI: GPT-4o-mini (pago)
 */
export const fallbackOrder: AIProvider[] = [
  'deepseek',     // 1️⃣ Primary - Ultra-poderoso
  'gemini',       // 2️⃣ Secondary - Google
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
  groq: {
    input: 0,        // GRÁTIS
    output: 0
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
    primary: 'deepseek',
    model: 'deepseek-reasoner' // DeepSeek V3.2-Exp Reasoner - Excelente para escrita acadêmica com raciocínio
  },
  fast_generation: {
    primary: 'deepseek',
    model: 'deepseek-chat' // DeepSeek V3.2-Exp - Geração rápida
  },
  quality_reasoning: {
    primary: 'deepseek',
    model: 'deepseek-reasoner' // DeepSeek V3.2-Exp Reasoner - Qualidade máxima com thinking
  },
  fallback: {
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
