/**
 * Sistema de tipos para conteúdo estruturado
 * Suporta parsing de múltiplos formatos e chunking para RAG
 */

import { ArticleFormat } from './article.types';

/**
 * Seções padrão de artigo científico
 */
export type StandardSection =
  | 'title'
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'methodology'
  | 'results'
  | 'discussion'
  | 'conclusion'
  | 'acknowledgments'
  | 'references'
  | 'appendix'
  | 'supplementary';

/**
 * Tipo de chunk para RAG
 */
export type ChunkType =
  | 'paragraph'     // Parágrafo completo
  | 'section'       // Seção inteira
  | 'sentence'      // Frase individual
  | 'heading'       // Título/subtítulo
  | 'list_item'     // Item de lista
  | 'table'         // Tabela (serializada)
  | 'figure'        // Legenda de figura
  | 'equation'      // Equação (LaTeX)
  | 'code';         // Bloco de código

/**
 * Chunk de texto para RAG (Retrieval-Augmented Generation)
 */
export interface ContentChunk {
  id: string;                    // Único por artigo
  text: string;                  // Texto do chunk
  type: ChunkType;
  section: StandardSection | string;  // Seção de origem

  // Posição no documento
  position: {
    start: number;               // Offset inicial no texto completo
    end: number;                 // Offset final
    order: number;               // Ordem no documento (0, 1, 2...)
  };

  // Embeddings
  embedding?: number[];          // Embedding do chunk

  // Metadata
  metadata: {
    wordCount: number;
    hasEquations?: boolean;
    hasTables?: boolean;
    hasFigures?: boolean;
    citations?: string[];        // DOIs citados neste chunk
    keywords?: string[];         // Keywords extraídas
  };

  // Context (chunks vizinhos para contexto)
  context?: {
    previous?: string;           // ID do chunk anterior
    next?: string;               // ID do próximo chunk
    parent?: string;             // ID da seção pai
  };
}

/**
 * Documento estruturado completo
 */
export interface StructuredContent {
  // Identificação
  articleId: string;
  format: ArticleFormat;

  // Texto completo
  raw: string;                   // Texto bruto original
  cleaned: string;               // Texto limpo (sem tags, formatação)

  // Seções estruturadas
  sections: {
    [key: string]: {
      title?: string;
      content: string;
      subsections?: {
        [key: string]: string;
      };
    };
  };

  // Chunks para RAG
  chunks: ContentChunk[];

  // Metadata do parsing
  parsingMetadata: {
    format: ArticleFormat;
    parsingMethod: 'grobid' | 'jats' | 'latex' | 'html' | 'fallback';
    quality: 'high' | 'medium' | 'low';
    warnings?: string[];
    timestamp: Date;
  };

  // Estatísticas
  stats: {
    totalWords: number;
    totalChunks: number;
    sectionsFound: number;
    referencesCount: number;
    figuresCount: number;
    tablesCount: number;
    equationsCount: number;
  };
}

/**
 * Opções de chunking
 */
export interface ChunkingOptions {
  strategy: 'paragraph' | 'sentence' | 'fixed' | 'semantic';

  // Tamanhos (em palavras)
  minSize?: number;              // Tamanho mínimo do chunk
  maxSize?: number;              // Tamanho máximo do chunk
  targetSize?: number;           // Tamanho alvo (para estratégia 'fixed')

  // Overlap
  overlap?: number;              // Número de palavras de overlap entre chunks

  // Contexto
  includeContext?: boolean;      // Incluir links para chunks vizinhos
  includeSectionTitle?: boolean; // Incluir título da seção no chunk

  // Filtros
  excludeSections?: StandardSection[];  // Seções a excluir (ex: references)
  includeOnly?: StandardSection[];      // Apenas estas seções

  // Embeddings
  generateEmbeddings?: boolean;  // Gerar embeddings para cada chunk
  embeddingModel?: string;       // Modelo de embedding
}

/**
 * Resultado do parsing de conteúdo
 */
export interface ContentParsingResult {
  success: boolean;
  content?: StructuredContent;
  error?: string;
  warnings?: string[];
}

/**
 * Mapeamento de formatos para métodos de parsing
 */
export const FORMAT_PARSERS: Record<ArticleFormat, string> = {
  jats: 'parseJATS',
  tei: 'parseTEI',
  latex: 'parseLaTeX',
  json: 'parseJSON',
  html: 'parseHTML',
  pdf: 'parseWithGrobid',
  epub: 'parseEPUB',
  plain: 'parsePlainText',
};

/**
 * Seções mínimas para artigo válido
 */
export const MINIMUM_SECTIONS: StandardSection[] = [
  'title',
  'abstract',
];

/**
 * Seções desejadas (não obrigatórias)
 */
export const DESIRED_SECTIONS: StandardSection[] = [
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
];

/**
 * Helper para validar conteúdo estruturado
 */
export function isValidStructuredContent(content: any): content is StructuredContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    typeof content.articleId === 'string' &&
    typeof content.raw === 'string' &&
    typeof content.cleaned === 'string' &&
    Array.isArray(content.chunks) &&
    typeof content.sections === 'object'
  );
}

/**
 * Helper para criar opções de chunking padrão
 */
export function createDefaultChunkingOptions(): ChunkingOptions {
  return {
    strategy: 'paragraph',
    minSize: 50,         // Mínimo 50 palavras
    maxSize: 500,        // Máximo 500 palavras
    overlap: 50,         // 50 palavras de overlap
    includeContext: true,
    includeSectionTitle: true,
    excludeSections: ['references', 'acknowledgments'],
    generateEmbeddings: false,
  };
}

/**
 * Helper para criar chunk mínimo
 */
export function createMinimalChunk(
  id: string,
  text: string,
  section: string,
  order: number
): ContentChunk {
  return {
    id,
    text,
    type: 'paragraph',
    section,
    position: {
      start: 0,
      end: text.length,
      order,
    },
    metadata: {
      wordCount: text.split(/\s+/).length,
    },
  };
}

/**
 * Helper para calcular quality score do parsing
 */
export function calculateParsingQuality(content: StructuredContent): 'high' | 'medium' | 'low' {
  const { stats } = content;

  // High quality: tem todas seções desejadas
  const hasMinimum = Object.keys(content.sections).some(s =>
    MINIMUM_SECTIONS.includes(s as StandardSection)
  );

  const hasDesired = DESIRED_SECTIONS.filter(s =>
    Object.keys(content.sections).includes(s)
  ).length;

  if (!hasMinimum) return 'low';
  if (hasDesired >= 4 && stats.totalWords > 1000) return 'high';
  if (hasDesired >= 2 && stats.totalWords > 500) return 'medium';

  return 'low';
}

/**
 * Regex patterns para extração de conteúdo
 */
export const CONTENT_PATTERNS = {
  // DOI pattern
  doi: /\b(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&\'])\S)+)\b/gi,

  // Email pattern
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // URL pattern
  url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi,

  // Citation pattern [CITE:X]
  citation: /\[CITE:([^\]]+)\]/g,

  // Equation pattern (LaTeX)
  equation: /\$\$?[^$]+\$\$?/g,

  // Section heading pattern
  heading: /^#{1,6}\s+(.+)$/gm,
};
