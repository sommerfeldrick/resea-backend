import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { logger } from '../config/logger.js';

interface UserPlan {
  name: string;
  limit: number;
}

export class CreditsService {
  private redis: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Too many reconnection attempts');
            return new Error('Redis connection failed');
          }
          return retries * 100;
        }
      }
    });

    this.redis.on('error', (err) => logger.error('Redis Client Error', err));
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.redis.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  /**
   * Busca o plano do usuário da API SmileAI ou cache
   */
  async getUserPlan(userId: string): Promise<UserPlan> {
    try {
      const cacheKey = `user_plan:${userId}`;

      // Tenta cache primeiro (TTL: 5 minutos)
      const cached = await this.redis.get(cacheKey);
      if (cached && typeof cached === 'string') {
        logger.info(`User plan cache HIT for user ${userId}`);
        return JSON.parse(cached);
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

      // Cacheia por 5 minutos
      await this.redis.setEx(cacheKey, 300, JSON.stringify(plan));

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
   * Busca palavras consumidas pelo usuário (armazenadas no Redis)
   */
  async getConsumedWords(userId: string): Promise<number> {
    try {
      const key = `consumed_words:${userId}`;
      const consumed = await this.redis.get(key);
      return parseInt((consumed as string) || '0', 10);
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

      // Incrementa consumo
      await this.redis.incrBy(key, wordCount);

      // Define expiração de 30 dias (reseta mensalmente)
      await this.redis.expire(key, 30 * 24 * 60 * 60);

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
      await this.redis.del(key);
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
