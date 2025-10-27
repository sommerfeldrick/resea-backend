import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { logger } from '../config/logger.js';

interface UserPlan {
  name: string;
  limit: number;
}

export class CreditsService {
  private redis: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();

  constructor() {
    // Tenta inicializar Redis, mas não falha se não conseguir
    try {
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.warn('Redis: Too many reconnection attempts, falling back to memory cache');
              return false; // Para de tentar reconectar
            }
            return retries * 100;
          }
        }
      });

      this.redis.on('error', (err) => {
        logger.warn('Redis Client Error (usando cache em memória):', err.message);
        this.redis = null; // Desabilita Redis em caso de erro
      });

      this.redis.on('connect', () => {
        logger.info('✅ Redis connected successfully');
        this.isConnected = true;
      });
    } catch (error) {
      logger.warn('Redis não disponível, usando cache em memória');
      this.redis = null;
    }
  }

  async connect(): Promise<void> {
    if (this.redis && !this.isConnected) {
      try {
        await this.redis.connect();
      } catch (error) {
        logger.warn('Falha ao conectar Redis, usando cache em memória');
        this.redis = null;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        await this.redis.quit();
        this.isConnected = false;
      } catch (error) {
        logger.error('Error disconnecting Redis:', error);
      }
    }
  }

  // Métodos auxiliares para cache em memória
  private setMemoryCache(key: string, value: any, ttlSeconds: number): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { value, expiry });
  }

  private getMemoryCache(key: string): any | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value;
  }

  private deleteMemoryCache(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * Busca o plano do usuário da API SmileAI ou cache
   */
  async getUserPlan(userId: string): Promise<UserPlan> {
    try {
      const cacheKey = `user_plan:${userId}`;

      // Tenta cache primeiro (Redis ou memória)
      let cached: string | null = null;

      if (this.redis && this.isConnected) {
        try {
          cached = await this.redis.get(cacheKey) as string | null;
        } catch (error) {
          logger.warn('Redis get failed, trying memory cache');
          cached = this.getMemoryCache(cacheKey);
        }
      } else {
        cached = this.getMemoryCache(cacheKey);
      }

      if (cached) {
        logger.info(`User plan cache HIT for user ${userId}`);
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }

      logger.info(`User plan cache MISS for user ${userId}, fetching from API`);

      // Busca da API SmileAI
      const response = await axios.get(
        `${process.env.SMILEAI_API_URL || 'https://smileai.com.br/api'}/users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.SMILEAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      const planName = response.data.subscription_plan || 'free';
      const limit = this.getWordLimit(planName);

      const plan: UserPlan = { name: planName, limit };
      const planJson = JSON.stringify(plan);

      // Cacheia por 5 minutos (Redis ou memória)
      if (this.redis && this.isConnected) {
        try {
          await this.redis.setEx(cacheKey, 300, planJson);
        } catch (error) {
          logger.warn('Redis set failed, using memory cache');
          this.setMemoryCache(cacheKey, planJson, 300);
        }
      } else {
        this.setMemoryCache(cacheKey, planJson, 300);
      }

      return plan;
    } catch (error) {
      logger.error(`Failed to fetch user plan for ${userId}:`, error);
      // Fallback para plano free
      return { name: 'free', limit: 10000 };
    }
  }

  /**
   * Mapeia nome do plano para limite de palavras
   */
  getWordLimit(planName: string): number {
    const limits: Record<string, number> = {
      'free': 10000,
      'starter': 50000,
      'basic': 100000,
      'pro': 250000,
      'premium': 500000,
      'business': 1000000,
      'enterprise': 5000000
    };

    const normalized = planName.toLowerCase().trim();
    return limits[normalized] || 10000;
  }

  /**
   * Busca palavras consumidas pelo usuário (armazenadas no Redis ou memória)
   */
  async getConsumedWords(userId: string): Promise<number> {
    try {
      const key = `consumed_words:${userId}`;
      let consumed: string | null = null;

      if (this.redis && this.isConnected) {
        try {
          consumed = await this.redis.get(key) as string | null;
        } catch (error) {
          logger.warn('Redis get failed, trying memory cache');
          consumed = this.getMemoryCache(key);
        }
      } else {
        consumed = this.getMemoryCache(key);
      }

      return parseInt(consumed || '0', 10);
    } catch (error) {
      logger.error(`Failed to get consumed words for ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Calcula palavras restantes
   */
  async getRemainingWords(userId: string): Promise<number> {
    const plan = await this.getUserPlan(userId);
    const consumed = await this.getConsumedWords(userId);
    return Math.max(0, plan.limit - consumed);
  }

  /**
   * Incrementa o consumo de palavras após finalizar documento
   * IMPORTANTE: Só deve ser chamado quando o usuário FINALIZA o documento!
   */
  async incrementUsage(userId: string, wordCount: number): Promise<number> {
    try {
      const key = `consumed_words:${userId}`;

      if (this.redis && this.isConnected) {
        try {
          // Incrementa consumo no Redis
          await this.redis.incrBy(key, wordCount);
          await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 dias
        } catch (error) {
          logger.warn('Redis increment failed, using memory cache');
          // Fallback para memória
          const current = parseInt(this.getMemoryCache(key) || '0', 10);
          const newValue = current + wordCount;
          this.setMemoryCache(key, newValue.toString(), 30 * 24 * 60 * 60);
        }
      } else {
        // Usa cache em memória
        const current = parseInt(this.getMemoryCache(key) || '0', 10);
        const newValue = current + wordCount;
        this.setMemoryCache(key, newValue.toString(), 30 * 24 * 60 * 60);
      }

      logger.info(`User ${userId} consumed ${wordCount} words`);

      // Retorna palavras restantes
      return await this.getRemainingWords(userId);
    } catch (error) {
      logger.error(`Failed to increment usage for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reseta o consumo de um usuário (admin only)
   */
  async resetUsage(userId: string): Promise<void> {
    try {
      const key = `consumed_words:${userId}`;

      if (this.redis && this.isConnected) {
        try {
          await this.redis.del(key);
        } catch (error) {
          logger.warn('Redis delete failed, clearing from memory cache');
          this.deleteMemoryCache(key);
        }
      } else {
        this.deleteMemoryCache(key);
      }

      logger.info(`Usage reset for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to reset usage for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Retorna estatísticas completas de créditos
   */
  async getCreditStats(userId: string) {
    const plan = await this.getUserPlan(userId);
    const consumed = await this.getConsumedWords(userId);
    const remaining = Math.max(0, plan.limit - consumed);
    const percentage = plan.limit > 0 ? Math.round((consumed / plan.limit) * 100) : 0;

    return {
      plan: plan.name,
      limit: plan.limit,
      consumed,
      remaining,
      percentage
    };
  }
}

// Singleton instance
export const creditsService = new CreditsService();
