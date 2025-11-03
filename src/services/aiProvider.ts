/**
 * Multi-AI Provider Service
 * Suporta múltiplas APIs de IA com fallback automático
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { logger } from '../config/logger.js';

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'openrouter' | 'ollama';

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
 */
export const aiConfigs: Record<AIProvider, AIConfig> = {
  // Google Gemini (pago, mas com free tier generoso)
  gemini: {
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    enabled: !!process.env.GEMINI_API_KEY
  },

  // OpenAI (pago, mas poderoso)
  openai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Mais barato
    baseUrl: 'https://api.openai.com/v1',
    enabled: !!process.env.OPENAI_API_KEY
  },

  // Anthropic Claude (pago, muito bom)
  claude: {
    provider: 'claude',
    apiKey: process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022', // Mais barato
    baseUrl: 'https://api.anthropic.com/v1',
    enabled: !!process.env.CLAUDE_API_KEY
  },

  // Groq (Qwen3 32B - PAGO)
  groq: {
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'qwen/qwen3-32b',
    baseUrl: 'https://api.groq.com/openai/v1',
    enabled: !!process.env.GROQ_API_KEY
  },

  // OpenRouter (GRÁTIS! Múltiplos modelos)
  openrouter: {
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3.1:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    enabled: !!process.env.OPENROUTER_API_KEY
  },

  // Ollama Cloud (GRÁTIS! Modelos cloud sem GPU necessária)
  ollama: {
    provider: 'ollama',
    apiKey: process.env.OLLAMA_API_KEY,
    model: process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud',
    baseUrl: process.env.OLLAMA_BASE_URL || 'https://api.ollama.com',
    enabled: !!process.env.OLLAMA_API_KEY
  }
};

/**
 * Ordem de prioridade dos provedores (do mais barato para o mais caro)
 */
const providerPriority: AIProvider[] = ['ollama', 'groq', 'openrouter', 'gemini', 'openai', 'claude'];

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

      case 'openrouter':
        return await generateWithOpenRouter(prompt, options);

      case 'ollama':
        return await generateWithOllama(prompt, options);

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

/**
 * OpenRouter (GRÁTIS! Múltiplos modelos)
 */
async function generateWithOpenRouter(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.openrouter;

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
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://app.smileai.com.br',
        'X-Title': 'SmileAI Research Assistant',
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    text: response.data.choices[0].message.content,
    provider: 'openrouter',
    tokensUsed: response.data.usage?.total_tokens,
    cost: 0 // GRÁTIS!
  };
}

/**
 * Ollama Cloud (GRÁTIS! Sem GPU necessária)
 * Suporta: deepseek-v3.1:671b-cloud (primary), gpt-oss:120b-cloud, etc.
 */
async function generateWithOllama(prompt: string, options: any): Promise<AIResponse> {
  const config = aiConfigs.ollama;

  // Ollama Cloud usa /v1/chat/completions (compatível com OpenAI)
  const response = await axios.post(
    `${config.baseUrl}/v1/chat/completions`,
    {
      model: config.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false
    },
    {
      headers: {
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    text: response.data.choices[0].message.content,
    provider: 'ollama',
    tokensUsed: response.data.usage?.total_tokens,
    cost: 0 // CLOUD - GRÁTIS!
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
    gemini: 0.15,      // Flash: $0.075 input + $0.30 output
    openai: 0.20,      // GPT-4o-mini: $0.15 input + $0.60 output
    claude: 0.50,      // Haiku: $0.25 input + $1.25 output
    groq: 0,           // GRÁTIS
    openrouter: 0,     // GRÁTIS (modelos free)
    ollama: 0          // CLOUD - GRÁTIS
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
