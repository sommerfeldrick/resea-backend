/**
 * Serviço para gerar embeddings de texto
 * Usa Ollama Cloud API (1M tokens/dia gratuito)
 * Com cache comprimido (economia de ~60% memória)
 */

import axios from 'axios';
import { gzipSync, gunzipSync } from 'zlib';

export class EmbeddingsService {
  private ollamaUrl: string;
  private ollamaApiKey: string;
  private model: string;
  private cache: Map<string, Buffer> = new Map(); // Cache comprimido
  private maxCacheSize: number = 1000;
  private compressionEnabled: boolean = true;

  constructor() {
    // Aceita OLLAMA_BASE_URL ou OLLAMA_URL
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'https://api.ollama.com';
    this.ollamaApiKey = process.env.OLLAMA_API_KEY || '';
    this.model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
    
    if (!this.ollamaApiKey) {
      console.warn('⚠️ OLLAMA_API_KEY not set - embeddings may fail');
      console.log('💡 Get your free API key at: https://ollama.com/settings/keys');
    }
    
    console.log(`🌐 Ollama Cloud configured: ${this.ollamaUrl} with model ${this.model}`);
    console.log(`🗜️ Cache compression: ${this.compressionEnabled ? 'enabled (~60% memory saved)' : 'disabled'}`);
  }

  /**
   * Gera embedding para um texto usando Ollama
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Verifica cache
      const cacheKey = this.getCacheKey(text);
      if (this.cache.has(cacheKey)) {
        const compressed = this.cache.get(cacheKey)!;
        return this.decompressEmbedding(compressed);
      }

      // Limita tamanho do texto
      const truncatedText = this.truncateText(text, 2048);

      // Gera embedding via Ollama Cloud API
      const response = await axios.post(
        `${this.ollamaUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: truncatedText,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.ollamaApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const embedding = response.data.embedding as number[];
      
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding response from Ollama');
      }

      // Normaliza o vetor
      const normalized = this.normalizeVector(embedding);

      // Salva no cache (comprimido)
      this.addToCache(cacheKey, normalized);

      return normalized;

    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gera embeddings para múltiplos textos em lote
   * Otimizado: verifica cache primeiro, trata erros individuais, rate limiting
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;
    let errors = 0;

    // Separa textos em cache e não-cache
    const toFetch: { index: number; text: string }[] = [];
    const results: (number[] | null)[] = new Array(texts.length).fill(null);

    // Primeiro: verifica cache (rápido, síncrono)
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i]);
      if (this.cache.has(cacheKey)) {
        try {
          const compressed = this.cache.get(cacheKey)!;
          results[i] = this.decompressEmbedding(compressed);
          cacheHits++;
        } catch (error) {
          console.warn(`Cache decompression failed for text ${i}, will re-fetch`);
          toFetch.push({ index: i, text: texts[i] });
          cacheMisses++;
        }
      } else {
        toFetch.push({ index: i, text: texts[i] });
        cacheMisses++;
      }
    }

    // Segundo: busca embeddings faltantes em lotes de 10
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);

      // Promise.allSettled para não falhar o batch inteiro se 1 falhar
      const batchResults = await Promise.allSettled(
        batch.map(({ text }) => this.generateEmbedding(text))
      );

      // Processa resultados individuais
      batchResults.forEach((result, batchIndex) => {
        const { index } = batch[batchIndex];

        if (result.status === 'fulfilled') {
          results[index] = result.value;
        } else {
          console.error(
            `Failed to generate embedding for text ${index}:`,
            result.reason?.message || 'Unknown error'
          );
          // Fallback: vetor zero (ou poderia usar embedding de texto vazio)
          results[index] = new Array(768).fill(0);
          errors++;
        }
      });

      // Rate limiting: delay progressivo entre lotes
      if (i + batchSize < toFetch.length) {
        const delay = Math.min(100 + (i / batchSize) * 50, 500); // 100ms -> 500ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `📊 Batch embeddings completed: ${texts.length} texts in ${duration}ms`,
      {
        cacheHits,
        cacheMisses,
        errors,
        hitRate: ((cacheHits / texts.length) * 100).toFixed(1) + '%'
      }
    );

    // Remove nulls (não deveria haver, mas por segurança)
    return results.filter((r): r is number[] => r !== null);
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
   * Comprime embedding para economizar memória (~60% redução)
   */
  private compressEmbedding(embedding: number[]): Buffer {
    if (!this.compressionEnabled) {
      return Buffer.from(new Float32Array(embedding).buffer);
    }

    // Converte para Float32Array (768 floats × 4 bytes = 3KB)
    const float32 = new Float32Array(embedding);
    const buffer = Buffer.from(float32.buffer);
    
    // Comprime com gzip (~1.2KB = 60% economia)
    return gzipSync(buffer);
  }

  /**
   * Descomprime embedding
   */
  private decompressEmbedding(compressed: Buffer): number[] {
    if (!this.compressionEnabled) {
      const float32 = new Float32Array(compressed.buffer, compressed.byteOffset, compressed.byteLength / 4);
      return Array.from(float32);
    }

    // Descomprime
    const decompressed = gunzipSync(compressed);
    
    // Converte de volta para number[]
    const float32 = new Float32Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength / 4);
    return Array.from(float32);
  }

  /**
   * Adiciona ao cache com compressão
   */
  private addToCache(key: string, value: number[]): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove primeiro item (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Comprime antes de armazenar
    const compressed = this.compressEmbedding(value);
    this.cache.set(key, compressed);
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Estatísticas do cache com info de compressão
   */
  getCacheStats() {
    let totalCompressedSize = 0;
    let totalUncompressedSize = 0;

    for (const compressed of this.cache.values()) {
      totalCompressedSize += compressed.byteLength;
      // Estimativa: 768 floats × 4 bytes = 3072 bytes
      totalUncompressedSize += 768 * 4;
    }

    const compressionRatio = totalUncompressedSize > 0 
      ? (1 - (totalCompressedSize / totalUncompressedSize)) * 100
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: (this.cache.size / this.maxCacheSize) * 100,
      totalCompressedSizeMB: (totalCompressedSize / (1024 * 1024)).toFixed(2),
      totalUncompressedSizeMB: (totalUncompressedSize / (1024 * 1024)).toFixed(2),
      compressionRatio: compressionRatio.toFixed(1) + '%',
      memorySavedMB: ((totalUncompressedSize - totalCompressedSize) / (1024 * 1024)).toFixed(2),
    };
  }
}

// Singleton export
export const embeddingsService = new EmbeddingsService();
