/**
 * OpenRouter Service
 * Base service for all AI interactions using OpenRouter API
 * Model: minimax/minimax-m2:free
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/simple-logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class OpenRouterService {
  private client: AxiosInstance;
  private logger: Logger;
  private apiKey: string;
  private defaultModel: string = 'minimax/minimax-m2:free';
  private siteUrl: string = 'https://smileai.com.br';
  private siteName: string = 'SmileAI';

  constructor() {
    this.logger = new Logger('OpenRouterService');

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      this.logger.error('OPENROUTER_API_KEY not set in environment');
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.apiKey = apiKey;

    // Initialize HTTP client
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
        'Content-Type': 'application/json',
      },
    });

    this.logger.info('OpenRouter service initialized');
  }

  /**
   * Chat completion (main method)
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    try {
      const requestBody = {
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000,
      };

      this.logger.debug(`Chat completion request: ${messages.length} messages`);

      const response = await this.client.post('/chat/completions', requestBody);

      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      return content.trim();
    } catch (error: any) {
      this.logger.error(`Chat completion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Simple prompt completion
   */
  async complete(prompt: string, options: ChatCompletionOptions = {}): Promise<string> {
    return this.chatCompletion(
      [{ role: 'user', content: prompt }],
      options
    );
  }

  /**
   * Generate embedding (using text-embedding-3-small via OpenRouter)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate to avoid token limits (~8000 tokens = ~32k chars)
      const truncated = text.substring(0, 32000);

      this.logger.debug('Generating embedding');

      const response = await this.client.post('/embeddings', {
        model: 'text-embedding-3-small',
        input: truncated,
      });

      const embedding = response.data.data[0]?.embedding;

      if (!embedding) {
        throw new Error('No embedding in response');
      }

      return embedding;
    } catch (error: any) {
      this.logger.error(`Embedding generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings in batch
   */
  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches of 100
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100).map(t => t.substring(0, 32000));

      try {
        const response = await this.client.post('/embeddings', {
          model: 'text-embedding-3-small',
          input: batch,
        });

        const batchEmbeddings = response.data.data.map((d: any) => d.embedding);
        embeddings.push(...batchEmbeddings);

        this.logger.info(`Embedded batch ${Math.floor(i / 100) + 1}/${Math.ceil(texts.length / 100)}`);
      } catch (error: any) {
        this.logger.error(`Batch embedding failed: ${error.message}`);
        // Continue with empty embeddings for failed batch
        embeddings.push(...new Array(batch.length).fill([]));
      }
    }

    return embeddings;
  }

  /**
   * Get available models
   */
  async getModels(): Promise<any[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data || [];
    } catch (error: any) {
      this.logger.error(`Failed to get models: ${error.message}`);
      return [];
    }
  }

  /**
   * Set custom model
   */
  setModel(model: string): void {
    this.defaultModel = model;
    this.logger.info(`Model changed to: ${model}`);
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.defaultModel;
  }
}
