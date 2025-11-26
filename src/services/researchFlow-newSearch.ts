/**
 * NEW PARALLEL SEARCH IMPLEMENTATION
 *
 * Replaces old sequential P1→P2→P3 logic with:
 * 1. Parallel search of ALL queries across ALL 8 APIs
 * 2. Deduplication by DOI
 * 3. Unified scoring based on Journal IF, Study Type, Citations
 * 4. Classification P1/P2/P3 AFTER scoring (not before)
 */

import type { FlowSearchStrategy, FlowEnrichedArticle, FlowSearchProgress, PriorityLevel } from '../types/research-flow.types.js';
import type { AcademicArticle } from '../types/article.types.js';
import { createLogger } from '../utils/logger.js';
import { OpenAlexService } from './apis/openalex.service.js';
import { ArxivService } from './apis/arxiv.service.js';
import { EuropePMCService } from './apis/europepmc.service.js';
import { CrossrefService } from './apis/crossref.service.js';
import { PubMedService } from './apis/pubmed.service.js';
import { DOAJService } from './apis/doaj.service.js';
import { PLOSService } from './apis/plos.service.js';
import { UnpaywallService } from './apis/unpaywall.service.js';
import { journalMetricsService } from './journalMetrics.service.js';
import scoringConfig from '../config/scoringConfig.js';

const logger = createLogger('NewParallelSearch');

// Initialize all 8 API services
const openAlexService = new OpenAlexService();
const arxivService = new ArxivService();
const europePMCService = new EuropePMCService();
const crossrefService = new CrossrefService();
const pubmedService = new PubMedService();
const doajService = new DOAJService();
const plosService = new PLOSService();
const unpaywallService = new UnpaywallService();

interface ScoringResult {
  article: AcademicArticle;
  score: number;
  priority: PriorityLevel;
  reasons: string[];
}

/**
 * NEW: Calculate article score based on Journal IF, Study Type, Citations
 * This is a simplified version - full implementation in next task
 */
function calculateNewScore(article: AcademicArticle, query: string): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Placeholder scoring (will be replaced in next task with full implementation)
  // For now, use basic metrics to make it functional

  // Title relevance (5 pts)
  const titleLower = article.title?.toLowerCase() || '';
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 3);
  const matchingTerms = queryTerms.filter(term => titleLower.includes(term));
  const titleScore = Math.min(5, (matchingTerms.length / queryTerms.length) * 5);
  score += titleScore;
  if (titleScore > 0) {
    reasons.push(`Title relevance: ${titleScore.toFixed(1)} pts`);
  }

  // Has full-text structure (10 pts)
  if (article.sections && Object.keys(article.sections).length > 0) {
    score += 10;
    reasons.push('Full-text structured: +10 pts');
  }

  // Citations (20 pts max, scaled)
  const citations = article.citationCount || 0;
  let citationScore = 0;
  if (citations >= 100) citationScore = 20;
  else if (citations >= 50) citationScore = 15;
  else if (citations >= 20) citationScore = 10;
  else if (citations >= 5) citationScore = 5;
  score += citationScore;
  if (citationScore > 0) {
    reasons.push(`Citations: ${citations} → ${citationScore} pts`);
  }

  // Determine priority based on score
  // Using current thresholds (will be updated in task 5)
  let priority: PriorityLevel;
  const thresholds = scoringConfig.getThresholds();
  if (score >= thresholds.P1) {
    priority = 'P1';
  } else if (score >= thresholds.P2) {
    priority = 'P2';
  } else if (score >= thresholds.P3) {
    priority = 'P3';
  } else {
    priority = 'P3'; // Minimum accepted
  }

  return {
    article,
    score: Math.round(score),
    priority,
    reasons
  };
}

/**
 * Deduplicate articles by DOI and title similarity
 */
function deduplicateArticles(articles: AcademicArticle[]): AcademicArticle[] {
  const seen = new Map<string, AcademicArticle>();

  for (const article of articles) {
    // Primary key: DOI
    if (article.doi) {
      const doiKey = article.doi.toLowerCase().trim();
      if (!seen.has(doiKey)) {
        seen.set(doiKey, article);
      }
      continue;
    }

    // Secondary key: normalized title (for articles without DOI)
    if (article.title) {
      const titleKey = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100); // First 100 chars

      if (!seen.has(titleKey)) {
        seen.set(titleKey, article);
      }
    }
  }

  logger.info(`Deduplication: ${articles.length} → ${seen.size} articles`);
  return Array.from(seen.values());
}

/**
 * Search a single query across all APIs in parallel
 */
async function searchQueryAcrossAPIs(
  query: string,
  limit: number,
  filters: { requireFullText?: boolean }
): Promise<AcademicArticle[]> {
  logger.debug(`Searching query across all APIs: "${query.substring(0, 50)}..."`);

  // Search all APIs in parallel
  const searchPromises = [
    openAlexService.search(query, limit, filters),
    arxivService.search(query, limit, filters),
    europePMCService.search(query, limit, filters),
    crossrefService.search(query, limit, filters),
    pubmedService.search(query, limit, filters),
    doajService.search(query, limit, filters),
    plosService.search(query, limit, filters),
    // Note: Unpaywall doesn't support keyword search, only DOI lookup
  ];

  const results = await Promise.allSettled(searchPromises);

  // Collect successful results
  const articles: AcademicArticle[] = [];
  results.forEach((result, index) => {
    const apiNames = ['OpenAlex', 'arXiv', 'EuropePMC', 'Crossref', 'PubMed', 'DOAJ', 'PLOS'];
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
      logger.debug(`${apiNames[index]}: ${result.value.length} articles`);
    } else {
      logger.warn(`${apiNames[index]} search failed: ${result.reason}`);
    }
  });

  logger.info(`Query "${query.substring(0, 30)}...": ${articles.length} total articles from all APIs`);
  return articles;
}

