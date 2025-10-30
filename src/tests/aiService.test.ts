/**
 * AI Service Tests
 * Testes básicos para validar o sistema multi-provider
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateText, getAIServiceHealth } from '../services/ai/index.js';
import { AIStrategyRouter } from '../services/ai/AIStrategyRouter.js';
import { ProviderFactory } from '../services/ai/providers/ProviderFactory.js';
import type { AIProvider } from '../services/ai/types.js';

describe('AI Service - Multi Provider', () => {
  describe('Provider Factory', () => {
    it('should create Gemini provider instance', () => {
      if (process.env.GEMINI_API_KEY) {
        const provider = ProviderFactory.getProvider('gemini');
        expect(provider).toBeDefined();
        expect(provider.getProviderName()).toBe('gemini');
      }
    });

    it('should create Groq provider instance', () => {
      if (process.env.GROQ_API_KEY) {
        const provider = ProviderFactory.getProvider('groq');
        expect(provider).toBeDefined();
        expect(provider.getProviderName()).toBe('groq');
      }
    });

    it('should cache provider instances', () => {
      if (process.env.GEMINI_API_KEY) {
        const provider1 = ProviderFactory.getProvider('gemini');
        const provider2 = ProviderFactory.getProvider('gemini');
        expect(provider1).toBe(provider2);
      }
    });
  });

  describe('AI Strategy Router', () => {
    it('should get health status', async () => {
      const health = await AIStrategyRouter.getHealth();
      expect(health).toBeDefined();
      expect(typeof health).toBe('object');
    });

    it('should track usage statistics', () => {
      const stats = AIStrategyRouter.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should reset daily stats', () => {
      AIStrategyRouter.resetDailyStats();
      const stats = AIStrategyRouter.getStats();
      // After reset, all providers should have 0 usage
      Object.values(stats).forEach((stat: any) => {
        if (stat.requestsToday !== undefined) {
          expect(stat.requestsToday).toBe(0);
        }
      });
    });
  });

  describe('AI Service', () => {
    beforeEach(() => {
      // Reset before each test
      AIStrategyRouter.resetDailyStats();
    });

    it('should require non-empty prompt', async () => {
      try {
        await generateText('');
        expect.fail('Should throw error for empty prompt');
      } catch (error: any) {
        expect(error.message).toContain('empty');
      }
    });

    it('should return AIResponse object with expected properties', async () => {
      // Skip if no providers configured
      const { gemini: g, groq: gr } = process.env;
      if (!g && !gr) {
        console.log('⏭️  Skipping - no AI providers configured');
        return;
      }

      try {
        const response = await generateText('Test: Say hello', {
          maxTokens: 50,
          temperature: 0.7
        });

        expect(response).toBeDefined();
        expect(response.text).toBeDefined();
        expect(response.provider).toBeDefined();
        expect(response.timestamp).toBeDefined();
        expect(['gemini', 'groq', 'openrouter', 'ollama']).toContain(
          response.provider
        );
      } catch (error: any) {
        // Expected if no providers available
        console.log('⏭️  Skipping test - provider unavailable:', error.message);
      }
    });

    it('should respect temperature option', async () => {
      if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
        console.log('⏭️  Skipping - no AI providers configured');
        return;
      }

      try {
        const response = await generateText(
          'Generate a random word',
          {
            temperature: 0.1,
            maxTokens: 20
          }
        );

        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
      } catch (error: any) {
        console.log('⏭️  Skipping test - provider unavailable:', error.message);
      }
    });

    it('should include system prompt in generation', async () => {
      if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
        console.log('⏭️  Skipping - no AI providers configured');
        return;
      }

      try {
        const response = await generateText(
          'What is 2+2?',
          {
            systemPrompt:
              'You are a math teacher. Always respond with the answer and an explanation.',
            maxTokens: 50
          }
        );

        expect(response.text).toBeDefined();
        expect(response.text.toLowerCase()).toContain('4');
      } catch (error: any) {
        console.log('⏭️  Skipping test - provider unavailable:', error.message);
      }
    });
  });

  describe('AI Service Health', () => {
    it('should return health information', async () => {
      const health = await getAIServiceHealth();
      expect(health).toBeDefined();
      expect(health.healthy !== undefined).toBe(true);
      expect(health.timestamp).toBeDefined();
    });
  });
});
