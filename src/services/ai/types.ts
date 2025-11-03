/**
 * AI Service Types and Interfaces
 */

export type AIProvider = 'gemini' | 'groq' | 'ollama' | 'deepseek' | 'openai';

export interface AIGenerationOptions {
  provider?: AIProvider;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  tokensUsed?: number;
  cost?: number;
  model?: string;
  timestamp: Date;
}

export interface ProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerDay: number;
    tokensPerMinute: number;
  };
}

export interface ProviderStats {
  provider: AIProvider;
  enabled: boolean;
  model?: string;
  requestsToday: number;
  tokensUsedToday: number;
  costToday: number;
  lastUsed?: Date;
}

export interface AIServiceConfig {
  activeProvider: AIProvider;
  fallbackOrder: AIProvider[];
  configs: Record<AIProvider, ProviderConfig>;
}
