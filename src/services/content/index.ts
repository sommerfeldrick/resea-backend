/**
 * Barrel export for content services
 * Usage: import { parserFactory, embeddingsService, contentAcquisition } from '@/services/content'
 */

export * from './parser-factory.service.js';
export * from './full-text-validator.service.js';
export * from './multi-format-detector.service.js';
export * from './content-acquisition.service.js';
export * from './chunking.service.js';

// Re-export embeddings service (defined in parent services/)
export { embeddingsService, EmbeddingsService } from '../embeddings.service.js';
