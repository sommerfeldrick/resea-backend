/**
 * Google Gemini 2.5 Flash Provider
 * Melhor qualidade + quase grátis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class GeminiProvider extends BaseAIProvider {
  private client?: GoogleGenerativeAI;

  constructor(apiKey?: string, model?: string) {
    super(apiKey, model);
    this.model = model || 'gemini-2.0-flash';

    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  getProviderName(): string {
    return 'gemini';
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
        throw new Error('Gemini client not initialized');
      }

      const model = this.client.getGenerativeModel({
        model: this.model
      });

      const fullPrompt = options.systemPrompt
        ? `${options.systemPrompt}\n\n${prompt}`
        : prompt;

      const startTime = Date.now();

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      const tokensUsed = 0; // Gemini não retorna token count nesta versão
      const latency = Date.now() - startTime;

      logger.info('Gemini generation successful', {
        model: this.model,
        latency: `${latency}ms`,
        textLength: text.length
      });

      return {
        text,
        provider: 'gemini',
        model: this.model,
        tokensUsed,
        cost: 0, // Dentro do free tier
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Gemini generation failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }
}
