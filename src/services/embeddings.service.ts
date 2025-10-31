/**
 * Serviço para gerar embeddings de texto
 * Usa HuggingFace Inference API com modelo multilingual
 */

import { HfInference } from '@huggingface/inference';

export class EmbeddingsService {
  private hf: HfInference;
  private model: string = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
  private cache: Map<string, number[]> = new Map();
  private maxCacheSize: number = 1000;

  constructor() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ HUGGINGFACE_API_KEY not set, embeddings will fail');
    }
    this.hf = new HfInference(apiKey);
  }

  /**
   * Gera embedding para um texto
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Verifica cache
      const cacheKey = this.getCacheKey(text);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      // Limita tamanho do texto (modelo suporta ~512 tokens)
      const truncatedText = this.truncateText(text, 512);

      // Gera embedding
      const response = await this.hf.featureExtraction({
        model: this.model,
        inputs: truncatedText,
      });

      // Extrai array de números
      const embedding = Array.isArray(response) ? response : Array.from(response as any);
      
      // Normaliza o vetor
      const normalized = this.normalizeVector(embedding as number[]);

      // Salva no cache
      this.addToCache(cacheKey, normalized);

      return normalized;

    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gera embeddings para múltiplos textos em lote
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // Processa em lotes de 10 para não sobrecarregar a API
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchResults);
      
      // Pequeno delay entre lotes
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return embeddings;
  }

  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Normaliza vetor (L2 normalization)
   */
  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / norm);
  }

  /**
   * Trunca texto para caber no modelo
   */
  private truncateText(text: string, maxTokens: number): string {
    // Aproximação: ~4 caracteres por token
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars) + '...';
  }

  /**
   * Gera chave de cache (hash simples)
   */
  private getCacheKey(text: string): string {
    // Usa primeiros 100 caracteres como chave
    return text.substring(0, 100);
  }

  /**
   * Adiciona ao cache com limite de tamanho
   */
  private addToCache(key: string, value: number[]): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove primeiro item (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: this.cache.size / this.maxCacheSize
    };
  }
}

// Singleton export
export const embeddingsService = new EmbeddingsService();
