/**
 * Hybrid Exhaustive Search Service
 * Main search service with priority-based exhaustive search (P1 → P2 → P3)
 * Combines local (Qdrant + Elasticsearch) and external (13 APIs) sources
 */

import type { EnrichedArticle, AcademicArticle } from '../../types/article.types.js';
import type { WorkSection, UserApprovalCallback } from '../../types/search.types.js';
import { ARTICLE_COUNT_BY_SECTION } from '../../config/constants.js';
import { HybridLocalSearchService } from './hybrid-local-search.service.js';
import { ExternalAPIsService } from '../apis/external-apis.service.js';
import { QualityScorerService } from '../quality/quality-scorer.service.js';
import { CrossEncoderService } from '../quality/cross-encoder.service.js';
import { MultiFormatDetectorService } from '../content/multi-format-detector.service.js';
import { FullTextValidatorService } from '../content/full-text-validator.service.js';
import { QueryExpansionService } from './query-expansion.service.js';
import { SemanticCacheService } from '../cache/semantic-cache.service.js';
import { Logger } from '../../utils/simple-logger.js';

export class HybridExhaustiveSearchService {
  private localSearch: HybridLocalSearchService;
  private externalAPIs: ExternalAPIsService;
  private qualityScorer: QualityScorerService;
  private crossEncoder: CrossEncoderService;
  private formatDetector: MultiFormatDetectorService;
  private validator: FullTextValidatorService;
  private queryExpander: QueryExpansionService;
  private cache: SemanticCacheService;
  private logger: Logger;

  constructor() {
    this.localSearch = new HybridLocalSearchService();
    this.externalAPIs = new ExternalAPIsService();
    this.qualityScorer = new QualityScorerService();
    this.crossEncoder = new CrossEncoderService();
    this.formatDetector = new MultiFormatDetectorService();
    this.validator = new FullTextValidatorService();
    this.queryExpander = new QueryExpansionService();
    this.cache = new SemanticCacheService();
    this.logger = new Logger('HybridExhaustiveSearch');
  }

