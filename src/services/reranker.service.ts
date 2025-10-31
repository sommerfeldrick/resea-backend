/**
 * Serviço de Reranking usando Cross-Encoder
 * Refina top-K resultados com análise mais profunda
 */

import { HfInference } from '@huggingface/inference';
import { SearchResult } from './hybridSearch.service.js';

export interface RerankResult extends SearchResult {
  rerankScore: number;
  originalScore: number;
}

export class RerankerService {
  private hf: HfInference;
  private model: string = 'cross-encoder/ms-marco-MiniLM-L-6-v2';
  private enabled: boolean = true;

  constructor() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ HUGGINGFACE_API_KEY not set, reranking disabled');
      this.enabled = false;
    }
    this.hf = new HfInference(apiKey);
  }

  /**
   * Reordena resultados usando cross-encoder
   */
  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = 20
  ): Promise<RerankResult[]> {
    if (!this.enabled) {
      console.warn('Reranker disabled, returning original results');
      return results.slice(0, topK).map(r => ({
        ...r,
        rerankScore: r.score,
        originalScore: r.score,
      }));
    }

    try {
      // Pega top resultados para reranking (geralmente top-100 → top-20)
      const candidatesForRerank = results.slice(0, Math.min(results.length, 100));

      console.log(`🔄 Reranking ${candidatesForRerank.length} candidates to top ${topK}`);

      // Gera pares query-document para scoring
      const rerankScores = await this.scoreDocuments(query, candidatesForRerank);

      // Combina scores: 50% original + 50% rerank
      const rerankedResults: RerankResult[] = candidatesForRerank.map((result, idx) => ({
        ...result,
        rerankScore: rerankScores[idx],
        originalScore: result.score,
        score: (result.score * 0.5) + (rerankScores[idx] * 0.5), // Média ponderada
      }));

      // Ordena por novo score
      rerankedResults.sort((a, b) => b.score - a.score);

      console.log(`✅ Reranking complete: top result changed from "${candidatesForRerank[0].paper.title}" to "${rerankedResults[0].paper.title}"`);

      return rerankedResults.slice(0, topK);

    } catch (error) {
      console.error('Erro no reranking:', error);
      // Fallback: retorna resultados originais
      return results.slice(0, topK).map(r => ({
        ...r,
        rerankScore: r.score,
        originalScore: r.score,
      }));
    }
  }

  /**
   * Calcula scores de relevância para documentos
   */
  private async scoreDocuments(
    query: string,
    results: SearchResult[]
  ): Promise<number[]> {
    const scores: number[] = [];

    // Processa em lotes para não sobrecarregar API
    const batchSize = 5;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      const batchScores = await Promise.all(
        batch.map(result => this.scoreQueryDocumentPair(query, result))
      );
      
      scores.push(...batchScores);
      
      // Pequeno delay entre lotes
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Normaliza scores para [0, 1]
    return this.normalizeScores(scores);
  }

  /**
   * Score para um par query-document
   */
  private async scoreQueryDocumentPair(
    query: string,
    result: SearchResult
  ): Promise<number> {
    try {
      // Prepara texto do documento (título + abstract)
      const documentText = this.prepareDocumentText(result);

      // Usa sentence similarity como proxy para cross-encoder
      // Em produção ideal, usar API de cross-encoder dedicada
      const response = await this.hf.sentenceSimilarity({
        model: this.model,
        inputs: {
          source_sentence: query,
          sentences: [documentText],
        },
      });

      return Array.isArray(response) ? response[0] : 0;

    } catch (error) {
      console.error('Erro ao calcular score:', error);
      return 0;
    }
  }

  /**
   * Prepara texto do documento para scoring
   */
  private prepareDocumentText(result: SearchResult): string {
    const parts = [
      result.paper.title,
      result.paper.abstract,
    ];

    // Adiciona primeiras palavras do fullText se disponível
    if (result.paper.fullText?.rawText) {
      const snippet = result.paper.fullText.rawText.substring(0, 500);
      parts.push(snippet);
    }

    return parts.join(' ').substring(0, 1000); // Limita tamanho
  }

  /**
   * Normaliza scores para intervalo [0, 1]
   */
  private normalizeScores(scores: number[]): number[] {
    if (scores.length === 0) return [];

    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    if (range === 0) {
      return scores.map(() => 0.5); // Todos iguais
    }

    return scores.map(score => (score - min) / range);
  }

  /**
   * Reranking simplificado baseado em heurísticas (fallback)
   */
  heuristicRerank(
    query: string,
    results: SearchResult[],
    topK: number = 20
  ): RerankResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    const scored = results.map(result => {
      let heuristicScore = 0;

      // Boost se título contém termos da query
      const title = result.paper.title.toLowerCase();
      const titleMatches = queryTerms.filter(term => title.includes(term)).length;
      heuristicScore += titleMatches * 0.3;

      // Boost por citações (normalizado)
      if (result.paper.citationCount) {
        heuristicScore += Math.log10(result.paper.citationCount + 1) * 0.1;
      }

      // Boost por papers recentes
      if (result.paper.year) {
        const age = new Date().getFullYear() - result.paper.year;
        heuristicScore += Math.max(0, (10 - age) / 10) * 0.2;
      }

      // Combina com score original
      const finalScore = (result.score * 0.6) + (heuristicScore * 0.4);

      return {
        ...result,
        rerankScore: heuristicScore,
        originalScore: result.score,
        score: finalScore,
      };
    });

    // Ordena e limita
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// Singleton export
export const rerankerService = new RerankerService();
