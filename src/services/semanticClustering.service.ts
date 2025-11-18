/**
 * Semantic Clustering Service
 *
 * Uses embeddings to cluster similar articles and validate knowledge graph relationships
 * Integrates with Qdrant for efficient vector storage and similarity search
 */

import { logger } from '../config/logger.js';
import { embeddingsService } from './embeddings.service.js';
import type { FlowEnrichedArticle } from '../types/index.js';

export interface ArticleCluster {
  clusterId: number;
  articles: FlowEnrichedArticle[];
  centroid: number[];
  topicKeywords: string[];
  averageSimilarity: number;
}

export interface SemanticEdge {
  sourceId: string;
  targetId: string;
  similarity: number;
  type: 'semantic_similarity';
}

export interface ClusteringResult {
  clusters: ArticleCluster[];
  semanticEdges: SemanticEdge[];
  orphanArticles: FlowEnrichedArticle[];
  statistics: {
    totalClusters: number;
    avgClusterSize: number;
    avgIntraClusterSimilarity: number;
    silhouetteScore?: number;
  };
}

class SemanticClusteringService {
  private readonly SIMILARITY_THRESHOLD = 0.75; // Articles >75% similar are grouped
  private readonly MIN_CLUSTER_SIZE = 2;
  private readonly MAX_CLUSTERS = 10;

