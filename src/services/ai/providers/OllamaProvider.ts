/**
 * Ollama Provider
 * Suporta Ollama Local (localhost) e Ollama Cloud (api.ollama.com)
 */

import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider.js';
import type { AIGenerationOptions, AIResponse } from '../types.js';
import { logger } from '../../../config/logger.js';

export class OllamaProvider extends BaseAIProvider {
  private isCloud: boolean;

  constructor(model?: string, baseUrl?: string, apiKey?: string) {
    super(apiKey, model, baseUrl);
    this.model = model || 'llama2';
    this.baseUrl = baseUrl || 'http://localhost:11434';

    // Detecta se é Ollama Cloud ou Local
    this.isCloud = this.baseUrl.includes('api.ollama.com');

    logger.info('OllamaProvider initialized', {
      mode: this.isCloud ? 'cloud' : 'local',
      baseUrl: this.baseUrl,
      model: this.model,
      hasApiKey: !!this.apiKey
    });
  }

  getProviderName(): string {
    return 'ollama';
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.isCloud) {
        // Ollama Cloud: verifica se tem API key
        if (!this.apiKey) {
          logger.warn('Ollama Cloud requires API key');
          return false;
        }
        return true;
      } else {
        // Ollama Local: testa conexão
        const response = await axios.get(`${this.baseUrl}/api/tags`, {
          timeout: 5000
        });
        return response.status === 200;
      }
    } catch (error: any) {
      logger.warn('Ollama server not available', {
        baseUrl: this.baseUrl,
        error: error.message
      });
      return false;
    }
  }

  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<AIResponse> {
    try {
      if (!await this.isAvailable()) {
        throw new Error(
          this.isCloud
            ? 'Ollama Cloud requires API key'
            : `Ollama server not available at ${this.baseUrl}`
        );
      }

      const startTime = Date.now();

      if (this.isCloud) {
        // Ollama Cloud: usa endpoint compatível com OpenAI
        return await this.generateCloud(prompt, options, startTime);
      } else {
        // Ollama Local: usa endpoint nativo
        return await this.generateLocal(prompt, options, startTime);
      }
    } catch (error: any) {
      logger.error('Ollama generation failed', {
        error: error.message,
        model: this.model,
        baseUrl: this.baseUrl,
        mode: this.isCloud ? 'cloud' : 'local'
      });
      throw error;
    }
  }

  /**
   * Geração usando Ollama Cloud (OpenAI-compatible API)
   */
  private async generateCloud(
    prompt: string,
    options: AIGenerationOptions,
    startTime: number
  ): Promise<AIResponse> {
    const systemPrompt = this.formatSystemPrompt(options.systemPrompt);

    const response = await axios.post(
      `${this.baseUrl}/v1/chat/completions`,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 360000  // 6 minutos para análises muito complexas
      }
    );

    const text = response.data.choices[0]?.message?.content || '';
    const tokensUsed = response.data.usage?.total_tokens || 0;
    const latency = Date.now() - startTime;

    logger.info('Ollama Cloud generation successful', {
      model: this.model,
      latency: `${latency}ms`,
      tokensUsed,
      textLength: text.length
    });

    return {
      text,
      provider: 'ollama',
      model: this.model,
      tokensUsed,
      cost: 0, // CLOUD - GRÁTIS!
      timestamp: new Date()
    };
  }

  /**
   * Geração usando Ollama Local (native API)
   */
  private async generateLocal(
    prompt: string,
    options: AIGenerationOptions,
    startTime: number
  ): Promise<AIResponse> {
    const systemPrompt = this.formatSystemPrompt(options.systemPrompt);
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

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
        timeout: 360000  // 6 minutos para análises muito complexas
      }
    );

    const text = response.data.response || '';
    const latency = Date.now() - startTime;

    logger.info('Ollama Local generation successful', {
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
  }

  async *generateStream(
    prompt: string,
    options: AIGenerationOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    try {
      if (!await this.isAvailable()) {
        throw new Error(
          this.isCloud
            ? 'Ollama Cloud requires API key'
            : `Ollama server not available at ${this.baseUrl}`
        );
      }

      if (this.isCloud) {
        yield* this.generateStreamCloud(prompt, options);
      } else {
        yield* this.generateStreamLocal(prompt, options);
      }
    } catch (error: any) {
      logger.error('Ollama streaming failed', {
        error: error.message,
        model: this.model,
        baseUrl: this.baseUrl,
        mode: this.isCloud ? 'cloud' : 'local'
      });
      throw error;
    }
  }

  /**
   * Streaming para Ollama Cloud (OpenAI-compatible)
   */
  private async *generateStreamCloud(
    prompt: string,
    options: AIGenerationOptions
  ): AsyncGenerator<string, void, unknown> {
    const systemPrompt = this.formatSystemPrompt(options.systemPrompt);

    logger.info('Ollama Cloud streaming started', {
      model: this.model
    });

    const response = await axios.post(
      `${this.baseUrl}/v1/chat/completions`,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        top_p: options.topP || 1,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000,  // 3 minutos para análises complexas
        responseType: 'stream'
      }
    );

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    logger.info('Ollama Cloud streaming completed', {
      model: this.model
    });
  }

  /**
   * Streaming para Ollama Local
   */
  private async *generateStreamLocal(
    prompt: string,
    options: AIGenerationOptions
  ): AsyncGenerator<string, void, unknown> {
    const systemPrompt = this.formatSystemPrompt(options.systemPrompt);
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    logger.info('Ollama Local streaming started', {
      model: this.model
    });

    const response = await axios.post(
      `${this.baseUrl}/api/generate`,
      {
        model: this.model,
        prompt: fullPrompt,
        stream: true,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1,
        num_predict: options.maxTokens || 4096
      },
      {
        timeout: 180000,  // 3 minutos para análises complexas
        responseType: 'stream'
      }
    );

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    logger.info('Ollama Local streaming completed', {
      model: this.model
    });
  }
}
