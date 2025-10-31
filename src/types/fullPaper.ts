/**
 * Tipos para representar artigos acadêmicos completos com texto extraído
 */

export interface PaperSection {
  title: string;
  content: string;
  subsections?: PaperSection[];
  level: number; // 1 = seção principal, 2 = subseção, etc
}

export interface PaperFigure {
  id: string;
  caption: string;
  url?: string;
  extractedText?: string; // Texto extraído via OCR se disponível
}

export interface PaperTable {
  id: string;
  caption: string;
  content: string[][]; // Matriz de dados da tabela
  rawText?: string;
}

export interface PaperEquation {
  id: string;
  latex?: string;
  rawText: string;
}

export interface PaperReference {
  id: string;
  text: string;
  doi?: string;
  url?: string;
}

export interface PaperMetadata {
  extractedAt: Date;
  extractionMethod: 'grobid' | 'pdf-parse' | 'ocr' | 'hybrid';
  pdfUrl?: string;
  pdfSize?: number;
  pageCount?: number;
  language?: string;
  confidence?: number; // 0-1, confiança na extração
}

export interface NLPEnrichment {
  entities?: Array<{
    text: string;
    type: 'person' | 'organization' | 'location' | 'concept' | 'method';
    confidence: number;
  }>;
  keywords?: Array<{
    text: string;
    score: number;
  }>;
  summary?: string;
  sentiment?: {
    score: number; // -1 a 1
    label: 'positive' | 'neutral' | 'negative';
  };
}

/**
 * Interface completa para paper com texto extraído
 */
export interface FullPaper {
  // Metadados básicos (compatível com AcademicSource)
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
  doi?: string;
  source: string; // 'semantic-scholar', 'arxiv', 'core', etc
  
  // Conteúdo completo extraído
  fullText?: {
    sections: PaperSection[];
    figures?: PaperFigure[];
    tables?: PaperTable[];
    equations?: PaperEquation[];
    references?: PaperReference[];
    rawText?: string; // Texto completo sem estrutura
  };
  
  // Metadados da extração
  extraction?: PaperMetadata;
  
  // Enriquecimentos via NLP
  enrichment?: NLPEnrichment;
  
  // Embeddings para busca vetorial
  embeddings?: {
    abstract?: number[];
    fullText?: number[];
    sections?: { [sectionTitle: string]: number[] };
  };
  
  // Campos originais para compatibilidade
  citationCount?: number;
  venue?: string;
  fields?: string[];
}

/**
 * Configuração para extração de texto
 */
export interface ExtractionConfig {
  method: 'grobid' | 'pdf-parse' | 'auto';
  enableOCR: boolean;
  enableNLP: boolean;
  generateEmbeddings: boolean;
  maxPdfSize?: number; // em bytes
  timeout?: number; // em ms
}

/**
 * Resultado da extração
 */
export interface ExtractionResult {
  success: boolean;
  paper?: FullPaper;
  error?: string;
  metadata: PaperMetadata;
}
