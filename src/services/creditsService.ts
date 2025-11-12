import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { logger } from '../config/logger.js';
import { query } from '../config/database.js';

interface UserPlan {
  name: string;
  limit: number;
}

interface SmileAIUsageData {
  plan_name: string;
  remaining_words: number;
  total_words: number;
}

interface CreditCheckResult {
  available: number;
  smileaiRemaining: number;
  localConsumed: number;
  canGenerate: boolean;
  message?: string;
}

export class CreditsService {
  private redis: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private redisInitialized: boolean = false;

  constructor() {
    // Tenta inicializar Redis apenas se explicitamente habilitado
    if (process.env.REDIS_ENABLED === 'true') {
      this.initializeRedis();
    } else {
      logger.info('ℹ️  Redis desabilitado - usando cache em memória');
    }
  }

  private initializeRedis(): void {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000
        }
      });

      this.redis.on('error', (err) => {
        logger.debug('Redis connection error (falling back to memory cache):', err.message);
        this.redis = null;
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        logger.info('✅ Redis conectado com sucesso');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        logger.debug('Redis pronto para uso');
      });

      this.redisInitialized = true;
    } catch (error) {
      logger.debug('Erro ao inicializar Redis (usando cache em memória)');
      this.redis = null;
      this.redisInitialized = false;
    }
  }

  async connect(): Promise<void> {
    if (this.redis && !this.isConnected && this.redisInitialized) {
      try {
        await this.redis.connect();
      } catch (error) {
        logger.debug('Não foi possível conectar ao Redis - usando cache em memória');
        this.redis = null;
        this.isConnected = false;
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
   * Busca dados de uso da SmileAI API (READ-ONLY)
   * Endpoint: GET /api/app/usage-data
   */
  async getSmileAIUsageData(userId: string, accessToken: string): Promise<SmileAIUsageData | null> {
    try {
      const cacheKey = `credits:${userId}:smileai`;

      // Tenta cache primeiro
      let cached: string | null = null;

      if (this.redis && this.isConnected) {
        try {
          cached = await this.redis.get(cacheKey) as string | null;
        } catch (error) {
          cached = this.getMemoryCache(cacheKey);
        }
      } else {
        cached = this.getMemoryCache(cacheKey);
      }

      if (cached) {
        logger.debug(`SmileAI usage data cache HIT for user ${userId}`);
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }

      logger.info(`SmileAI usage data cache MISS for user ${userId}, fetching from API`);

      // Busca da API SmileAI
      const response = await axios.get(
        `${process.env.MAIN_DOMAIN_API || 'https://smileai.com.br'}/api/app/usage-data`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      const usageData: SmileAIUsageData = {
        plan_name: response.data.plan_name || 'free',
        remaining_words: response.data.remaining_words || 0,
        total_words: response.data.total_words || 10000
      };

      const dataJson = JSON.stringify(usageData);

      // Cacheia por 5 minutos
      if (this.redis && this.isConnected) {
        try {
          await this.redis.setEx(cacheKey, 300, dataJson);
        } catch (error) {
          this.setMemoryCache(cacheKey, dataJson, 300);
        }
      } else {
        this.setMemoryCache(cacheKey, dataJson, 300);
      }

      return usageData;
    } catch (error: any) {
      logger.error(`Failed to fetch SmileAI usage data for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Inicializa tracking do usuário no PostgreSQL
   */
  async initializeUserTracking(userId: string): Promise<void> {
    try {
      await query(`
        INSERT INTO resea_usage (user_id, words_consumed_today, last_smileai_sync)
        VALUES ($1, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);

      logger.debug(`User tracking initialized for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to initialize user tracking for ${userId}:`, error);
    }
  }

  /**
   * Verifica se o usuário tem créditos suficientes antes de gerar documento
   * CHAMADO ANTES da geração
   */
  async checkCreditsAvailable(
    userId: string,
    accessToken: string,
    estimatedWords: number
  ): Promise<CreditCheckResult> {
    try {
      // 1. Busca saldo da SmileAI (com cache)
      const smileaiData = await this.getSmileAIUsageData(userId, accessToken);

      if (!smileaiData) {
        // Se não conseguiu dados da SmileAI, permite gerar (fallback)
        logger.warn(`Could not fetch SmileAI data for user ${userId}, allowing generation`);
        return {
          available: 10000,
          smileaiRemaining: 10000,
          localConsumed: 0,
          canGenerate: true,
          message: 'SmileAI API unavailable, using default limit'
        };
      }

      const smileaiRemaining = smileaiData.remaining_words;

      // 2. Busca consumo local do Resea HOJE
      await this.initializeUserTracking(userId);

      const result = await query(`
        SELECT words_consumed_today
        FROM resea_usage
        WHERE user_id = $1
          AND DATE(last_smileai_sync) = CURRENT_DATE
      `, [userId]);

      const localConsumed = result.rows[0]?.words_consumed_today || 0;

      // 3. Calcula saldo disponível
      const available = Math.max(0, smileaiRemaining - localConsumed);

      // 4. Valida
      if (available < estimatedWords) {
        return {
          available,
          smileaiRemaining,
          localConsumed,
          canGenerate: false,
          message: `Créditos insuficientes. Disponível: ${available} palavras, Necessário: ${estimatedWords} palavras`
        };
      }

      return {
        available,
        smileaiRemaining,
        localConsumed,
        canGenerate: true
      };
    } catch (error) {
      logger.error(`Failed to check credits for user ${userId}:`, error);
      // Em caso de erro, permite gerar (fallback)
      return {
        available: 10000,
        smileaiRemaining: 10000,
        localConsumed: 0,
        canGenerate: true,
        message: 'Credit check failed, using default limit'
      };
    }
  }

  /**
   * Registra consumo de palavras DEPOIS de gerar documento
   * IMPORTANTE: Só chamar quando documento for FINALIZADO!
   */
  async trackDocumentGeneration(
    userId: string,
    wordCount: number,
    documentId: number,
    metadata?: any
  ): Promise<void> {
    try {
      // 1. Incrementa consumo local
      await query(`
        UPDATE resea_usage
        SET words_consumed_today = words_consumed_today + $1,
            updated_at = NOW()
        WHERE user_id = $2
      `, [wordCount, userId]);

      // 2. Salva no histórico
      await query(`
        INSERT INTO credit_history (user_id, document_id, words_used, action, metadata)
        VALUES ($1, $2, $3, 'document_generation', $4)
      `, [userId, documentId, wordCount, JSON.stringify(metadata || {})]);

      // 3. Invalida cache Redis para forçar nova consulta na SmileAI
      const cacheKey = `credits:${userId}:smileai`;

      if (this.redis && this.isConnected) {
        try {
          await this.redis.del(cacheKey);
        } catch (error) {
          this.deleteMemoryCache(cacheKey);
        }
      } else {
        this.deleteMemoryCache(cacheKey);
      }

      logger.info(`Tracked document generation for user ${userId}: ${wordCount} words (document ${documentId})`);
    } catch (error) {
      logger.error(`Failed to track document generation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Sincroniza dados com SmileAI (detecta compras de créditos)
   * Deve ser executado periodicamente (cron job)
   */
  async syncWithSmileAI(userId: string, accessToken: string): Promise<void> {
    try {
      const smileaiData = await this.getSmileAIUsageData(userId, accessToken);

      if (!smileaiData) {
        logger.warn(`Sync failed: Could not fetch SmileAI data for user ${userId}`);
        return;
      }

      const result = await query(`
        SELECT smileai_remaining_words
        FROM resea_usage
        WHERE user_id = $1
      `, [userId]);

      const currentCache = result.rows[0]?.smileai_remaining_words || 0;

      // Se saldo da SmileAI aumentou (comprou créditos), reseta contador local
      if (smileaiData.remaining_words > currentCache) {
        await query(`
          UPDATE resea_usage
          SET words_consumed_today = 0,
              smileai_remaining_words = $1,
              last_smileai_sync = NOW()
          WHERE user_id = $2
        `, [smileaiData.remaining_words, userId]);

        logger.info(`User ${userId} credits reset - SmileAI balance increased from ${currentCache} to ${smileaiData.remaining_words}`);
      } else {
        // Apenas atualiza cache
        await query(`
          UPDATE resea_usage
          SET smileai_remaining_words = $1,
              last_smileai_sync = NOW()
          WHERE user_id = $2
        `, [smileaiData.remaining_words, userId]);
      }
    } catch (error) {
      logger.error(`Sync with SmileAI failed for user ${userId}:`, error);
    }
  }

  /**
   * Retorna histórico de uso do usuário
   */
  async getCreditHistory(userId: string, limit: number = 50) {
    try {
      const result = await query(`
        SELECT
          ch.id,
          ch.words_used,
          ch.action,
          ch.metadata,
          ch.created_at,
          gd.title as document_title,
          gd.document_type
        FROM credit_history ch
        LEFT JOIN generated_documents gd ON ch.document_id = gd.id
        WHERE ch.user_id = $1
        ORDER BY ch.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      logger.error(`Failed to get credit history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Retorna estatísticas completas de créditos (HÍBRIDO: SmileAI + Local)
   */
  async getCreditStats(userId: string, accessToken?: string) {
    try {
      // Se tiver accessToken, busca dados atualizados da SmileAI
      let smileaiData: SmileAIUsageData | null = null;

      if (accessToken) {
        smileaiData = await this.getSmileAIUsageData(userId, accessToken);
      }

      // Busca consumo local
      await this.initializeUserTracking(userId);

      const result = await query(`
        SELECT words_consumed_today, smileai_remaining_words
        FROM resea_usage
        WHERE user_id = $1
      `, [userId]);

      const localConsumed = result.rows[0]?.words_consumed_today || 0;

      if (smileaiData) {
        // Dados em tempo real da SmileAI
        const available = Math.max(0, smileaiData.remaining_words - localConsumed);
        const percentage = smileaiData.total_words > 0
          ? Math.round(((smileaiData.total_words - available) / smileaiData.total_words) * 100)
          : 0;

        return {
          plan: smileaiData.plan_name,
          limit: smileaiData.total_words,
          consumed: smileaiData.total_words - smileaiData.remaining_words,
          remaining: available,
          percentage,
          resea_consumed_today: localConsumed,
          smileai_remaining: smileaiData.remaining_words
        };
      } else {
        // Fallback: usa dados em cache
        const cachedRemaining = result.rows[0]?.smileai_remaining_words || 10000;
        const available = Math.max(0, cachedRemaining - localConsumed);

        return {
          plan: 'unknown',
          limit: 10000,
          consumed: localConsumed,
          remaining: available,
          percentage: 0,
          resea_consumed_today: localConsumed,
          smileai_remaining: cachedRemaining
        };
      }
    } catch (error) {
      logger.error(`Failed to get credit stats for user ${userId}:`, error);
      // Fallback completo
      return {
        plan: 'free',
        limit: 10000,
        consumed: 0,
        remaining: 10000,
        percentage: 0,
        resea_consumed_today: 0,
        smileai_remaining: 10000
      };
    }
  }
}

// Singleton instance
export const creditsService = new CreditsService();

// Conecta ao Redis se disponível
creditsService.connect()
  .then(() => logger.info('✅ Credits service initialized'))
  .catch(err => logger.warn('⚠️ Credits service will use memory cache:', err.message));
