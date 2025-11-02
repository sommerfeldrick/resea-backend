/**
 * Tipos legados do sistema
 * Mantidos para compatibilidade retroativa enquanto migramos para o novo sistema
 * TODO: Migrar gradualmente para article.types.ts, search.types.ts, content.types.ts
 */

import { z } from 'zod';

// ============================================
// CACHE TYPES
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;  // Time to live in milliseconds (Infinity = persistent)
}

// ============================================
// TASK PLAN TYPES (Gemini Service)
// ============================================

/**
 * Task plan structure for research projects
 */
export interface TaskPlan {
  taskTitle: string;
  taskDescription: {
    type: string;           // e.g., 'revisão de literatura acadêmica'
    style: string;          // e.g., 'acadêmico formal humanizado'
    audience: string;       // e.g., 'pesquisadores e acadêmicos'
    wordCount: string;      // e.g., '8000-12000 palavras'
  };
  executionPlan: {
    thinking: string[];     // Etapas de pensamento/planejamento
    research: string[];     // Etapas de pesquisa
    writing: string[];      // Etapas de escrita
  };
}

/**
 * Mind map data structure for ReactFlow
 */
export interface MindMapData {
  nodes: Array<{
    id: string;
    type?: string;           // node type (e.g., 'input', 'default')
    data: { label: string };
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    animated?: boolean;      // animated edges
  }>;
}

// ============================================
// PDF EXTRACTION TYPES
// ============================================

/**
 * Result of PDF extraction
 */
export interface PDFExtractionResult {
  title?: string;
  text?: string;             // Raw text (optional if fullText provided)
  fullText?: string;         // Full extracted text
  numPages?: number;         // Number of pages (optional)
  metadata?: {
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    pages?: number;          // Alternative to numPages
    wordCount?: number;
    [key: string]: any;
  };
  sections?: {
    abstract?: string;
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
    [key: string]: string | undefined;
  };
}

// ============================================
// ACADEMIC SEARCH TYPES (Legacy)
// ============================================

/**
 * Academic source (legacy - use AcademicArticle from article.types.ts)
 */
export interface AcademicSource {
  id?: string;
  uri: string;              // URL of the article
  title: string;
  authors: string;          // Comma-separated string of authors
  year: number;
  summary: string;          // Abstract/summary
  sourceProvider: string;   // API name (semantic-scholar, arxiv, etc)
  citationCount?: number;
  doi?: string;
  pdfUrl?: string;
  venue?: string;
  fields?: string[];
  isOpenAccess?: boolean;
  sections?: {              // Full text sections (from scraping/GROBID)
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Academic search filters (legacy - use SearchFilters from search.types.ts)
 */
export interface AcademicSearchFilters {
  yearMin?: number;
  yearMax?: number;
  minCitations?: number;
  openAccessOnly?: boolean;
  sources?: string[];  // Specific APIs to query
  limit?: number;
  offset?: number;
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

/**
 * Schema for generate-plan request
 */
export const GenerateTaskPlanRequestSchema = z.object({
  query: z.string().min(10, 'Query deve ter pelo menos 10 caracteres')
});

/**
 * Schema for task plan validation
 */
export const TaskPlanSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.object({
    type: z.string(),
    style: z.string(),
    audience: z.string(),
    wordCount: z.string()
  }),
  executionPlan: z.object({
    thinking: z.array(z.string()),
    research: z.array(z.string()),
    writing: z.array(z.string())
  })
});

// Infer TaskPlan type from schema to ensure they match
export type TaskPlanInferred = z.infer<typeof TaskPlanSchema>;

/**
 * Schema for research step request
 */
export const ResearchStepRequestSchema = z.object({
  step: z.string().min(5, 'Step deve ter pelo menos 5 caracteres'),
  originalQuery: z.string(),
  filters: z.object({
    yearMin: z.number().optional(),
    yearMax: z.number().optional(),
    minCitations: z.number().optional(),
    openAccessOnly: z.boolean().optional(),
    sources: z.array(z.string()).optional(),
    limit: z.number().optional(),
    offset: z.number().optional()
  }).optional()
});

/**
 * Schema for mind map data
 */
export const MindMapDataSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    data: z.object({ label: z.string() }),
    position: z.object({ x: z.number(), y: z.number() })
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string()
  }))
});

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if object is a valid TaskPlan
 */
export function isTaskPlan(obj: any): obj is TaskPlan {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.taskTitle === 'string' &&
    typeof obj.taskDescription === 'object' &&
    typeof obj.executionPlan === 'object' &&
    Array.isArray(obj.executionPlan.thinking) &&
    Array.isArray(obj.executionPlan.research) &&
    Array.isArray(obj.executionPlan.writing)
  );
}

/**
 * Check if object is a valid MindMapData
 */
export function isMindMapData(obj: any): obj is MindMapData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges)
  );
}
