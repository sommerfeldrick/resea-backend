/**
 * Hybrid Local Search Service
 * Combines Vector Search (Qdrant) + BM25 (Elasticsearch)
 * Uses Reciprocal Rank Fusion (RRF) for result merging
 */

import type { AcademicArticle } from '../../types/article.types';
import { QdrantService } from '../database/qdrant.service';
import { ElasticsearchService } from '../database/elasticsearch.service';
import { embeddingsService } from '../embeddings.service';
import { Logger } from '../../utils/simple-logger';
import { RRF_CONSTANT } from '../../config/constants';

export class HybridLocalSearchService {
  private qdrant: QdrantService;
  private elasticsearch: ElasticsearchService;
  private logger: Logger;

  constructor() {
    this.qdrant = new QdrantService();
    this.elasticsearch = new ElasticsearchService();
    this.logger = new Logger('HybridLocalSearch');
  }

  /**
   * Hybrid search: Vector (70%) + BM25 (30%)
   */
  async hybridSearch(
    query: string,
    topK: number = 100,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    this.logger.info(`Hybrid search: "${query.substring(0, 50)}..."`);

    // ═══════════════════════════════════════════════════════
    // STEP 1: Vector Search (Qdrant)
    // ═══════════════════════════════════════════════════════
    const vectorResults = await this.vectorSearch(query, topK, filters);
    this.logger.info(`Vector: ${vectorResults.length} results`);

    // ═══════════════════════════════════════════════════════
    // STEP 2: BM25 Search (Elasticsearch)
    // ═══════════════════════════════════════════════════════
    const bm25Results = await this.bm25Search(query, topK, filters);
    this.logger.info(`BM25: ${bm25Results.length} results`);

    // ═══════════════════════════════════════════════════════
    // STEP 3: Reciprocal Rank Fusion
    // ═══════════════════════════════════════════════════════
    const fused = this.reciprocalRankFusion(vectorResults, bm25Results, {
      vectorWeight: 0.7,
      bm25Weight: 0.3,
    });

    this.logger.info(`Fused: ${fused.length} results`);

    return fused.slice(0, Math.floor(topK / 2));
  }

  /**
   * Vector Search in Qdrant
   */
  private async vectorSearch(
    query: string,
    limit: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    // Generate embedding
    const embedding = await embeddingsService.generateEmbedding(query);

    // Search in Qdrant
    const results = await this.qdrant.search(embedding, limit, filters);

    return results;
  }

  /**
   * BM25 Search in Elasticsearch
   */
  private async bm25Search(
    query: string,
    size: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    const results = await this.elasticsearch.search(query, size, filters);

    return results;
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Score = Σ (weight / (k + rank))
   */
  private reciprocalRankFusion(
    vectorResults: AcademicArticle[],
    bm25Results: AcademicArticle[],
    weights: { vectorWeight: number; bm25Weight: number }
  ): AcademicArticle[] {
    const scores = new Map<string, { article: AcademicArticle; score: number }>();

    // Score from vector search (70%)
    vectorResults.forEach((article, rank) => {
      const key = article.doi || article.url || article.title;
      const rrfScore = weights.vectorWeight / (RRF_CONSTANT + rank + 1);

      scores.set(key, {
        article,
        score: rrfScore,
      });
    });

    // Score from BM25 (30%)
    bm25Results.forEach((article, rank) => {
      const key = article.doi || article.url || article.title;
      const rrfScore = weights.bm25Weight / (RRF_CONSTANT + rank + 1);

      const existing = scores.get(key);
      if (existing) {
        existing.score += rrfScore; // Combine scores
      } else {
        scores.set(key, {
          article,
          score: rrfScore,
        });
      }
    });

    // Sort by combined score (descending)
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.article,
        score: item.score, // Update score with RRF
      }));
  }
}
