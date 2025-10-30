/**
 * API Service - Connects frontend to backend
 * Uses new /api/research/* endpoints for content generation
 */

import type { TaskPlan, MindMapData, ResearchResult, AcademicSource } from '../types';
import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Generic API request helper with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get auth token
  const token = authService.getToken();

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`
      }));
      throw new Error(error.error || 'Request failed');
    }

    const data = await response.json();

    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error: any) {
    console.error(`API request failed: ${endpoint}`, error);
    throw new Error(error.message || 'Failed to connect to server');
  }
}

/**
 * Generate research plan from user query
 * Uses new /api/research/plan endpoint
 */
export async function generateResearchPlan(query: string, template?: string): Promise<{
  plan: string;
  remaining: number;
}> {
  console.log('🔄 Generating research plan via backend...');

  const response = await apiRequest<any>('/api/research/plan', {
    method: 'POST',
    body: JSON.stringify({ query, template })
  });

  console.log('✅ Research plan generated', { remaining: response.remaining });
  return {
    plan: response.plan,
    remaining: response.remaining
  };
}

/**
 * Generate task plan from user query (legacy - kept for compatibility)
 */
export async function generateTaskPlan(query: string): Promise<TaskPlan> {
  console.log('🔄 Generating task plan via backend...');

  const response = await apiRequest<TaskPlan>('/api/generate-plan', {
    method: 'POST',
    body: JSON.stringify({ query })
  });

  console.log('✅ Task plan generated');
  return response;
}

/**
 * Generate mind map from task plan
 */
export async function generateMindMap(plan: TaskPlan): Promise<MindMapData> {
  console.log('🔄 Generating mind map via backend...');

  const response = await apiRequest<MindMapData>('/api/generate-mindmap', {
    method: 'POST',
    body: JSON.stringify(plan)
  });

  console.log('✅ Mind map generated');
  return response;
}

/**
 * Perform research step with enhanced filters
 */
export async function performResearchStep(
  step: string,
  originalQuery: string,
  filters?: {
    startYear?: number;
    endYear?: number;
    minCitations?: number;
    maxResults?: number;
    openAccessOnly?: boolean;
  }
): Promise<{ summary: string; sources: AcademicSource[] }> {
  console.log('🔄 Performing research step via backend...', { step });

  const response = await apiRequest<{ summary: string; sources: AcademicSource[] }>(
    '/api/research-step',
    {
      method: 'POST',
      body: JSON.stringify({
        step,
        originalQuery,
        filters: filters || {}
      })
    }
  );

  console.log('✅ Research step completed', { sourcesFound: response.sources.length });
  return response;
}

/**
 * Generate document outline
 */
export async function generateOutline(
  plan: TaskPlan,
  researchResults: ResearchResult[]
): Promise<string> {
  console.log('🔄 Generating outline via backend...');

  const response = await apiRequest<{ outline: string }>('/api/generate-outline', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      researchResults
    })
  });

  console.log('✅ Outline generated');
  return response.outline;
}

/**
 * Generate content with streaming
 */
export async function* generateContentStream(
  plan: TaskPlan,
  researchResults: ResearchResult[]
): AsyncGenerator<string> {
  console.log('🔄 Starting content generation stream via backend...');

  const url = `${API_BASE_URL}/api/generate-content`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan,
      researchResults
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process Server-Sent Events
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.done) {
            console.log('✅ Content generation completed');
            return;
          }

          if (data.chunk) {
            yield data.chunk;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Generate content using new research API
 * Uses scraping + multi-AI fallback
 */
export async function generateResearchContent(
  query: string,
  template?: string
): Promise<{
  content: string;
  wordCount: number;
  sourcesCount: number;
  remaining: number;
}> {
  console.log('🔄 Generating content via backend (scraping + AI)...');

  const response = await apiRequest<any>('/api/research/generate', {
    method: 'POST',
    body: JSON.stringify({ query, template })
  });

  console.log('✅ Content generated', {
    words: response.wordCount,
    sources: response.sourcesCount,
    remaining: response.remaining
  });

  return {
    content: response.content,
    wordCount: response.wordCount,
    sourcesCount: response.sourcesCount,
    remaining: response.remaining
  };
}

/**
 * Finalize document and deduct credits
 * This is the ONLY endpoint that actually charges credits
 */
export async function finalizeDocument(
  content: string,
  title?: string
): Promise<{
  wordCount: number;
  remaining: number;
  message: string;
}> {
  console.log('🔄 Finalizing document and deducting credits...');

  const response = await apiRequest<any>('/api/research/finalize', {
    method: 'POST',
    body: JSON.stringify({ content, title })
  });

  console.log('✅ Document finalized', {
    charged: response.wordCount,
    remaining: response.remaining
  });

  return {
    wordCount: response.wordCount,
    remaining: response.remaining,
    message: response.message
  };
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
  cache: any;
  searchStats: any;
}> {
  return apiRequest('/api/health', { method: 'GET' });
}

/**
 * Clear cache (admin function)
 */
export async function clearCache(): Promise<void> {
  await apiRequest('/api/cache/clear', { method: 'POST' });
  console.log('✅ Cache cleared');
}
