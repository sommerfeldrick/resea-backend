/**
 * Groq Provider
 * Muito rápido (276 tokens/segundo) + grátis
 */

import Groq from 'groq-sdk';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class GroqProvider extends BaseAIProvider {
  private client?: Groq;

  constructor(apiKey?: string, model?: string) {
    super(apiKey, model);
    this.model = model || 'llama-3.1-70b-versatile';

    if (this.apiKey) {
      this.client = new Groq({ apiKey: this.apiKey });
    }
  }

  getProviderName(): string {
    return 'groq';
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.client) return false;
      // Simple check - if client exists, provider is configured
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
        throw new Error('Groq client not initialized');
      }

      const systemPrompt = this.formatSystemPrompt(options.systemPrompt);

      const startTime = Date.now();

      const message = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1
      });

      const text = message.choices[0]?.message?.content || '';
      const tokensUsed = message.usage?.total_tokens || 0;
      const latency = Date.now() - startTime;

      logger.info('Groq generation successful', {
        model: this.model,
        latency: `${latency}ms`,
        tokensUsed,
        speed: `${(tokensUsed / (latency / 1000)).toFixed(0)} tokens/s`
      });

      return {
        text,
        provider: 'groq',
        model: this.model,
        tokensUsed,
        cost: 0, // GRÁTIS!
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Groq generation failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }
}
