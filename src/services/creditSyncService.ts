/**
 * Backend Credit Sync Service
 * 
 * Serviço de sincronização de créditos para o backend usando Redis como fila
 */

import { logger } from '../config/logger.js';
import { creditsService } from './creditsService.js';
import axios from 'axios';

interface CreditOperation {
  userId: string;
  credits: number;
  timestamp: number;
  attempts: number;
}

class CreditSyncService {
  private readonly QUEUE_KEY = 'credit_sync_queue';
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 segundo
  private readonly SYNC_INTERVAL = 60000; // 1 minuto
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Inicia o processamento da fila
    this.startQueueProcessor();
  }

  /**
   * Adiciona uma operação de crédito à fila de sincronização
   */
  async queueCreditSync(userId: string, credits: number): Promise<void> {
    try {
      const operation: CreditOperation = {
        userId,
        credits,
        timestamp: Date.now(),
        attempts: 0
      };

      // Adiciona à fila no Redis
      const queue = await this.getQueue();
      queue.push(operation);
      await this.saveQueue(queue);

      logger.info(`Credit sync operation queued for user ${userId}:`, {
        credits,
        queueSize: queue.length
      });

      // Tenta processar a fila imediatamente
      this.processQueue();
    } catch (error) {
      logger.error('Failed to queue credit sync:', error);
      // Se falhar ao salvar na fila, pelo menos tenta sincronizar diretamente
      this.syncCredits(userId, credits).catch(err => 
        logger.error('Failed to sync credits directly:', err)
      );
    }
  }

  /**
   * Sincroniza os créditos com a API SmileAI
   */
  private async syncCredits(userId: string, credits: number): Promise<void> {
    try {
      await axios.post(
        `${process.env.SMILEAI_API_URL}/credits/sync`,
        {
          user_id: userId,
          credits_used: credits,
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.SMILEAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      logger.info(`Credits synced successfully for user ${userId}`);

      // Limpa o cache do plano do usuário para forçar atualização
      await creditsService.resetUsage(userId);

    } catch (error) {
      logger.error(`Failed to sync credits for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém a fila de operações do Redis
   */
  private async getQueue(): Promise<CreditOperation[]> {
    try {
      if (!creditsService['redis'] || !creditsService['isConnected']) {
        return [];
      }

      const queue = await creditsService['redis'].get(this.QUEUE_KEY) as string | null;
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      logger.error('Failed to get credit sync queue:', error);
      return [];
    }
  }

  /**
   * Salva a fila de operações no Redis
   */
  private async saveQueue(queue: CreditOperation[]): Promise<void> {
    try {
      if (!creditsService['redis'] || !creditsService['isConnected']) {
        return;
      }

      await creditsService['redis'].set(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      logger.error('Failed to save credit sync queue:', error);
    }
  }

  /**
   * Processa a fila de operações
   */
  private async processQueue(): Promise<void> {
    try {
      const queue = await this.getQueue();
      if (queue.length === 0) return;

      const operation = queue[0];

      try {
        await this.syncCredits(operation.userId, operation.credits);
        // Se sucesso, remove da fila
        queue.shift();
        await this.saveQueue(queue);

        logger.info('Credit sync operation processed successfully');

      } catch (error) {
        operation.attempts++;
        if (operation.attempts < this.MAX_RETRIES) {
          // Atualiza tentativas na fila
          await this.saveQueue(queue);
          // Agenda nova tentativa com backoff exponencial
          const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, operation.attempts);
          setTimeout(() => this.processQueue(), delay);

          logger.warn(`Credit sync retry scheduled in ${delay}ms`, {
            attempt: operation.attempts,
            userId: operation.userId
          });

        } else {
          // Remove da fila após máximo de tentativas
          queue.shift();
          await this.saveQueue(queue);
          
          logger.error('Maximum retries exceeded for credit sync operation', {
            userId: operation.userId,
            credits: operation.credits
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process credit sync queue:', error);
    }
  }

  /**
   * Inicia o processamento periódico da fila
   */
  private startQueueProcessor(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(
      () => this.processQueue(),
      this.SYNC_INTERVAL
    );

    logger.info('Credit sync queue processor started');
  }

  /**
   * Para o processamento da fila (usado em testes ou shutdown)
   */
  stopQueueProcessor(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Credit sync queue processor stopped');
    }
  }
}

// Singleton instance
export const creditSyncService = new CreditSyncService();
export default creditSyncService;
