/**
 * Serviço de Gestão de Créditos
 *
 * Integrado com API do backend para gerenciar consumo de palavras
 */

import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface WordsUsage {
  totalWords: number;
  consumedWords: number;
  remainingWords: number;
  packageName: string;
  percentage?: number;
  lastUpdated: Date;
}

interface CreditStatsResponse {
  success: boolean;
  plan: string;
  limit: number;
  consumed: number;
  remaining: number;
  percentage: number;
}

class CreditService {
  private cache: WordsUsage | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 segundos

  /**
   * Obter token de autenticação
   */
  private getAuthToken(): string | null {
    return authService.getToken();
  }

  /**
   * Buscar estatísticas de créditos da API
   */
  async fetchCredits(): Promise<WordsUsage> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch(`${API_BASE_URL}/api/research/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CreditStatsResponse = await response.json();

      const usage: WordsUsage = {
        totalWords: data.limit,
        consumedWords: data.consumed,
        remainingWords: data.remaining,
        packageName: data.plan,
        percentage: data.percentage,
        lastUpdated: new Date()
      };

      // Atualiza cache
      this.cache = usage;
      this.cacheTime = Date.now();

      return usage;
    } catch (error) {
      console.error('Erro ao buscar créditos:', error);

      // Fallback: retorna cache se disponível
      if (this.cache) {
        return this.cache;
      }

      // Fallback final: retorna valores padrão
      return {
        totalWords: 10000,
        consumedWords: 0,
        remainingWords: 10000,
        packageName: 'free',
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Obter uso de palavras (com cache)
   */
  async getWordsUsage(): Promise<WordsUsage> {
    // Retorna cache se ainda válido
    const now = Date.now();
    if (this.cache && (now - this.cacheTime) < this.CACHE_DURATION) {
      return this.cache;
    }

    // Busca da API
    return await this.fetchCredits();
  }

  /**
   * Obter uso de palavras de forma síncrona (usa cache)
   */
  getWordsUsageSync(): WordsUsage {
    if (this.cache) {
      return this.cache;
    }

    // Se não tem cache, retorna valores padrão e busca em background
    this.fetchCredits();

    return {
      totalWords: 10000,
      consumedWords: 0,
      remainingWords: 10000,
      packageName: 'free',
      lastUpdated: new Date()
    };
  }

  /**
   * Verificar se tem palavras disponíveis
   */
  async hasWordsAvailable(requiredWords: number = 1): Promise<boolean> {
    const usage = await this.getWordsUsage();
    return usage.remainingWords >= requiredWords;
  }

  /**
   * Invalidar cache (forçar nova busca)
   */
  invalidateCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * Formatar número de palavras para exibição
   */
  formatWords(words: number): string {
    if (words >= 1000000) {
      return `${(words / 1000000).toFixed(1)}M`;
    }
    if (words >= 1000) {
      return `${(words / 1000).toFixed(0)}k`;
    }
    return words.toString();
  }

  /**
   * Calcular palavras estimadas para um texto
   */
  estimateWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Inicializar - busca créditos ao carregar
   */
  async initialize(): Promise<void> {
    try {
      await this.fetchCredits();
    } catch (error) {
      console.error('Erro ao inicializar créditos:', error);
    }
  }
}

export const creditService = new CreditService();
