import { z } from 'zod';

// ============================================================
// Request/Response Schemas
// ============================================================

export const TaskDescriptionSchema = z.object({
  type: z.string(),
  style: z.string(),
  audience: z.string(),
  wordCount: z.string()
});

export const ExecutionPlanSchema = z.object({
  thinking: z.array(z.string()),
  research: z.array(z.string()),
  writing: z.array(z.string())
});

export const TaskPlanSchema = z.object({
  taskTitle: z.string(),
  taskDescription: TaskDescriptionSchema,
  executionPlan: ExecutionPlanSchema
});

export const GenerateTaskPlanRequestSchema = z.object({
  query: z.string().min(10, 'Query must be at least 10 characters').max(1000, 'Query too long')
});

export const MindMapNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  data: z.object({
    label: z.string()
  }),
  position: z.object({
    x: z.number(),
    y: z.number()
  })
});

export const MindMapEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  animated: z.boolean().optional()
});

export const MindMapDataSchema = z.object({
  nodes: z.array(MindMapNodeSchema),
  edges: z.array(MindMapEdgeSchema)
});

export const AcademicSourceSchema = z.object({
  uri: z.string(),
  title: z.string(),
  authors: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  summary: z.string().optional(),
  sourceProvider: z.string(),
  citationCount: z.number().optional(),
  doi: z.string().optional(),
  pdfUrl: z.string().optional(),
  fullText: z.string().optional(),
  sections: z.object({
    abstract: z.string().optional(),
    introduction: z.string().optional(),
    methodology: z.string().optional(),
    results: z.string().optional(),
    discussion: z.string().optional(),
    conclusion: z.string().optional()
  }).optional()
});

export const ResearchStepRequestSchema = z.object({
  step: z.string(),
  originalQuery: z.string(),
  filters: z.object({
    startYear: z.number().optional(),
    endYear: z.number().optional(),
    minCitations: z.number().optional(),
    language: z.string().optional(),
    sourceTypes: z.array(z.string()).optional()
  }).optional()
});

// ============================================================
// Academic Search Types
// ============================================================

export interface AcademicSearchFilters {
  startYear?: number;
  endYear?: number;
  minCitations?: number;
  maxResults?: number;
  language?: string;
  sourceTypes?: string[];
  openAccessOnly?: boolean;
}

export interface AcademicAPIResult {
  fonte: string;
  titulo: string;
  autores?: string;
  ano?: string | number;
  resumo?: string;
  link: string;
  doi?: string;
  citationCount?: number;
  pdfUrl?: string;
  isOpenAccess?: boolean;
}

export interface PDFExtractionResult {
  fullText: string;
  sections: {
    abstract?: string;
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
  metadata: {
    pages: number;
    wordCount: number;
  };
}

// ============================================================
// Cache Types
// ============================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================
// Export Type Aliases
// ============================================================

export type TaskPlan = z.infer<typeof TaskPlanSchema>;
export type TaskDescription = z.infer<typeof TaskDescriptionSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type MindMapData = z.infer<typeof MindMapDataSchema>;
export type AcademicSource = z.infer<typeof AcademicSourceSchema>;
export type ResearchStepRequest = z.infer<typeof ResearchStepRequestSchema>;
