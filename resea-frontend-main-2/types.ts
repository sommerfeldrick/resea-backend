import type * as Reactflow from 'reactflow';

export interface TaskDescription {
  type: string;
  style: string;
  audience: string;
  wordCount: string;
}

export interface ExecutionPlan {
  thinking: string[];
  research: string[];
  writing: string[];
}

export interface TaskPlan {
  taskTitle: string;
  taskDescription: TaskDescription;
  executionPlan: ExecutionPlan;
}

export interface MindMapData {
    nodes: Reactflow.Node[];
    edges: Reactflow.Edge[];
}

export interface AcademicSource {
    uri: string;
    title: string;
    authors?: string;
    year?: string | number;
    summary?: string; // abstract
    sourceProvider: string;
    citationCount?: number;
}

export interface ResearchResult {
    query: string;
    sources: AcademicSource[];
    summary: string;
}

export interface CompletedResearch {
    id: string;
    query: string;
    taskPlan: TaskPlan;
    mindMapData: MindMapData | null;
    researchResults: ResearchResult[];
    outline: string;
    writtenContent: string;
}
