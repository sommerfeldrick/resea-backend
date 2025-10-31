/**
 * Serviço de Busca Híbrida: Vector Search (70%) + BM25 (30%)
 * Usa Qdrant para armazenamento vetorial e busca
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { embeddingsService } from './embeddings.service.js';
import { FullPaper } from '../types/fullPaper.js';
import natural from 'natural';

const TfIdf = natural.TfIdf;

export interface SearchResult {
  paper: FullPaper;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
  method: 'hybrid' | 'vector' | 'bm25';
}

export class HybridSearchService {
  private qdrantClient: QdrantClient;
  private collectionName: string = 'academic_papers';
  private tfidf: any;
  private papers: Map<string, FullPaper> = new Map();
  
  // Pesos para busca híbrida
  private vectorWeight: number = 0.7;
  private bm25Weight: number = 0.3;

  constructor() {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.qdrantClient = new QdrantClient({ url: qdrantUrl });
    this.tfidf = new TfIdf();
  }

  /**
   * Inicializa a coleção no Qdrant
   */
  async initializeCollection(vectorSize: number = 384): Promise<void> {
    try {
      // Verifica se coleção existe
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
          // 🆕 Quantização para economizar 75% de memória
          quantization_config: {
            scalar: {
              type: 'int8',
              quantile: 0.99,
              always_ram: true
            }
          },
          // 🆕 Otimizações de performance
          optimizers_config: {
            default_segment_number: 2,
            indexing_threshold: 20000,
          },
          // 🆕 HNSW para busca rápida
          hnsw_config: {
            m: 16,
            ef_construct: 100,
            full_scan_threshold: 10000
          }
        });
        console.log(`✅ Coleção '${this.collectionName}' criada no Qdrant com quantização int8 (75% economia memória)`);
      } else {
        console.log(`✅ Coleção '${this.collectionName}' já existe`);
      }
    } catch (error) {
      console.error('Erro ao inicializar coleção:', error);
      throw error;
    }
  }

  /**
   * Indexa um paper completo
   */
  async indexPaper(paper: FullPaper): Promise<void> {
    try {
      // Concatena texto para embedding
      const textForEmbedding = this.prepareTextForEmbedding(paper);
      
      // Gera embedding
      const embedding = await embeddingsService.generateEmbedding(textForEmbedding);

      // Armazena no Qdrant
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: paper.id,
            vector: embedding,
            payload: {
              title: paper.title,
              authors: paper.authors,
              year: paper.year,
              abstract: paper.abstract,
              source: paper.source,
              doi: paper.doi,
              url: paper.url,
              // Inclui seções para BM25
              fullText: paper.fullText?.rawText || paper.abstract,
              citationCount: paper.citationCount,
            },
          },
        ],
      });

      // Armazena em memória para BM25
      this.papers.set(paper.id, paper);
      
      // Adiciona ao índice TF-IDF
      this.tfidf.addDocument(textForEmbedding, paper.id);

      console.log(`✅ Paper indexado: ${paper.title}`);
    } catch (error) {
      console.error(`Erro ao indexar paper ${paper.title}:`, error);
      throw error;
    }
  }

  /**
   * Indexa múltiplos papers em lote
   */
  async indexBatch(papers: FullPaper[]): Promise<void> {
    console.log(`📚 Indexando ${papers.length} papers...`);
    
    for (const paper of papers) {
      try {
        await this.indexPaper(paper);
      } catch (error) {
        console.error(`Falha ao indexar ${paper.title}:`, error);
      }
    }
    
    console.log(`✅ Indexação completa: ${papers.length} papers`);
  }

  /**
   * Busca híbrida: Vector (70%) + BM25 (30%)
   */
  async search(query: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      // 1. Busca Vetorial
      const vectorResults = await this.vectorSearch(query, limit * 2);
      
      // 2. Busca BM25
      const bm25Results = await this.bm25Search(query, limit * 2);
      
      // 3. Reciprocal Rank Fusion (RRF)
      const hybridResults = this.reciprocalRankFusion(
        vectorResults,
        bm25Results,
        limit
      );

      return hybridResults;

    } catch (error) {
      console.error('Erro na busca híbrida:', error);
      // Fallback para busca vetorial pura
      console.warn('Fallback: usando apenas busca vetorial');
      return await this.vectorSearch(query, limit);
    }
  }

  /**
   * Busca vetorial pura (Qdrant)
   */
  private async vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Gera embedding da query
      const queryEmbedding = await embeddingsService.generateEmbedding(query);

      // Busca no Qdrant
      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: true,
      });

      // Converte para SearchResult
      return searchResult.map(result => ({
        paper: this.reconstructPaperFromPayload(result.payload as any),
        score: result.score,
        vectorScore: result.score,
        method: 'vector' as const,
      }));

    } catch (error) {
      console.error('Erro na busca vetorial:', error);
      return [];
    }
  }

  /**
   * Busca BM25 (TF-IDF)
   */
  private async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      
      // Procura termos no índice TF-IDF
      this.tfidf.tfidfs(query, (i: number, measure: number, paperId: string) => {
        const paper = this.papers.get(paperId);
        if (paper && measure > 0) {
          results.push({
            paper,
            score: measure,
            bm25Score: measure,
            method: 'bm25' as const,
          });
        }
      });

      // Ordena por score e limita
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Erro na busca BM25:', error);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion: combina resultados de múltiplas buscas
   * RRF(d) = Σ 1 / (k + rank(d))
   */
  private reciprocalRankFusion(
    vectorResults: SearchResult[],
    bm25Results: SearchResult[],
    limit: number,
    k: number = 60
  ): SearchResult[] {
    const scoreMap = new Map<string, {
      paper: FullPaper;
      rrfScore: number;
      vectorScore?: number;
      bm25Score?: number;
    }>();

    // Processa resultados vetoriais
    vectorResults.forEach((result, rank) => {
      const rrfScore = this.vectorWeight / (k + rank + 1);
      scoreMap.set(result.paper.id, {
        paper: result.paper,
        rrfScore,
        vectorScore: result.score,
      });
    });

    // Adiciona resultados BM25
    bm25Results.forEach((result, rank) => {
      const rrfScore = this.bm25Weight / (k + rank + 1);
      const existing = scoreMap.get(result.paper.id);
      
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.bm25Score = result.score;
      } else {
        scoreMap.set(result.paper.id, {
          paper: result.paper,
          rrfScore,
          bm25Score: result.score,
        });
      }
    });

    // Converte para array e ordena
    const results = Array.from(scoreMap.values())
      .map(item => ({
        paper: item.paper,
        score: item.rrfScore,
        vectorScore: item.vectorScore,
        bm25Score: item.bm25Score,
        method: 'hybrid' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * Prepara texto para embedding (concatena campos relevantes)
   */
  private prepareTextForEmbedding(paper: FullPaper): string {
    const parts = [
      paper.title,
      paper.abstract,
    ];

    // Adiciona primeiras seções se disponível
    if (paper.fullText?.sections && paper.fullText.sections.length > 0) {
      const firstSections = paper.fullText.sections
        .slice(0, 3) // Primeiras 3 seções
        .map(s => s.content)
        .join(' ');
      parts.push(firstSections);
    }

    return parts.join(' ').substring(0, 2000); // Limita tamanho
  }

  /**
   * Reconstrói objeto FullPaper do payload do Qdrant
   */
  private reconstructPaperFromPayload(payload: any): FullPaper {
    return {
      id: payload.id || '',
      title: payload.title || '',
      authors: payload.authors || [],
      year: payload.year || 0,
      abstract: payload.abstract || '',
      url: payload.url || '',
      doi: payload.doi,
      source: payload.source || '',
      citationCount: payload.citationCount,
      fullText: payload.fullText ? {
        rawText: payload.fullText,
        sections: [],
      } : undefined,
    };
  }

  /**
   * Remove paper do índice
   */
  async removePaper(paperId: string): Promise<void> {
    try {
      await this.qdrantClient.delete(this.collectionName, {
        wait: true,
        points: [paperId],
      });
      this.papers.delete(paperId);
      console.log(`✅ Paper removido: ${paperId}`);
    } catch (error) {
      console.error(`Erro ao remover paper ${paperId}:`, error);
      throw error;
    }
  }

  /**
   * Limpa toda a coleção
   */
  async clearCollection(): Promise<void> {
    try {
      await this.qdrantClient.deleteCollection(this.collectionName);
      await this.initializeCollection();
      this.papers.clear();
      this.tfidf = new TfIdf();
      console.log(`✅ Coleção limpa`);
    } catch (error) {
      console.error('Erro ao limpar coleção:', error);
      throw error;
    }
  }

  /**
   * Estatísticas da busca
   */
  async getStats() {
    try {
      const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
      return {
        totalPapers: collectionInfo.points_count,
        vectorSize: collectionInfo.config.params.vectors,
        inMemoryPapers: this.papers.size,
        tfidfDocuments: this.tfidf.documents.length,
      };
    } catch (error) {
      return {
        totalPapers: 0,
        inMemoryPapers: this.papers.size,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton export
export const hybridSearchService = new HybridSearchService();
