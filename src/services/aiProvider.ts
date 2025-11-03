/**
 * Multi-AI Provider Service
 * Suporta múltiplas APIs de IA com fallback automático
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { logger } from '../config/logger.js';

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'ollama' | 'deepseek';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  tokensUsed?: number;
  cost?: number;
}

/**
 * Configuração de múltiplas IAs
 * PRIORIDADE: DeepSeek (1º) → Gemini (2º) → Groq (3º)
 */
export const aiConfigs: Record<AIProvider, AIConfig> = {
  // 1️⃣ DeepSeek (5M TOKENS/MÊS GRÁTIS - PRIMARY)
  deepseek: {
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    enabled: !!process.env.DEEPSEEK_API_KEY
  },

  // 2️⃣ Google Gemini (250 req/dia - SECONDARY)
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: !!process.env.GEMINI_API_KEY
  },

  // 3️⃣ Groq (100k tokens/dia - TERTIARY)
  groq: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct',
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: !!process.env.GROQ_API_KEY
  },

  // OpenAI (pago)
  openai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    enabled: !!process.env.OPENAI_API_KEY
  },

  // Claude (pago)
  claude: {
    provider: 'claude',
    apiKey: process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    enabled: !!process.env.CLAUDE_API_KEY
  },

  // ❌ REMOVIDOS
  ollama: {
    provider: 'ollama',
    apiKey: undefined,
    model: undefined,
    baseUrl: 'https://api.ollama.com',
    enabled: false
  }
};

/**
 * Ordem de prioridade dos provedores
 * DeepSeek (1º) → Gemini (2º) → OpenAI (3º)
 */
const providerPriority: AIProvider[] = ['deepseek', 'gemini', 'openai', 'groq', 'claude'];

/**
 * Get active AI provider
 */
export function getActiveProvider(): AIProvider {
  // Tenta usar o provider configurado
  const preferred = (process.env.AI_PROVIDER as AIProvider) || 'gemini';

  if (aiConfigs[preferred]?.enabled) {
    return preferred;
  }

  // Fallback: usa o primeiro disponível na ordem de prioridade
  for (const provider of providerPriority) {
    if (aiConfigs[provider]?.enabled) {
      logger.info(`Using fallback AI provider: ${provider}`);
      return provider;
    }
  }

  throw new Error('Nenhum provedor de IA configurado! Configure pelo menos um.');
}

/**
 * Generate text using configured AI provider
 */
export async function generateText(
  prompt: string,
  options: {
    provider?: AIProvider;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<AIResponse> {
  const provider = options.provider || getActiveProvider();
  const config = aiConfigs[provider];

  logger.info('Generating text', { provider, promptLength: prompt.length });

  try {
    switch (provider) {
      case 'gemini':
        return await generateWithGemini(prompt, options);

      case 'openai':
        return await generateWithOpenAI(prompt, options);

      case 'claude':
        return await generateWithClaude(prompt, options);

      case 'groq':
        return await generateWithGroq(prompt, options);

      case 'deepseek':
        return await generateWithDeepSeek(prompt, options);

      case 'ollama':
        throw new Error('Ollama provider foi removido');

      default:
        throw new Error(`Provider não suportado: ${provider}`);
    }
  } catch (error: any) {
    logger.error(`AI generation failed with ${provider}`, { error: error.message });

    // Tentar fallback para próximo provider
    const nextProvider = getNextProvider(provider);
    if (nextProvider) {
      logger.warn(`Trying fallback provider: ${nextProvider}`);
      return generateText(prompt, { ...options, provider: nextProvider });
    }

    throw error;
  }
}

/**
 * Gemini
 */
async function generateWithGemini(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.gemini;
  const genAI = new GoogleGenerativeAI(config.apiKey!);
  const model = genAI.getGenerativeModel({ model: config.model! });

  const result = await model.generateContent(
    options.systemPrompt
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt
  );

  const response = await result.response;
  const text = response.text();

  return {
    text,
    provider: 'gemini',
    tokensUsed: undefined, // Token usage not available in this version
    cost: 0 // Will be calculated based on estimates if needed
  };
}

/**
 * OpenAI / GPT
 */
async function generateWithOpenAI(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.openai;

  const response = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const tokensUsed = response.data.usage.total_tokens;

  return {
    text: response.data.choices[0].message.content,
    provider: 'openai',
    tokensUsed,
    cost: calculateCost('openai', tokensUsed)
  };
}

/**
 * Claude (Anthropic)
 */
async function generateWithClaude(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.claude;

  const response = await axios.post(
    `${config.baseUrl}/messages`,
    {
      model: config.model,
      max_tokens: options.maxTokens || 4096,
      messages: [
        { role: 'user', content: prompt }
      ],
      ...(options.systemPrompt && { system: options.systemPrompt })
    },
    {
      headers: {
        'x-api-key': config.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );

  const tokensUsed = response.data.usage.input_tokens + response.data.usage.output_tokens;

  return {
    text: response.data.content[0].text,
    provider: 'claude',
    tokensUsed,
    cost: calculateCost('claude', tokensUsed)
  };
}

/**
 * Groq (GRÁTIS!)
 */
async function generateWithGroq(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.groq;

  const response = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    text: response.data.choices[0].message.content,
    provider: 'groq',
    tokensUsed: response.data.usage?.total_tokens,
    cost: 0 // GRÁTIS!
  };
}

// OpenRouter e Ollama REMOVIDOS

/**
 * DeepSeek (5M TOKENS/MÊS GRÁTIS - DeepSeek V3.1 671B)
 */
async function generateWithDeepSeek(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.deepseek;

  const response = await axios.post(
    `${config.baseUrl}/v1/chat/completions`,
    {
      model: config.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const promptTokens = response.data.usage?.prompt_tokens || 0;
  const completionTokens = response.data.usage?.completion_tokens || 0;
  const tokensUsed = response.data.usage?.total_tokens || 0;

  // Calcular custo: $0.28/1M input + $0.42/1M output
  const cost = (promptTokens / 1_000_000) * 0.28 + (completionTokens / 1_000_000) * 0.42;

  return {
    text: response.data.choices[0].message.content,
    provider: 'deepseek',
    tokensUsed,
    cost
  };
}

/**
 * Get next available provider for fallback
 */
function getNextProvider(current: AIProvider): AIProvider | null {
  const currentIndex = providerPriority.indexOf(current);

  for (let i = currentIndex + 1; i < providerPriority.length; i++) {
    const provider = providerPriority[i];
    if (aiConfigs[provider]?.enabled) {
      return provider;
    }
  }

  return null;
}

/**
 * Calculate approximate cost (USD)
 */
function calculateCost(provider: AIProvider, tokens: number): number {
  // Preços aproximados por 1M tokens (input + output médio)
  const prices: Record<AIProvider, number> = {
    deepseek: 0.35,    // $0.28 input + $0.42 output (média)
    gemini: 0.15,      // Flash: $0.075 input + $0.30 output
    groq: 0,           // GRÁTIS
    openai: 0.20,      // GPT-4o-mini: $0.15 input + $0.60 output
    claude: 0.50,      // Haiku: $0.25 input + $1.25 output
    ollama: 0          // REMOVIDO
  };

  return (tokens / 1_000_000) * prices[provider];
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return Object.entries(aiConfigs)
    .filter(([_, config]) => config.enabled)
    .map(([name]) => name as AIProvider);
}

/**
 * Get provider statistics
 */
export function getProviderStats() {
  return {
    active: getActiveProvider(),
    available: getAvailableProviders(),
    configs: aiConfigs
  };
}
