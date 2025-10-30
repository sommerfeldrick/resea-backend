/**
 * Ollama Provider
 * Modelos open-source locais - 100% grátis, totalmente offline
 */

import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class OllamaProvider extends BaseAIProvider {
  constructor(model?: string, baseUrl?: string) {
    super(undefined, model, baseUrl);
    this.model = model || 'llama2';
    this.baseUrl = baseUrl || 'http://localhost:11434';
  }

  getProviderName(): string {
    return 'ollama';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      logger.warn('Ollama server not available at', { baseUrl: this.baseUrl });
      return false;
    }
  }

  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<AIResponse> {
    try {
      if (!await this.isAvailable()) {
        throw new Error(`Ollama server not available at ${this.baseUrl}`);
      }

      const systemPrompt = this.formatSystemPrompt(options.systemPrompt);
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;

      const startTime = Date.now();

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: fullPrompt,
          stream: false,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          num_predict: options.maxTokens || 4096
        },
        {
          timeout: 120000 // 2 minutos para modelos grandes
        }
      );

      const text = response.data.response || '';
      const latency = Date.now() - startTime;

      logger.info('Ollama generation successful', {
        model: this.model,
        latency: `${latency}ms`,
        textLength: text.length
      });

      return {
        text,
        provider: 'ollama',
        model: this.model,
        tokensUsed: 0,
        cost: 0, // LOCAL - GRÁTIS!
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Ollama generation failed', {
        error: error.message,
        model: this.model,
        baseUrl: this.baseUrl
      });
      throw error;
    }
  }
}