  /**
   * EXHAUSTIVE SEARCH WITH PRIORITIES
   */
  async searchExhaustive(
    query: string,
    section: WorkSection,
    userApprovalCallback?: UserApprovalCallback
  ): Promise<EnrichedArticle[]> {
    const targetCount = ARTICLE_COUNT_BY_SECTION[section];

    this.logger.info('═'.repeat(60));
    this.logger.info(`🎯 EXHAUSTIVE SEARCH STARTED`);
    this.logger.info(`   Query: "${query}"`);
    this.logger.info(`   Section: ${section}`);
    this.logger.info(`   Target: ${targetCount} articles`);
    this.logger.info('═'.repeat(60));

    // ═══════════════════════════════════════════════════════
    // STEP 1: CHECK CACHE
    // ═══════════════════════════════════════════════════════
    const cachedResults = await this.cache.get(query, section);
    if (cachedResults && cachedResults.length >= targetCount) {
      this.logger.info('⚡ CACHE HIT! Returning in 50ms');
      return cachedResults.slice(0, targetCount);
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: EXPAND QUERY
    // ═══════════════════════════════════════════════════════
    const strategy = await this.queryExpander.expandQuery(query);

    this.logger.info('\n📋 SEARCH STRATEGY:');
    this.logger.info(`   P1 Query: "${strategy.primaryQuery}"`);
    this.logger.info(`   P2 Queries: [${strategy.secondaryQueries.join(', ')}]`);
    this.logger.info(`   P3 Queries: [${strategy.tertiaryQueries.join(', ')}]`);

    let allArticles: EnrichedArticle[] = [];

    // ═══════════════════════════════════════════════════════
    // PHASE 1: EXHAUST P1
    // ═══════════════════════════════════════════════════════
    this.logger.info('\n╔═══════════════════════════════════════════════════╗');
    this.logger.info('║ 🔥 PHASE 1: EXHAUSTIVE P1 SEARCH                ║');
    this.logger.info('║ (Excellent Articles - Score >= 75)              ║');
    this.logger.info('╚═══════════════════════════════════════════════════╝');

    const p1Articles = await this.exhaustPriority([strategy.primaryQuery], 1, targetCount * 2);

    this.printPhaseResults('P1', p1Articles);

    // Check if target reached
    if (p1Articles.length >= targetCount) {
      this.logger.info(`\n🎉 TARGET REACHED WITH P1 ONLY!`);
      allArticles = p1Articles.slice(0, targetCount);

      await this.cache.set(query, section, allArticles);

      if (userApprovalCallback) {
        await userApprovalCallback(allArticles, 'P1_COMPLETE');
      }

      return allArticles;
    }

    // Request approval to continue
    this.logger.info(`\n⚠️  WARNING: Only ${p1Articles.length}/${targetCount} P1 articles`);
    this.logger.info(`   Missing ${targetCount - p1Articles.length} articles`);

    if (userApprovalCallback) {
      const continueToP2 = await userApprovalCallback(p1Articles, 'P1_INCOMPLETE');
      if (!continueToP2) {
        this.logger.info('❌ User chose to stop. Returning P1 only.');
        await this.cache.set(query, section, p1Articles);
        return p1Articles;
      }
    }

    allArticles = [...p1Articles];
    const remaining = targetCount - allArticles.length;

    // ═══════════════════════════════════════════════════════
    // PHASE 2: EXHAUST P2
    // ═══════════════════════════════════════════════════════
    this.logger.info('\n╔═══════════════════════════════════════════════════╗');
    this.logger.info('║ 🟡 PHASE 2: EXHAUSTIVE P2 SEARCH                ║');
    this.logger.info('║ (Good Articles - Score >= 50)                   ║');
    this.logger.info(`║ Needed: ${remaining} articles${' '.repeat(32 - remaining.toString().length)}║`);
    this.logger.info('╚═══════════════════════════════════════════════════╝');

    const p2Articles = await this.exhaustPriority(
      strategy.secondaryQueries,
      2,
      remaining * 2
    );

    this.printPhaseResults('P2', p2Articles);

    allArticles.push(...p2Articles.slice(0, remaining));

    // Check if complete
    if (allArticles.length >= targetCount) {
      this.logger.info(`\n🎉 TARGET REACHED! (P1 + P2)`);
      this.logger.info(`   - P1: ${p1Articles.length} articles`);
      this.logger.info(`   - P2: ${allArticles.length - p1Articles.length} articles`);

      await this.cache.set(query, section, allArticles);

      if (userApprovalCallback) {
        await userApprovalCallback(allArticles, 'P2_COMPLETE');
      }

      return allArticles.slice(0, targetCount);
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 3: EXHAUST P3 (if still needed)
    // ═══════════════════════════════════════════════════════
    const stillRemaining = targetCount - allArticles.length;

    if (stillRemaining > 0) {
      this.logger.info('\n╔═══════════════════════════════════════════════════╗');
      this.logger.info('║ 🟠 PHASE 3: EXHAUSTIVE P3 SEARCH                ║');
      this.logger.info('║ (Acceptable Articles - Score >= 30)             ║');
      this.logger.info(`║ Needed: ${stillRemaining} articles${' '.repeat(32 - stillRemaining.toString().length)}║`);
      this.logger.info('╚═══════════════════════════════════════════════════╝');

      if (userApprovalCallback) {
        const continueToP3 = await userApprovalCallback(allArticles, 'P2_INCOMPLETE');
        if (!continueToP3) {
          this.logger.info('❌ User chose to stop.');
          await this.cache.set(query, section, allArticles);
          return allArticles;
        }
      }

      const p3Articles = await this.exhaustPriority(
        strategy.tertiaryQueries,
        3,
        stillRemaining * 2
      );

      this.printPhaseResults('P3', p3Articles);

      allArticles.push(...p3Articles.slice(0, stillRemaining));
    }

    // ═══════════════════════════════════════════════════════
    // FINALIZATION
    // ═══════════════════════════════════════════════════════
    this.logger.info(`\n🏁 SEARCH COMPLETED`);
    this.logger.info(`   Total: ${allArticles.length} articles`);

    await this.cache.set(query, section, allArticles);

    if (userApprovalCallback) {
      await userApprovalCallback(allArticles, 'COMPLETE');
    }

    return allArticles.slice(0, targetCount);
  }

  /**
   * EXHAUST SPECIFIC PRIORITY
   */
  private async exhaustPriority(
    queries: string[],
    priority: 1 | 2 | 3,
    maxResults: number
  ): Promise<EnrichedArticle[]> {
    const allArticles: EnrichedArticle[] = [];
    const seenDOIs = new Set<string>();

    const limitPerAPI = priority === 1 ? 100 : priority === 2 ? 75 : 50;

    for (const [idx, query] of queries.entries()) {
      this.logger.info(`\n   Query ${idx + 1}/${queries.length}: "${query}"`);

      // ─────────────────────────────────────────────────────
      // PART A: LOCAL SEARCH (Hybrid)
      // ─────────────────────────────────────────────────────
      this.logger.info('      🏠 Searching locally (Hybrid)...');

      const localResults = await this.localSearch.hybridSearch(query, 100, {
        requireFullText: true,
      });

      // Detect formats and enrich
      const localEnriched = await this.enrichWithFormats(localResults);

      // Filter only P{priority}
      const localP = localEnriched.filter(a => a.priority === priority);

      this.logger.info(`         ✓ ${localP.length} P${priority} local articles`);

      // ─────────────────────────────────────────────────────
      // PART B: SEARCH APIS
      // ─────────────────────────────────────────────────────
      this.logger.info('      🌐 Searching APIs...');

      const apiResults = await this.externalAPIs.searchAllAPIs(query, limitPerAPI, {
        requireFullText: true,
      });

      this.logger.info(`         ✓ ${apiResults.length} articles from APIs`);

      // ─────────────────────────────────────────────────────
      // PART C: VALIDATE FULL TEXT
      // ─────────────────────────────────────────────────────
      this.logger.info('      ✅ Validating full text...');

      const validated = await this.validator.validateBatch(apiResults);

      this.logger.info(`         ✓ ${validated.length} with confirmed full text`);

      // Detect formats and enrich
      const apiEnriched = await this.enrichWithFormats(validated);

      // Filter only P{priority}
      const apiP = apiEnriched.filter(a => a.priority === priority);

      this.logger.info(`         ✓ ${apiP.length} P${priority} articles from APIs`);

      // ─────────────────────────────────────────────────────
      // PART D: MERGE + DEDUP
      // ─────────────────────────────────────────────────────
      const combined = [...localP, ...apiP];

      const unique = combined.filter(article => {
        const key = article.doi || article.title.toLowerCase().trim();
        if (seenDOIs.has(key)) return false;
        seenDOIs.add(key);
        return true;
      });

      this.logger.info(`         📊 ${unique.length} unique articles after merge`);

      // ─────────────────────────────────────────────────────
      // PART E: CROSS-ENCODER RERANKING
      // ─────────────────────────────────────────────────────
      if (unique.length > 0) {
        this.logger.info('         🎯 Applying Cross-Encoder Reranking...');

        const reranked = await this.crossEncoder.rerank(query, unique);
        allArticles.push(...reranked);

        this.logger.info(`         ✨ Reranking complete`);
      }

      this.logger.info(`      📈 Total accumulated: ${allArticles.length}`);

      // Stop if max reached
      if (allArticles.length >= maxResults) {
        this.logger.info(`      🛑 Limit reached (${maxResults})`);
        break;
      }
    }

    // Sort by quality score (descending)
    return allArticles
      .sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore)
      .slice(0, maxResults);
  }

  /**
   * Enrich with formats and metrics
   */
  private async enrichWithFormats(articles: AcademicArticle[]): Promise<EnrichedArticle[]> {
    const enriched: EnrichedArticle[] = [];

    for (const article of articles) {
      // Detect available formats
      if (!article.availableFormats || article.availableFormats.length === 0) {
        const enrichedArticle = await this.formatDetector.enrichArticle(article);
        article.availableFormats = enrichedArticle.availableFormats;
      }

      // Calculate quality metrics
      const metrics = this.qualityScorer.calculateQualityScore(article);
      const priority = this.qualityScorer.classifyPriority(metrics);

      if (priority !== null) {
        enriched.push({
          ...article,
          metrics,
          priority,
        });
      }
    }

    return enriched;
  }

  /**
   * Print phase results
   */
  private printPhaseResults(phase: string, articles: EnrichedArticle[]): void {
    const avgQuality =
      articles.length > 0
        ? articles.reduce((sum, a) => sum + a.metrics.qualityScore, 0) / articles.length
        : 0;

    const localCount = articles.filter(a => a.source === 'local').length;
    const apiCount = articles.length - localCount;

    // Count by format
    const formatCounts: Record<string, number> = {};
    articles.forEach(a => {
      const format = a.availableFormats?.[0]?.format || 'unknown';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    });

    this.logger.info(`\n✅ ${phase} RESULTS:`);
    this.logger.info(`   Total: ${articles.length} articles`);
    this.logger.info(`   Average quality: ${avgQuality.toFixed(1)}/100`);
    this.logger.info(`   Source: ${localCount} local, ${apiCount} APIs`);
    this.logger.info(`   Formats:`);
    Object.entries(formatCounts).forEach(([format, count]) => {
      this.logger.info(`      • ${format}: ${count}`);
    });
  }
}