  /**
   * Cluster articles using K-means on embeddings
   */
  async clusterArticles(
    articles: FlowEnrichedArticle[],
    options?: {
      numClusters?: number;
      algorithm?: 'kmeans' | 'dbscan';
      similarityThreshold?: number;
    }
  ): Promise<ClusteringResult> {
    const {
      numClusters,
      algorithm = 'kmeans',
      similarityThreshold = this.SIMILARITY_THRESHOLD
    } = options || {};

    try {
      logger.info('Starting semantic clustering', {
        articleCount: articles.length,
        algorithm,
        numClusters
      });

      // 1. Generate embeddings for all articles
      const embeddings = await this.generateArticleEmbeddings(articles);

      // 2. Run clustering algorithm
      const clusters =
        algorithm === 'kmeans'
          ? await this.kMeansClustering(articles, embeddings, numClusters)
          : await this.dbscanClustering(articles, embeddings, similarityThreshold);

      // 3. Calculate semantic edges between similar articles
      const semanticEdges = await this.calculateSemanticEdges(
        articles,
        embeddings,
        similarityThreshold
      );

      // 4. Calculate statistics
      const statistics = this.calculateClusteringStats(clusters);

      // 5. Find orphan articles (not in any cluster)
      const clusteredArticleIds = new Set(
        clusters.flatMap(c => c.articles.map(a => a.id))
      );
      const orphanArticles = articles.filter(a => !clusteredArticleIds.has(a.id));

      logger.info('Clustering completed', {
        totalClusters: clusters.length,
        totalEdges: semanticEdges.length,
        orphanCount: orphanArticles.length
      });

      return {
        clusters,
        semanticEdges,
        orphanArticles,
        statistics
      };
    } catch (error: any) {
      logger.error('Failed to cluster articles', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for articles (title + abstract + intro)
   */
  private async generateArticleEmbeddings(
    articles: FlowEnrichedArticle[]
  ): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();

    // Process in batches of 10
    for (let i = 0; i < articles.length; i += 10) {
      const batch = articles.slice(i, i + 10);
      const texts = batch.map(article => {
        const title = article.title || '';
        const abstract = article.abstract || '';
        const intro = article.sections?.introduction || '';

        // Combine title (3x weight), abstract (2x weight), intro (1x weight)
        const text = `${title} ${title} ${title} ${abstract} ${abstract} ${intro}`;
        return text.substring(0, 8000); // Limit to 8k chars
      });

      const batchEmbeddings = await embeddingsService.generateBatchEmbeddings(texts);

      batch.forEach((article, idx) => {
        embeddings.set(article.id, batchEmbeddings[idx]);
      });

      logger.debug('Generated embeddings batch', {
        processed: i + batch.length,
        total: articles.length
      });
    }

    return embeddings;
  }

  /**
   * K-means clustering implementation
   */
  private async kMeansClustering(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>,
    numClusters?: number
  ): Promise<ArticleCluster[]> {
    // Auto-determine optimal number of clusters if not specified
    const k =
      numClusters ||
      Math.min(
        this.MAX_CLUSTERS,
        Math.max(2, Math.floor(Math.sqrt(articles.length / 2)))
      );

    logger.info('Running K-means clustering', { k, articleCount: articles.length });

    // Initialize centroids randomly
    let centroids = this.initializeRandomCentroids(articles, embeddings, k);

    let iterations = 0;
    const maxIterations = 100;
    let converged = false;

    while (!converged && iterations < maxIterations) {
      // Assign articles to nearest centroid
      const assignments = new Map<number, FlowEnrichedArticle[]>();
      for (let i = 0; i < k; i++) {
        assignments.set(i, []);
      }

      for (const article of articles) {
        const embedding = embeddings.get(article.id)!;
        const nearestCluster = this.findNearestCentroid(embedding, centroids);
        assignments.get(nearestCluster)!.push(article);
      }

      // Update centroids
      const newCentroids: number[][] = [];
      for (let i = 0; i < k; i++) {
        const clusterArticles = assignments.get(i)!;
        if (clusterArticles.length > 0) {
          const clusterEmbeddings = clusterArticles.map(a => embeddings.get(a.id)!);
          newCentroids.push(this.calculateCentroid(clusterEmbeddings));
        } else {
          newCentroids.push(centroids[i]); // Keep old centroid if cluster is empty
        }
      }

      // Check convergence
      converged = this.centroidsConverged(centroids, newCentroids);
      centroids = newCentroids;
      iterations++;
    }

    logger.info('K-means converged', { iterations });

    // Build final clusters
    const clusters: ArticleCluster[] = [];
    for (let i = 0; i < k; i++) {
      const clusterArticles: FlowEnrichedArticle[] = [];
      for (const article of articles) {
        const embedding = embeddings.get(article.id)!;
        if (this.findNearestCentroid(embedding, centroids) === i) {
          clusterArticles.push(article);
        }
      }

      if (clusterArticles.length >= this.MIN_CLUSTER_SIZE) {
        clusters.push({
          clusterId: i,
          articles: clusterArticles,
          centroid: centroids[i],
          topicKeywords: this.extractTopicKeywords(clusterArticles),
          averageSimilarity: this.calculateIntraClusterSimilarity(
            clusterArticles,
            embeddings
          )
        });
      }
    }

    return clusters;
  }

  /**
   * DBSCAN clustering implementation (density-based)
   */
  private async dbscanClustering(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>,
    eps: number = 0.25 // Distance threshold (1 - similarity)
  ): Promise<ArticleCluster[]> {
    logger.info('Running DBSCAN clustering', {
      articleCount: articles.length,
      eps
    });

    const visited = new Set<string>();
    const clusters: ArticleCluster[] = [];
    let clusterId = 0;

    for (const article of articles) {
      if (visited.has(article.id)) continue;

      visited.add(article.id);
      const neighbors = this.findNeighbors(article, articles, embeddings, eps);

      if (neighbors.length < this.MIN_CLUSTER_SIZE) {
        continue; // Mark as noise/orphan
      }

      // Expand cluster
      const clusterArticles = [article];
      const queue = [...neighbors];

      while (queue.length > 0) {
        const neighbor = queue.shift()!;
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          const neighborNeighbors = this.findNeighbors(
            neighbor,
            articles,
            embeddings,
            eps
          );
          if (neighborNeighbors.length >= this.MIN_CLUSTER_SIZE) {
            queue.push(...neighborNeighbors);
          }
        }
        if (!clusterArticles.find(a => a.id === neighbor.id)) {
          clusterArticles.push(neighbor);
        }
      }

      // Create cluster
      const clusterEmbeddings = clusterArticles.map(a => embeddings.get(a.id)!);
      clusters.push({
        clusterId: clusterId++,
        articles: clusterArticles,
        centroid: this.calculateCentroid(clusterEmbeddings),
        topicKeywords: this.extractTopicKeywords(clusterArticles),
        averageSimilarity: this.calculateIntraClusterSimilarity(
          clusterArticles,
          embeddings
        )
      });
    }

    return clusters;
  }

  /**
   * Calculate semantic edges between similar articles
   */
  private async calculateSemanticEdges(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>,
    threshold: number
  ): Promise<SemanticEdge[]> {
    const edges: SemanticEdge[] = [];

    // Compare all pairs
    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const article1 = articles[i];
        const article2 = articles[j];

        const embedding1 = embeddings.get(article1.id)!;
        const embedding2 = embeddings.get(article2.id)!;

        const similarity = this.cosineSimilarity(embedding1, embedding2);

        if (similarity >= threshold) {
          edges.push({
            sourceId: article1.id,
            targetId: article2.id,
            similarity,
            type: 'semantic_similarity'
          });
        }
      }
    }

