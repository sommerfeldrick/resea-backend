/**
 * Tipos relacionados ao sistema de templates
 */

import { AcademicTemplate } from '../data/academicTemplates';

// Template favorito do usuário
export interface FavoriteTemplate {
  id: string;
  templateId: string;
  userId: string;
  addedAt: Date;
}

// Histórico de uso de templates
export interface TemplateUsage {
  id: string;
  templateId: string;
  userId: string;
  usedAt: Date;
  filledData: Record<string, any>; // Dados preenchidos pelo usuário
  generatedPrompt: string;
}

// Template personalizado criado pelo usuário
export interface CustomTemplate extends Omit<AcademicTemplate, 'id' | 'popularityScore'> {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  usageCount: number;
  likes: number;
}

// Template compartilhado
export interface SharedTemplate {
  id: string;
  customTemplateId: string;
  sharedBy: string;
  sharedAt: Date;
  views: number;
  uses: number;
  ratings: TemplateRating[];
  averageRating: number;
}

// Avaliação de template
export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

// Analytics de template
export interface TemplateAnalytics {
  templateId: string;
  totalUses: number;
  uniqueUsers: number;
  averageCompletionTime: number; // em segundos
  successRate: number; // 0-1
  lastUsed: Date;
  popularityTrend: 'rising' | 'stable' | 'declining';
  categoryRank: number;
}

// Arquivo anexado
export interface UploadedFile {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // em bytes
  uploadedAt: Date;
  processedAt?: Date;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  extractedText?: string;
  metadata?: FileMetadata;
  url?: string;
}

// Metadata extraída de arquivo
export interface FileMetadata {
  pageCount?: number;
  wordCount?: number;
  author?: string;
  title?: string;
  keywords?: string[];
  createdDate?: Date;
  language?: string;
}

// Pré-visualização de template
export interface TemplatePreview {
  templateId: string;
  examplePrompt: string;
  exampleOutput: string;
  estimatedQuality: 'high' | 'medium' | 'low';
  keyFeatures: string[];
}
