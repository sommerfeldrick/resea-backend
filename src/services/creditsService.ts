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

interface SmileAIPlanData {
  plan_name: string; // 'básico', 'standard', 'premium'
  is_active: boolean;
  purchase_date?: string; // Data de compra/ativação do plano
  renewal_date?: string; // Próxima renovação
}

interface CreditCheckResult {
  available: number;
  limit: number;
  consumed: number;
  canGenerate: boolean;
  planName: string;
  message?: string;
  needsRenewal?: boolean;
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
      const limit = this.getDocumentLimit(planName);

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
   * Mapeia nome do plano para limite de DOCUMENTOS por mês
   */
  getDocumentLimit(planName: string): number {
    const limits: Record<string, number> = {
      'básico': 0,
      'basico': 0,
      'basic': 0,
      'standard': 10,
      'premium': 20,
      'pro': 20,
      'enterprise': 50 // Bonus para enterprise
    };

    const normalized = planName.toLowerCase().trim();
    return limits[normalized] ?? 0; // Default: 0 documentos
  }

  /**
   * Normaliza nome do plano (padronização)
   */
  normalizePlanName(planName: string): string {
    const normalized = planName.toLowerCase().trim();

    // Mapeia variações para nomes padrão
    const mapping: Record<string, string> = {
      'básico': 'básico',
      'basico': 'básico',
      'basic': 'básico',
      'standard': 'standard',
      'premium': 'premium',
      'pro': 'premium',
      'enterprise': 'enterprise'
    };

    return mapping[normalized] || 'básico';
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
   * Busca dados do plano do usuário da SmileAI API (READ-ONLY)
   * Endpoint: GET /api/app/usage-data OU /api/user/plan
   */
  async getSmileAIPlanData(userId: string, accessToken: string): Promise<SmileAIPlanData | null> {
    try {
      const cacheKey = `plan:${userId}:smileai`;

      // Tenta cache primeiro (30 min TTL - planos mudam raramente)
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
        logger.debug(`SmileAI plan data cache HIT for user ${userId}`);
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }

      logger.info(`SmileAI plan data cache MISS for user ${userId}, fetching from API`);

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

      // Extrai dados do plano da resposta
      const planData: SmileAIPlanData = {
        plan_name: this.normalizePlanName(response.data.plan_name || 'básico'),
        is_active: response.data.is_active !== false, // Default true se não vier
        purchase_date: response.data.purchase_date || response.data.created_at,
        renewal_date: response.data.renewal_date || response.data.next_billing_date
      };

      const dataJson = JSON.stringify(planData);

      // Cacheia por 30 minutos (planos mudam raramente)
      const ttl = 1800;
      if (this.redis && this.isConnected) {
        try {
          await this.redis.setEx(cacheKey, ttl, dataJson);
        } catch (error) {
          this.setMemoryCache(cacheKey, dataJson, ttl);
        }
      } else {
        this.setMemoryCache(cacheKey, dataJson, ttl);
      }

      return planData;
    } catch (error: any) {
      logger.error(`Failed to fetch SmileAI plan data for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Inicializa tracking do usuário no PostgreSQL
   */
  async initializeUserTracking(
    userId: string,
    planName?: string,
    purchaseDate?: string
  ): Promise<void> {
    try {
      await query(`
        INSERT INTO resea_usage (
          user_id,
          words_consumed_today,
          plan_name,
          plan_purchase_date,
          last_reset_date,
          last_smileai_sync
        )
        VALUES ($1, 0, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          plan_name = COALESCE(EXCLUDED.plan_name, resea_usage.plan_name),
          plan_purchase_date = COALESCE(EXCLUDED.plan_purchase_date, resea_usage.plan_purchase_date),
          last_smileai_sync = NOW()
      `, [userId, planName || 'básico', purchaseDate || new Date().toISOString()]);

      logger.debug(`User tracking initialized for user ${userId} (plan: ${planName})`);
    } catch (error) {
      logger.error(`Failed to initialize user tracking for ${userId}:`, error);
    }
  }

  /**
   * Verifica se precisa resetar o contador mensal (30 dias desde purchase_date)
   */
  async checkAndResetMonthlyLimit(userId: string): Promise<boolean> {
    try {
      const result = await query(`
        SELECT
          plan_purchase_date,
          last_reset_date,
          words_consumed_today as documents_generated
        FROM resea_usage
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return false;
      }

      const row = result.rows[0];
      const purchaseDate = new Date(row.plan_purchase_date);
      const lastReset = row.last_reset_date ? new Date(row.last_reset_date) : purchaseDate;
      const now = new Date();

      // Calcula quantos meses se passaram desde a data de compra
      const monthsSincePurchase = this.getMonthsDifference(purchaseDate, now);
      const monthsSinceReset = this.getMonthsDifference(lastReset, now);

      // Se passou 1 mês ou mais desde o último reset, reseta o contador
      if (monthsSinceReset >= 1) {
        await query(`
          UPDATE resea_usage
          SET words_consumed_today = 0,
              last_reset_date = NOW()
          WHERE user_id = $1
        `, [userId]);

        logger.info(`Monthly limit reset for user ${userId} (last reset: ${lastReset.toISOString()})`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to check monthly reset for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Calcula diferença em meses entre duas datas
   */
  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    const dayDiff = endDate.getDate() - startDate.getDate();

    let months = yearDiff * 12 + monthDiff;

    // Se ainda não completou 30 dias no mês atual, não conta
    if (dayDiff < 0) {
      months--;
    }

    return months;
  }

  /**
   * Verifica se o usuário pode gerar documento baseado no plano
   * Nova lógica: Conta DOCUMENTOS ao invés de palavras
   * CHAMADO ANTES da geração
   */
  async checkCreditsAvailable(
    userId: string,
    accessToken: string,
    estimatedWords: number = 0 // Não usado mais, mas mantido para compatibilidade
  ): Promise<CreditCheckResult> {
    try {
      // 1. Busca dados do plano da SmileAI
      const planData = await this.getSmileAIPlanData(userId, accessToken);

      if (!planData) {
        // Fallback se API não responder
        logger.warn(`Could not fetch SmileAI plan data for user ${userId}, using basic plan`);
        return {
          available: 0,
          limit: 0,
          consumed: 0,
          canGenerate: false,
          planName: 'básico',
          message: 'SmileAI API indisponível. Por favor, tente novamente.'
        };
      }

      // 2. Verifica se o plano está ativo
      if (!planData.is_active) {
        return {
          available: 0,
          limit: 0,
          consumed: 0,
          canGenerate: false,
          planName: planData.plan_name,
          message: 'Seu plano está inativo. Por favor, renove sua assinatura.'
        };
      }

      // 3. Inicializa/atualiza tracking do usuário
      await this.initializeUserTracking(userId, planData.plan_name, planData.purchase_date);

      // 4. Verifica se precisa resetar contador mensal
      await this.checkAndResetMonthlyLimit(userId);

      // 5. Busca limite do plano e consumo atual
      const limit = this.getDocumentLimit(planData.plan_name);

      const result = await query(`
        SELECT words_consumed_today as documents_generated
        FROM resea_usage
        WHERE user_id = $1
      `, [userId]);

      const consumed = result.rows[0]?.documents_generated || 0;
      const available = Math.max(0, limit - consumed);

      // 6. Valida se pode gerar
      if (limit === 0) {
        return {
          available: 0,
          limit: 0,
          consumed: 0,
          canGenerate: false,
          planName: planData.plan_name,
          message: `Plano ${planData.plan_name} não permite gerar documentos. Faça upgrade para Standard ou Premium!`
        };
      }

      if (consumed >= limit) {
        return {
          available: 0,
          limit,
          consumed,
          canGenerate: false,
          planName: planData.plan_name,
          message: `Você atingiu o limite mensal de ${limit} documentos. Seu limite será renovado em ${this.getNextResetDate(planData.purchase_date)}.`,
          needsRenewal: true
        };
      }

      // Tudo OK!
      return {
        available,
        limit,
        consumed,
        canGenerate: true,
        planName: planData.plan_name,
        message: `Você pode gerar mais ${available} documentos este mês (plano ${planData.plan_name}).`
      };
    } catch (error) {
      logger.error(`Failed to check credits for user ${userId}:`, error);

      // Fallback em caso de erro: permite gerar mas loga o erro
      return {
        available: 0,
        limit: 0,
        consumed: 0,
        canGenerate: false,
        planName: 'erro',
        message: 'Erro ao verificar créditos. Por favor, tente novamente.'
      };
    }
  }

  /**
   * Calcula a próxima data de reset (30 dias após purchase_date)
   */
  private getNextResetDate(purchaseDate?: string): string {
    if (!purchaseDate) {
      return 'em breve';
    }

    const purchase = new Date(purchaseDate);
    const now = new Date();
    const monthsSince = this.getMonthsDifference(purchase, now);

    const nextReset = new Date(purchase);
    nextReset.setMonth(nextReset.getMonth() + monthsSince + 1);

    const daysUntil = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntil === 1 ? '1 dia' : `${daysUntil} dias`;
  }

  /**
   * Registra geração de DOCUMENTO (incrementa contador)
   * Nova lógica: Conta documentos ao invés de palavras
   * IMPORTANTE: Só chamar quando documento for FINALIZADO!
   */
  async trackDocumentGeneration(
    userId: string,
    wordCount: number, // Mantido para registro no histórico
    documentId: number,
    metadata?: any
  ): Promise<void> {
    try {
      // 1. Incrementa contador de DOCUMENTOS (words_consumed_today agora conta documentos)
      await query(`
        UPDATE resea_usage
        SET words_consumed_today = words_consumed_today + 1,
            updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      // 2. Salva no histórico (mantém word_count para referência)
      await query(`
        INSERT INTO credit_history (user_id, document_id, words_used, action, metadata)
        VALUES ($1, $2, $3, 'document_generation', $4)
      `, [userId, documentId, wordCount, JSON.stringify(metadata || {})]);

      // 3. Invalida cache Redis do plano (forçar nova consulta)
      const cacheKey = `plan:${userId}:smileai`;

      if (this.redis && this.isConnected) {
        try {
          await this.redis.del(cacheKey);
        } catch (error) {
          this.deleteMemoryCache(cacheKey);
        }
      } else {
        this.deleteMemoryCache(cacheKey);
      }

      logger.info(`Tracked document generation for user ${userId}: 1 document (${wordCount} words, ID: ${documentId})`);
    } catch (error) {
      logger.error(`Failed to track document generation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * @deprecated Este método foi removido na versão 2.0
   *
   * Motivo: O sistema agora conta DOCUMENTOS por mês (não palavras),
   * com renovação automática baseada na data de compra do plano.
   *
   * A sincronização com SmileAI agora acontece automaticamente via:
   * - checkCreditsAvailable() - Verifica plano antes de gerar documento
   * - checkAndResetMonthlyLimit() - Reseta contador mensalmente
   * - getSmileAIPlanData() - Lê dados do plano da SmileAI
   *
   * Não é mais necessário detectar "compras de créditos" porque o sistema
   * é baseado em limites mensais fixos por plano, não em saldo de palavras.
   */
  async syncWithSmileAI(userId: string, accessToken: string): Promise<void> {
    logger.warn('syncWithSmileAI() is deprecated and does nothing. Use checkCreditsAvailable() instead.');
    return;
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
   * Retorna estatísticas completas de créditos
   * Nova lógica: Baseado em DOCUMENTOS gerados por mês
   */
  async getCreditStats(userId: string, accessToken?: string) {
    try {
      // Busca dados do plano da SmileAI
      let planData: SmileAIPlanData | null = null;

      if (accessToken) {
        planData = await this.getSmileAIPlanData(userId, accessToken);
      }

      if (!planData) {
        // Fallback: plano básico
        return {
          plan: 'básico',
          limit: 0,
          consumed: 0,
          remaining: 0,
          percentage: 0,
          is_active: false,
          next_reset: 'Nenhum plano ativo',
          message: 'Faça upgrade para gerar documentos!'
        };
      }

      // Inicializa tracking
      await this.initializeUserTracking(userId, planData.plan_name, planData.purchase_date);

      // Verifica/reseta limite mensal
      await this.checkAndResetMonthlyLimit(userId);

      // Busca dados locais
      const result = await query(`
        SELECT
          words_consumed_today as documents_generated,
          plan_name,
          plan_purchase_date,
          last_reset_date
        FROM resea_usage
        WHERE user_id = $1
      `, [userId]);

      const consumed = result.rows[0]?.documents_generated || 0;
      const currentPlan = result.rows[0]?.plan_name || planData.plan_name;
      const limit = this.getDocumentLimit(currentPlan);
      const remaining = Math.max(0, limit - consumed);
      const percentage = limit > 0 ? Math.round((consumed / limit) * 100) : 0;

      return {
        plan: currentPlan,
        limit,
        consumed,
        remaining,
        percentage,
        is_active: planData.is_active,
        next_reset: this.getNextResetDate(planData.purchase_date),
        purchase_date: planData.purchase_date,
        message: remaining > 0
          ? `Você pode gerar mais ${remaining} documentos este mês.`
          : limit === 0
          ? 'Seu plano não permite gerar documentos. Faça upgrade!'
          : `Limite mensal atingido. Renova em ${this.getNextResetDate(planData.purchase_date)}.`
      };
    } catch (error) {
      logger.error(`Failed to get credit stats for user ${userId}:`, error);

      // Fallback completo
      return {
        plan: 'erro',
        limit: 0,
        consumed: 0,
        remaining: 0,
        percentage: 0,
        is_active: false,
        next_reset: 'Erro ao buscar dados',
        message: 'Erro ao buscar estatísticas. Tente novamente.'
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
