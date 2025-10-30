import { authService } from './authService';

interface CreditOperation {
  credits: number;
  timestamp: number;
  attempts: number;
}

class CreditService {
  private readonly QUEUE_KEY = 'credit_sync_queue';
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 segundo

  async synchronizeCredits(usedCredits: number): Promise<void> {
    try {
      await authService.apiRequest('/api/credits/sync', {
        method: 'POST',
        body: JSON.stringify({ 
          credits_used: usedCredits,
          domain: window.location.hostname,
          timestamp: new Date().toISOString()
        })
      });
      
      // Força atualização do cache local
      await authService.getCurrentUser();
      
    } catch (error) {
      console.error('Falha na sincronização de créditos:', error);
      this.queueForRetry({ credits: usedCredits });
    }
  }
  
  private queueForRetry(operation: {credits: number}): void {
    const queue = this.getQueue();
    queue.push({
      ...operation,
      timestamp: Date.now(),
      attempts: 0
    });
    this.saveQueue(queue);
    this.processQueue(); // Tenta processar a fila imediatamente
  }
  
  private async processQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;
    
    const operation = queue[0];
    try {
      await authService.apiRequest('/api/credits/sync', {
        method: 'POST',
        body: JSON.stringify({ 
          credits_used: operation.credits,
          domain: window.location.hostname,
          timestamp: new Date().toISOString()
        })
      });

      // Se sucesso, remove da fila
      queue.shift();
      this.saveQueue(queue);
      
      // Limpa o cache e força atualização do usuário
      (authService as any).clearCache('currentUser');
      await authService.getCurrentUser();
    } catch (error) {
      operation.attempts++;
      if (operation.attempts < this.MAX_RETRIES) {
        // Atualiza tentativas na fila
        this.saveQueue(queue);
        // Agenda nova tentativa com backoff exponencial
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, operation.attempts);
        setTimeout(() => this.processQueue(), delay);
      } else {
        // Remove da fila após máximo de tentativas
        queue.shift();
        this.saveQueue(queue);
        console.error('Máximo de tentativas excedido para sincronização de créditos');
      }
    }
  }

  private getQueue(): CreditOperation[] {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private saveQueue(queue: CreditOperation[]): void {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  // Método para iniciar processamento da fila periodicamente
  startQueueProcessor(): void {
    setInterval(() => this.processQueue(), 60000); // Tenta a cada minuto
  }
}

export const creditService = new CreditService();
creditService.startQueueProcessor(); // Inicia o processamento da fila
