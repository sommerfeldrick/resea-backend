/**
 * Chunking Service
 * Creates semantic chunks for RAG (Retrieval-Augmented Generation)
 * Supports section-aware chunking, overlapping chunks, and automatic embeddings
 */

import type { AcademicArticle, ContentChunk, ChunkType, StandardSection } from '../../types/index.js';
import { embeddingsService } from '../embeddings.service.js';
import { CHUNKING_CONFIG } from '../../config/constants.js';
import { Logger } from '../../utils/simple-logger.js';

export interface ChunkingOptions {
  chunkSize?: number;        // Characters per chunk (default: 1000)
  overlap?: number;           // Overlap between chunks (default: 200)
  generateEmbeddings?: boolean; // Auto-generate embeddings (default: false)
  respectSections?: boolean;   // Don't split across sections (default: true)
  minChunkSize?: number;      // Minimum chunk size (default: 100)
}

export class ChunkingService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ChunkingService');
  }

  /**
   * Create chunks from article full-text
   */
  async createChunks(
    article: AcademicArticle,
    options: ChunkingOptions = {}
  ): Promise<ContentChunk[]> {
    const opts = {
      chunkSize: options.chunkSize || CHUNKING_CONFIG.TARGET_CHUNK_SIZE,
      overlap: options.overlap || CHUNKING_CONFIG.OVERLAP_SIZE,
      generateEmbeddings: options.generateEmbeddings ?? false,
      respectSections: options.respectSections ?? true,
      minChunkSize: options.minChunkSize || CHUNKING_CONFIG.MIN_CHUNK_SIZE,
    };

    this.logger.info(`Creating chunks for article ${article.doi || article.id}`);

    let chunks: ContentChunk[] = [];

    // Strategy 1: Use structured sections if available
    if (article.fullText?.structured && opts.respectSections) {
      chunks = await this.chunkBySections(article, opts);
    }
    // Strategy 2: Use raw full-text with sliding window
    else if (article.fullText?.raw) {
      chunks = await this.chunkByFixedSize(article.fullText.raw, opts);
    }
    // Strategy 3: Fallback to abstract + sections
    else if (article.abstract || article.sections) {
      chunks = await this.chunkFromMetadata(article, opts);
    }

    // Generate embeddings if requested
    if (opts.generateEmbeddings && chunks.length > 0) {
      chunks = await this.addEmbeddings(chunks);
    }

    this.logger.info(`Created ${chunks.length} chunks for article ${article.doi || article.id}`);

    return chunks;
  }

  /**
   * Create chunks respecting section boundaries
   */
  private async chunkBySections(
    article: AcademicArticle,
    options: ChunkingOptions
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    const sections = article.fullText?.structured || {};

    let chunkOrder = 0;

    for (const [sectionName, sectionText] of Object.entries(sections)) {
      if (!sectionText || typeof sectionText !== 'string') continue;

      const sectionType = this.inferSectionType(sectionName);
      const standardSection = this.mapToStandardSection(sectionName);

      // If section is small enough, keep as single chunk
      if (sectionText.length <= options.chunkSize!) {
        chunks.push(this.createChunk({
          text: sectionText,
          type: sectionType,
          section: standardSection || sectionName,
          order: chunkOrder++,
          articleId: article.id,
        }));
      } else {
        // Split large section into smaller chunks
        const sectionChunks = this.splitTextIntoChunks(
          sectionText,
          options.chunkSize!,
          options.overlap!,
          options.minChunkSize!
        );

        for (const [index, chunkText] of sectionChunks.entries()) {
          chunks.push(this.createChunk({
            text: chunkText,
            type: sectionType,
            section: standardSection || sectionName,
            order: chunkOrder++,
            articleId: article.id,
            context: {
              previous: index > 0 ? sectionChunks[index - 1].substring(0, 100) : undefined,
              next: index < sectionChunks.length - 1 ? sectionChunks[index + 1].substring(0, 100) : undefined,
              parent: sectionName,
            },
          }));
        }
      }
    }

    return chunks;
  }

  /**
   * Create fixed-size chunks from raw text
   */
  private async chunkByFixedSize(
    text: string,
    options: ChunkingOptions
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    const textChunks = this.splitTextIntoChunks(
      text,
      options.chunkSize!,
      options.overlap!,
      options.minChunkSize!
    );

    for (const [index, chunkText] of textChunks.entries()) {
      chunks.push(this.createChunk({
        text: chunkText,
        type: 'paragraph',
        section: 'unknown',
        order: index,
        articleId: 'unknown',
        context: {
          previous: index > 0 ? textChunks[index - 1].substring(0, 100) : undefined,
          next: index < textChunks.length - 1 ? textChunks[index + 1].substring(0, 100) : undefined,
        },
      }));
    }

    return chunks;
  }

  /**
   * Create chunks from article metadata (fallback)
   */
  private async chunkFromMetadata(
    article: AcademicArticle,
    options: ChunkingOptions
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    let order = 0;

    // Add abstract as chunk
    if (article.abstract) {
      chunks.push(this.createChunk({
        text: article.abstract,
        type: 'section',
        section: 'abstract',
        order: order++,
        articleId: article.id,
      }));
    }

    // Add sections if available
    if (article.sections) {
      for (const [sectionName, sectionText] of Object.entries(article.sections)) {
        if (!sectionText || typeof sectionText !== 'string') continue;

        chunks.push(this.createChunk({
          text: sectionText,
          type: 'paragraph',
          section: sectionName,
          order: order++,
          articleId: article.id,
        }));
      }
    }

    return chunks;
  }

  /**
   * Split text into chunks with overlap
   */
  private splitTextIntoChunks(
    text: string,
    chunkSize: number,
    overlap: number,
    minChunkSize: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // Don't create chunks smaller than minChunkSize
      if (text.length - end < minChunkSize) {
        end = text.length;
      }

      // Try to break at sentence boundary
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('.', end);
        if (sentenceEnd > start && sentenceEnd - start > minChunkSize) {
          end = sentenceEnd + 1;
        }
      }

      chunks.push(text.substring(start, end).trim());

      // Move to next chunk with overlap
      start = end - overlap;

      // Prevent infinite loop
      if (start >= text.length) break;
    }

    return chunks.filter((chunk) => chunk.length >= minChunkSize);
  }

  /**
   * Create ContentChunk object
   */
  private createChunk(params: {
    text: string;
    type: ChunkType;
    section: StandardSection | string;
    order: number;
    articleId: string;
    context?: ContentChunk['context'];
  }): ContentChunk {
    const wordCount = params.text.split(/\s+/).length;

    return {
      id: `${params.articleId}-chunk-${params.order}`,
      text: params.text,
      type: params.type,
      section: params.section,
      position: {
        start: 0, // Will be calculated if needed
        end: params.text.length,
        order: params.order,
      },
      metadata: {
        wordCount,
        citations: this.extractCitations(params.text),
        keywords: this.extractKeywords(params.text),
      },
      context: params.context,
    };
  }

  /**
   * Add embeddings to chunks in batch
   */
  private async addEmbeddings(chunks: ContentChunk[]): Promise<ContentChunk[]> {
    this.logger.info(`Generating embeddings for ${chunks.length} chunks...`);

    try {
      const texts = chunks.map((chunk) => chunk.text);
      const embeddings = await embeddingsService.generateBatchEmbeddings(texts);

      return chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      }));
    } catch (error: any) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`);
      return chunks; // Return chunks without embeddings
    }
  }

  /**
   * Infer chunk type from section name
   */
  private inferSectionType(sectionName: string): ChunkType {
    const nameLower = sectionName.toLowerCase();

    if (nameLower.includes('abstract')) return 'section';
    if (nameLower.includes('introduction')) return 'section';
    if (nameLower.includes('method')) return 'section';
    if (nameLower.includes('result')) return 'section';
    if (nameLower.includes('discussion')) return 'section';
    if (nameLower.includes('conclusion')) return 'section';
    if (nameLower.includes('reference')) return 'section';
    if (nameLower.includes('table')) return 'table';
    if (nameLower.includes('figure')) return 'figure';

    return 'paragraph';
  }

  /**
   * Map section name to standard section
   */
  private mapToStandardSection(sectionName: string): StandardSection | null {
    const nameLower = sectionName.toLowerCase();

    if (nameLower.includes('abstract')) return 'abstract';
    if (nameLower.includes('introduction')) return 'introduction';
    if (nameLower.includes('method')) return 'methodology';
    if (nameLower.includes('result')) return 'results';
    if (nameLower.includes('discussion')) return 'discussion';
    if (nameLower.includes('conclusion')) return 'conclusion';
    if (nameLower.includes('reference')) return 'references';

    return null;
  }

  /**
   * Extract DOI citations from text
   */
  private extractCitations(text: string): string[] | undefined {
    const doiPattern = /10\.\d{4,}\/[^\s]+/g;
    const matches = text.match(doiPattern);
    return matches ? [...new Set(matches)] : undefined;
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(text: string): string[] | undefined {
    // TODO: Implement more sophisticated keyword extraction
    // For now, just return undefined
    return undefined;
  }

  /**
   * Enrich article with chunks
   */
  async enrichArticle(
    article: AcademicArticle,
    options: ChunkingOptions = {}
  ): Promise<AcademicArticle> {
    const chunks = await this.createChunks(article, options);

    if (chunks.length === 0) {
      return article;
    }

    return {
      ...article,
      fullText: {
        ...article.fullText,
        chunks,
      },
    };
  }
}

// Singleton export
export const chunkingService = new ChunkingService();