/**
 * NEW IMPLEMENTATION: Execute exhaustive search with parallel queries and APIs
 */
export async function executeExhaustiveSearchV2(
  strategy: FlowSearchStrategy,
  onProgress?: (progress: FlowSearchProgress) => void,
  researchId?: number
): Promise<FlowEnrichedArticle[]> {
  const startTime = Date.now();
  const targetArticles = strategy.targetArticles || 50;

  logger.info('🚀 Starting NEW parallel exhaustive search', {
    topic: strategy.topic,
    totalQueries: strategy.queries.length,
    targetArticles,
    dateRange: `${strategy.filters.dateRange.start}-${strategy.filters.dateRange.end}`
  });

  try {
    // ================================================================
    // STEP 1: Search ALL queries in parallel across ALL APIs
    // ================================================================
    logger.info('📡 STEP 1: Searching all queries in parallel...');

    const searchFilters = {
      requireFullText: true,  // Only articles with full-text available
    };

    // Execute all query searches in parallel
    const querySearchPromises = strategy.queries.map(queryObj =>
      searchQueryAcrossAPIs(queryObj.query, queryObj.expectedResults || 15, searchFilters)
    );

    const queryResults = await Promise.allSettled(querySearchPromises);

    // Collect all articles from all queries
    const allRawArticles: AcademicArticle[] = [];
    queryResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allRawArticles.push(...result.value);
        logger.info(`Query ${index + 1}/${strategy.queries.length}: ${result.value.length} articles`);
      } else {
        logger.warn(`Query ${index + 1} failed: ${result.reason}`);
      }
    });

    logger.info(`Total raw articles collected: ${allRawArticles.length}`);

    if (allRawArticles.length === 0) {
      logger.warn('No articles found from any API');
      return [];
    }

    // Report progress: 25% (search complete)
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',  // Not used anymore, but keep for compatibility
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: allRawArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Deduplicating articles...'
      });
    }

    // ================================================================
    // STEP 2: Deduplicate by DOI and title
    // ================================================================
    logger.info('🔍 STEP 2: Deduplicating articles...');

    const uniqueArticles = deduplicateArticles(allRawArticles);

    logger.info(`After deduplication: ${uniqueArticles.length} unique articles`);

    // ================================================================
    // STEP 3: Score ALL articles with unified scoring system
    // ================================================================
    logger.info('🎯 STEP 3: Scoring all articles...');

    const scoredArticles: ScoringResult[] = uniqueArticles.map(article =>
      calculateNewScore(article, strategy.originalQuery)
    );

    // Filter out very low scores (below minimum threshold)
    const thresholds = scoringConfig.getThresholds();
    const acceptableArticles = scoredArticles.filter(
      result => result.score >= thresholds.minAcceptable
    );

    logger.info(`After quality filter: ${acceptableArticles.length}/${uniqueArticles.length} articles`);

    // Report progress: 50% (scoring complete)
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: acceptableArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Sorting and classifying...'
      });
    }

    // ================================================================
    // STEP 4: Sort by score (descending) and take top N
    // ================================================================
    logger.info('📊 STEP 4: Sorting by score and selecting top articles...');

    acceptableArticles.sort((a, b) => b.score - a.score);

    // Take target number of articles (or all if less than target)
    const topArticles = acceptableArticles.slice(0, targetArticles);

    logger.info(`Selected top ${topArticles.length} articles`, {
      P1Count: topArticles.filter(a => a.priority === 'P1').length,
      P2Count: topArticles.filter(a => a.priority === 'P2').length,
      P3Count: topArticles.filter(a => a.priority === 'P3').length,
      avgScore: (topArticles.reduce((sum, a) => sum + a.score, 0) / topArticles.length).toFixed(1)
    });

    // ================================================================
    // STEP 5: Convert to FlowEnrichedArticle format
    // ================================================================
    const enrichedArticles: FlowEnrichedArticle[] = topArticles.map(result => ({
      ...result.article,
      score: {
        score: result.score,
        priority: result.priority,
        reasons: result.reasons,
        breakdown: {
          titleRelevance: 0,  // Will be properly calculated in next task
          citations: result.article.citationCount || 0,
          recency: 0,
          hasFulltext: !!result.article.sections,
          sourceQuality: 0,
          hasDoi: !!result.article.doi,
          hasCompleteAbstract: !!(result.article.abstract && result.article.abstract.length > 100)
        }
      }
    }));

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info(`✅ Search complete in ${elapsedTime}s`, {
      totalArticles: enrichedArticles.length,
      targetArticles,
      queriesSearched: strategy.queries.length,
      APIsUsed: 7,  // All except Unpaywall (DOI-only)
    });

    // Final progress report
    if (onProgress) {
      onProgress({
        currentPriority: 'P1',
        currentQuery: strategy.queries.length,
        totalQueries: strategy.queries.length,
        articlesFound: enrichedArticles.length,
        targetArticles,
        estimatedTimeRemaining: 0,
        phase: 'Search complete!'
      });
    }

    return enrichedArticles;
  } catch (error: any) {
    logger.error('Search failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