    return edges;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Find nearest centroid for an embedding
   */
  private findNearestCentroid(embedding: number[], centroids: number[][]): number {
    let maxSimilarity = -1;
    let nearestIndex = 0;

    for (let i = 0; i < centroids.length; i++) {
      const similarity = this.cosineSimilarity(embedding, centroids[i]);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  /**
   * Calculate centroid of a cluster
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= embeddings.length;
    }

    // Normalize centroid
    const norm = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }

    return centroid;
  }

  /**
   * Initialize random centroids
   */
  private initializeRandomCentroids(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>,
    k: number
  ): number[][] {
    const centroids: number[][] = [];
    const selectedIndices = new Set<number>();

    while (centroids.length < k) {
      const randomIndex = Math.floor(Math.random() * articles.length);
      if (!selectedIndices.has(randomIndex)) {
        selectedIndices.add(randomIndex);
        centroids.push(embeddings.get(articles[randomIndex].id)!);
      }
    }

    return centroids;
  }

  /**
   * Check if centroids have converged
   */
  private centroidsConverged(old: number[][], newCentroids: number[][]): boolean {
    const threshold = 0.0001;

    for (let i = 0; i < old.length; i++) {
      const similarity = this.cosineSimilarity(old[i], newCentroids[i]);
      if (similarity < 1 - threshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find neighbors within eps distance (for DBSCAN)
   */
  private findNeighbors(
    article: FlowEnrichedArticle,
    allArticles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>,
    eps: number
  ): FlowEnrichedArticle[] {
    const neighbors: FlowEnrichedArticle[] = [];
    const embedding = embeddings.get(article.id)!;

    for (const other of allArticles) {
      if (other.id === article.id) continue;

      const otherEmbedding = embeddings.get(other.id)!;
      const similarity = this.cosineSimilarity(embedding, otherEmbedding);
      const distance = 1 - similarity;

      if (distance <= eps) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  /**
   * Calculate intra-cluster similarity
   */
  private calculateIntraClusterSimilarity(
    articles: FlowEnrichedArticle[],
    embeddings: Map<string, number[]>
  ): number {
    if (articles.length < 2) return 1.0;

    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const embedding1 = embeddings.get(articles[i].id)!;
        const embedding2 = embeddings.get(articles[j].id)!;
        totalSimilarity += this.cosineSimilarity(embedding1, embedding2);
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0;
  }

  /**
   * Extract topic keywords from cluster articles
   */
  private extractTopicKeywords(articles: FlowEnrichedArticle[]): string[] {
    const wordFreq = new Map<string, number>();
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
      'we',
      'study',
      'using'
    ]);

    for (const article of articles) {
      const text = `${article.title} ${article.abstract || ''}`.toLowerCase();
      const words = text.match(/\b[a-z]{4,}\b/g) || [];

      for (const word of words) {
        if (!stopWords.has(word)) {
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
      }
    }

    // Sort by frequency and take top 5
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Calculate clustering statistics
   */
  private calculateClusteringStats(clusters: ArticleCluster[]): {
    totalClusters: number;
    avgClusterSize: number;
    avgIntraClusterSimilarity: number;
  } {
    const totalClusters = clusters.length;
    const avgClusterSize =
      clusters.reduce((sum, c) => sum + c.articles.length, 0) / totalClusters;
    const avgIntraClusterSimilarity =
      clusters.reduce((sum, c) => sum + c.averageSimilarity, 0) / totalClusters;

    return {
      totalClusters,
      avgClusterSize,
      avgIntraClusterSimilarity
    };
  }

  /**
   * Validate knowledge graph edges with semantic similarity
   */
  async validateGraphEdges(
    graphEdges: Array<{ source: string; target: string; type: string }>,
    articles: FlowEnrichedArticle[]
  ): Promise<{
    validEdges: Array<{ source: string; target: string; type: string; semanticScore: number }>;
    invalidEdges: Array<{ source: string; target: string; type: string; reason: string }>;
    enhancedEdges: SemanticEdge[];
  }> {
    logger.info('Validating graph edges with semantic similarity', {
      edgeCount: graphEdges.length
    });

    // Generate embeddings
    const embeddings = await this.generateArticleEmbeddings(articles);
    const articleMap = new Map(articles.map(a => [a.id, a]));

    const validEdges: Array<{ source: string; target: string; type: string; semanticScore: number }> = [];
    const invalidEdges: Array<{ source: string; target: string; type: string; reason: string }> = [];

    for (const edge of graphEdges) {
      const sourceEmbedding = embeddings.get(edge.source);
      const targetEmbedding = embeddings.get(edge.target);

      if (!sourceEmbedding || !targetEmbedding) {
        invalidEdges.push({
          ...edge,
          reason: 'Missing article or embedding'
        });
        continue;
      }

      const similarity = this.cosineSimilarity(sourceEmbedding, targetEmbedding);

      if (similarity >= 0.5) {
        // Edge is semantically valid
        validEdges.push({
          ...edge,
          semanticScore: similarity
        });
      } else {
        invalidEdges.push({
          ...edge,
          reason: `Low semantic similarity (${(similarity * 100).toFixed(1)}%)`
        });
      }
    }

    // Find additional semantic edges not in the original graph
    const existingEdgeSet = new Set(
      graphEdges.map(e => `${e.source}-${e.target}`)
    );
    const enhancedEdges: SemanticEdge[] = [];

    for (const [id1, embedding1] of embeddings.entries()) {
      for (const [id2, embedding2] of embeddings.entries()) {
        if (id1 >= id2) continue;

        const edgeKey = `${id1}-${id2}`;
        if (existingEdgeSet.has(edgeKey) || existingEdgeSet.has(`${id2}-${id1}`)) {
          continue;
        }

        const similarity = this.cosineSimilarity(embedding1, embedding2);
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          enhancedEdges.push({
            sourceId: id1,
            targetId: id2,
            similarity,
            type: 'semantic_similarity'
          });
        }
      }
    }

    logger.info('Graph validation complete', {
      validEdges: validEdges.length,
      invalidEdges: invalidEdges.length,
      enhancedEdges: enhancedEdges.length
    });

    return {
      validEdges,
      invalidEdges,
      enhancedEdges
    };
  }
}

export const semanticClusteringService = new SemanticClusteringService();
