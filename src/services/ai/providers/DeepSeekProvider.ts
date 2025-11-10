/**
 * DeepSeek Provider
 * API própria da DeepSeek com modelo V3.2-Exp
 * Free tier: 5M tokens/mês (refresh mensal)
 * OpenAI-compatible API
 *
 * Modelos:
 * - deepseek-chat: Modo normal (recomendado)
 * - deepseek-reasoner: Modo thinking com raciocínio explícito (tasks complexas)
 */

import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class DeepSeekProvider extends BaseAIProvider {
  private client?: OpenAI;

  constructor(apiKey?: string, model?: string) {
    super(apiKey, model);
    this.model = model || 'deepseek-chat';
    this.baseUrl = 'https://api.deepseek.com';

    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: 360000  // 6 minutos para análises muito complexas
      });
    }
  }

  getProviderName(): string {
    return 'deepseek';
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
        throw new Error('DeepSeek client not initialized');
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

      // DeepSeek pricing: $0.28/1M input, $0.42/1M output
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const cost = (promptTokens / 1_000_000) * 0.28 + (completionTokens / 1_000_000) * 0.42;

      logger.info('DeepSeek generation successful', {
        model: this.model,
        latency: `${latency}ms`,
        tokensUsed,
        estimatedCost: `$${cost.toFixed(6)}`
      });

      return {
        text,
        provider: 'deepseek',
        model: this.model,
        tokensUsed,
        cost,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('DeepSeek generation failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }

  async *generateStream(
    prompt: string,
    options: AIGenerationOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    try {
      this.validateConfig();

      if (!this.client) {
        throw new Error('DeepSeek client not initialized');
      }

      const systemPrompt = this.formatSystemPrompt(options.systemPrompt);

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1,
        stream: true
      });

      logger.info('DeepSeek streaming started', {
        model: this.model
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      logger.info('DeepSeek streaming completed', {
        model: this.model
      });
    } catch (error: any) {
      logger.error('DeepSeek streaming failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }
}
