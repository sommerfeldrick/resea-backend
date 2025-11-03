/**
 * Elasticsearch Service
 * Full-text search with BM25 ranking
 * Uses Elasticsearch Cloud or local instance
 */

import { Client } from '@elastic/elasticsearch';
import type { AcademicArticle } from '../../types/article.types';
import { Logger } from '../../utils/simple-logger';

export class ElasticsearchService {
  private client: Client;
  private logger: Logger;
  private indexName: string = 'academic_articles';

  constructor() {
    this.logger = new Logger('ElasticsearchService');

    const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const apiKey = process.env.ELASTICSEARCH_API_KEY;
    const username = process.env.ELASTICSEARCH_USERNAME;
    const password = process.env.ELASTICSEARCH_PASSWORD;

    const clientConfig: any = { node };

    if (apiKey) {
      clientConfig.auth = { apiKey };
    } else if (username && password) {
      clientConfig.auth = { username, password };
    }

    this.client = new Client(clientConfig);

    this.logger.info(`Elasticsearch client initialized: ${node}`);
    this.ensureIndex();
  }

  /**
   * Ensure index exists with proper mappings
   */
  private async ensureIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });

      if (!exists) {
        this.logger.info(`Creating index: ${this.indexName}`);

        await this.client.indices.create({
          index: this.indexName,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                multilingual: {
                  type: 'standard',
                  stopwords: '_english_',
                },
              },
            },
          },
          mappings: {
            properties: {
              doi: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'multilingual',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              abstract: {
                type: 'text',
                analyzer: 'multilingual',
              },
              authors: { type: 'keyword' },
              year: { type: 'integer' },
              journal: { type: 'keyword' },
              source: { type: 'keyword' },
              citationCount: { type: 'integer' },
              isOpenAccess: { type: 'boolean' },
              hasFullText: { type: 'boolean' },
              fullText: {
                type: 'text',
                analyzer: 'multilingual',
              },
              indexedAt: { type: 'date' },
            },
          },
        } as any);

        this.logger.info(`Index created: ${this.indexName}`);
      }
    } catch (error: any) {
      this.logger.warn(`Could not ensure index: ${error.message}`);
    }
  }

  /**
   * Search using BM25 algorithm
   */
  async search(
    query: string,
    size: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      this.logger.info(`BM25 search: "${query}" (${size} results)`);

      const must: any[] = [
        {
          multi_match: {
            query,
            fields: ['title^3', 'abstract^2', 'fullText'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO',
          },
        },
      ];

      // Apply filters
      if (filters?.requireFullText) {
        must.push({
          term: { hasFullText: true },
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        size,
        query: {
          bool: {
            must,
          },
        },
        sort: [{ _score: 'desc' }],
      } as any);

      return response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      })) as AcademicArticle[];
    } catch (error: any) {
      this.logger.error(`BM25 search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Index an article for full-text search
   */
  async index(article: AcademicArticle): Promise<void> {
    try {
      const id = article.doi || article.id || this.generateId(article);

      await this.client.index({
        index: this.indexName,
        id,
        document: {
          ...article,
          hasFullText: !!(
            article.fullText ||
            article.pdfUrl ||
            (article.availableFormats && article.availableFormats.length > 0)
          ),
          indexedAt: new Date().toISOString(),
        },
      } as any);

      this.logger.debug(`Indexed article: ${id}`);
    } catch (error: any) {
      this.logger.error(`Failed to index article: ${error.message}`);
    }
  }

  /**
   * Index multiple articles in batch
   */
  async indexBatch(articles: AcademicArticle[]): Promise<void> {
    try {
      this.logger.info(`Batch indexing ${articles.length} articles`);

      const operations = articles.flatMap(article => {
        const id = article.doi || article.id || this.generateId(article);

        return [
          { index: { _index: this.indexName, _id: id } },
          {
            ...article,
            hasFullText: !!(
              article.fullText ||
              article.pdfUrl ||
              (article.availableFormats && article.availableFormats.length > 0)
            ),
            indexedAt: new Date().toISOString(),
          },
        ];
      });

      // Bulk insert (max 1000 at a time)
      const batchSize = 1000;
      for (let i = 0; i < operations.length; i += batchSize * 2) {
        const batch = operations.slice(i, i + batchSize * 2);

        await this.client.bulk({ operations: batch } as any);

        this.logger.info(
          `Indexed batch ${i / (batchSize * 2) + 1}/${Math.ceil(operations.length / (batchSize * 2))}`
        );
      }

      // Refresh index
      await this.client.indices.refresh({ index: this.indexName });

      this.logger.info(`Successfully indexed ${articles.length} articles`);
    } catch (error: any) {
      this.logger.error(`Batch indexing failed: ${error.message}`);
    }
  }

  /**
   * Delete article by ID
   */
  async delete(articleId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: articleId,
      });

      this.logger.debug(`Deleted article: ${articleId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete article: ${error.message}`);
    }
  }

  /**
   * Get index stats
   */
  async getIndexStats() {
    try {
      return await this.client.indices.stats({ index: this.indexName });
    } catch (error: any) {
      this.logger.error(`Failed to get index stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate unique ID for article
   */
  private generateId(article: AcademicArticle): string {
    const text = `${article.title}-${article.authors?.[0] || ''}-${article.year || ''}`;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `article_${Math.abs(hash)}`;
  }
}
