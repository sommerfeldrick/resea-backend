/**
 * OpenRouter Provider
 * Acesso flexível a múltiplos modelos (GPT, Claude, Gemini)
 * Créditos iniciais grátis + modelo free disponível
 */

import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class OpenRouterProvider extends BaseAIProvider {
  private client?: OpenAI;

  constructor(apiKey?: string, model?: string) {
    super(apiKey, model);
    this.model = model || 'meta-llama/llama-3.1-8b-instruct:free';
    this.baseUrl = 'https://openrouter.ai/api/v1';

    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        defaultHeaders: {
          'HTTP-Referer': 'https://app.smileai.com.br',
          'X-Title': 'SmileAI Research Assistant'
        }
      });
    }
  }

  getProviderName(): string {
    return 'openrouter';
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.client) return false;
      return true;
    } catch {
      return false;
    }
  }

  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<AIResponse> {
    try {
      this.validateConfig();

      if (!this.client) {
        throw new Error('OpenRouter client not initialized');
      }

      const systemPrompt = this.formatSystemPrompt(options.systemPrompt);

      const startTime = Date.now();

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1
      });

      const text = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const latency = Date.now() - startTime;

      // Calcula custo com base no modelo
      const cost = this.calculateCostForModel(
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0,
        this.model
      );

      logger.info('OpenRouter generation successful', {
        model: this.model,
        latency: `${latency}ms`,
        tokensUsed,
        estimatedCost: `$${cost.toFixed(6)}`
      });

      return {
        text,
        provider: 'openrouter',
        model: this.model,
        tokensUsed,
        cost,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('OpenRouter generation failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }

  /**
   * Calcular custo com base no modelo específico
   */
  private calculateCostForModel(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    // Preços aproximados (USD por 1M tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'deepseek/deepseek-chat-v3.1:free': { prompt: 0, completion: 0 },
      'meta-llama/llama-3.1-8b-instruct:free': { prompt: 0, completion: 0 },
      'meta-llama/llama-3.3-70b-instruct:free': { prompt: 0, completion: 0 },
      'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
      'openai/gpt-4o': { prompt: 5, completion: 15 },
      'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 },
      'google/gemini-2.0-flash-exp': { prompt: 0.075, completion: 0.30 }
    };

    const price = pricing[model] || pricing['meta-llama/llama-3.1-8b-instruct:free'];

    return (promptTokens / 1_000_000) * price.prompt +
           (completionTokens / 1_000_000) * price.completion;
  }
}
