// ════════════════════════════════════════════════════════════
// VALIDATORS
// ════════════════════════════════════════════════════════════

import type { WorkSection } from '../types/search.types.js';
import { ARTICLE_REQUIREMENTS } from '../config/constants.js';

// Valid work sections
const VALID_SECTIONS: WorkSection[] = [
  'introduction',
  'literatureReview',
  'methodology',
  'results',
  'discussion',
  'conclusion'
];

export class Validators {

  /**
   * Validate search request body
   */
  static validateSearchRequest(body: any): { valid: boolean; error?: string } {
    if (!body.query || typeof body.query !== 'string') {
      return { valid: false, error: 'Query must be a non-empty string' };
    }

    if (body.query.length < 3) {
      return { valid: false, error: 'Query must be at least 3 characters' };
    }

    if (body.query.length > 500) {
      return { valid: false, error: 'Query must be less than 500 characters' };
    }

    if (!body.section) {
      return { valid: false, error: 'Section is required' };
    }

    if (!VALID_SECTIONS.includes(body.section as WorkSection)) {
      return { valid: false, error: 'Invalid section value' };
    }

    return { valid: true };
  }

  /**
   * Validate DOI format
   * DOI format: 10.XXXX/suffix
   */
  static validateDOI(doi: string): boolean {
    if (!doi || typeof doi !== 'string') {
      return false;
    }

    const doiRegex = /^10\.\d{4,}\/\S+$/;
    return doiRegex.test(doi);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  static validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate article ID (DOI, arXiv ID, PubMed ID, etc.)
   */
  static validateArticleId(id: string): { valid: boolean; type?: string } {
    if (!id || typeof id !== 'string') {
      return { valid: false };
    }

    // Check DOI
    if (this.validateDOI(id)) {
      return { valid: true, type: 'doi' };
    }

    // Check arXiv ID (e.g., 2103.12345, 1234.5678v2)
    if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(id)) {
      return { valid: true, type: 'arxiv' };
    }

    // Check PubMed ID (PMID) - numeric only
    if (/^\d{7,8}$/.test(id)) {
      return { valid: true, type: 'pubmed' };
    }

    // Check URL
    if (this.validateURL(id)) {
      return { valid: true, type: 'url' };
    }

    return { valid: false };
  }

  /**
   * Sanitize query string
   * Remove potentially harmful characters and limit length
   */
  static sanitizeQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    return query
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[\\${}]/g, '') // Remove potential injection characters
      .substring(0, 500); // Limit length
  }

  /**
   * Sanitize filename
   * Remove directory traversal and special characters
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed';
    }

    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/^\.+/, '') // Remove leading dots
      .substring(0, 255); // Limit length
  }

  /**
   * Validate year range
   */
  static validateYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return year >= 1900 && year <= currentYear + 1;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(params: any): { page: number; limit: number; error?: string } {
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 20;

    if (page < 1) {
      return { page: 1, limit, error: 'Page must be >= 1' };
    }

    if (limit < 1 || limit > 100) {
      return { page, limit: 20, error: 'Limit must be between 1 and 100' };
    }

    return { page, limit };
  }

  /**
   * Validate section name
   */
  static validateSection(section: any): boolean {
    return VALID_SECTIONS.includes(section as WorkSection);
  }

  /**
   * Validate filter object for search
   */
  static validateSearchFilters(filters: any): { valid: boolean; error?: string } {
    if (!filters || typeof filters !== 'object') {
      return { valid: true }; // Filters are optional
    }

    // Validate year range
    if (filters.yearFrom !== undefined) {
      const year = parseInt(filters.yearFrom);
      if (isNaN(year) || !this.validateYear(year)) {
        return { valid: false, error: 'Invalid yearFrom' };
      }
    }

    if (filters.yearTo !== undefined) {
      const year = parseInt(filters.yearTo);
      if (isNaN(year) || !this.validateYear(year)) {
        return { valid: false, error: 'Invalid yearTo' };
      }
    }

    // Validate requireFullText
    if (filters.requireFullText !== undefined && typeof filters.requireFullText !== 'boolean') {
      return { valid: false, error: 'requireFullText must be boolean' };
    }

    // Validate minQuality
    if (filters.minQuality !== undefined) {
      const quality = parseFloat(filters.minQuality);
      if (isNaN(quality) || quality < 0 || quality > 1) {
        return { valid: false, error: 'minQuality must be between 0 and 1' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate article object has required fields
   */
  static validateArticle(article: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!article) {
      return { valid: false, errors: ['Article is null or undefined'] };
    }

    if (!article.title || typeof article.title !== 'string') {
      errors.push('Missing or invalid title');
    }

    if (!article.doi && !article.id && !article.link) {
      errors.push('Missing identifier (doi, id, or link)');
    }

    if (article.doi && !this.validateDOI(article.doi)) {
      errors.push('Invalid DOI format');
    }

    if (article.year !== undefined && !this.validateYear(article.year)) {
      errors.push('Invalid publication year');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
