/**
 * Barrel export para todos os tipos do sistema
 * Facilita imports: import { AcademicArticle, SearchOptions } from '@/types'
 */

// Article types
export * from './article.types.js';

// Search types
export * from './search.types.js';

// Content types
export * from './content.types.js';

// Legacy types (backward compatibility)
export * from './legacy.types.js';

// Full paper types (existing)
export * from './fullPaper.js';

// Research flow types (8-phase wizard)
export * from './research-flow.types.js';
