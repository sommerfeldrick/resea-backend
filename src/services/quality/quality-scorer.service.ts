/**
 * Quality Scorer Service
 * Calculates quality score (0-100) for academic articles
 * Based on citations, trend, impact factor, recency, relevance, and author H-index
 */

import type { AcademicArticle, ArticleQualityMetrics, EnrichedArticle, ArticleFormat } from '../../types';
import {
  QUALITY_WEIGHTS_ADVANCED,
  JOURNAL_TIERS,
  RECENCY_SCORES,
  FORMAT_BONUS,
  QUALITY_THRESHOLDS,
} from '../../config';

export class QualityScorerService {
  /**
   * Calculate complete quality score for an article
   */
  calculateQualityScore(article: AcademicArticle): ArticleQualityMetrics {
    const currentYear = new Date().getFullYear();
    const publicationYear = article.year || currentYear;
    const yearsSincePublication = currentYear - publicationYear;

    // Get values with proper fallbacks
    const citationCount = article.citationCount || 0;
    const relevanceScore = article.searchMetadata?.relevanceScore || 0.7;

    // ═══════════════════════════════════════════════════════
    // 1. CITATIONS SCORE (30%)
    // ═══════════════════════════════════════════════════════
    const citationScore = this.normalizeCitations(citationCount);

    // ═══════════════════════════════════════════════════════
    // 2. TREND SCORE (20%) - Citations per year
    // ═══════════════════════════════════════════════════════
    const citationsPerYear =
      yearsSincePublication > 0 ? citationCount / yearsSincePublication : citationCount;
    const trendScore = this.normalizeTrend(citationsPerYear);

    // ═══════════════════════════════════════════════════════
    // 3. IMPACT FACTOR SCORE (20%)
    // ═══════════════════════════════════════════════════════
    const impactScore = this.getJournalImpact(article.journal);

    // ═══════════════════════════════════════════════════════
    // 4. RECENCY SCORE (15%)
    // ═══════════════════════════════════════════════════════
    const recencyScore = this.calculateRecencyScore(yearsSincePublication);

    // ═══════════════════════════════════════════════════════
    // 5. SEMANTIC RELEVANCE SCORE (10%)
    // ═══════════════════════════════════════════════════════
    const semanticScore = relevanceScore * 10;

    // ═══════════════════════════════════════════════════════
    // 6. AUTHOR H-INDEX SCORE (5%)
    // ═══════════════════════════════════════════════════════
    const authorScore = this.getAuthorScore(article.authors);

    // ═══════════════════════════════════════════════════════
    // BASE SCORE (0-100)
    // ═══════════════════════════════════════════════════════
    let qualityScore =
      citationScore * QUALITY_WEIGHTS_ADVANCED.citations +
      trendScore * QUALITY_WEIGHTS_ADVANCED.trend +
      impactScore * QUALITY_WEIGHTS_ADVANCED.impact +
      recencyScore * QUALITY_WEIGHTS_ADVANCED.recency +
      semanticScore * QUALITY_WEIGHTS_ADVANCED.relevance +
      authorScore * QUALITY_WEIGHTS_ADVANCED.author;

    // ═══════════════════════════════════════════════════════
    // BONUSES
    // ═══════════════════════════════════════════════════════

    // Open Access bonus (+5 points)
    if (article.isOpenAccess) {
      qualityScore += 5;
    }

    // Structured format bonus (+0-8 points)
    let formatQuality: number | undefined;
    let bestFormat: ArticleFormat | string | undefined;

    if (article.availableFormats && article.availableFormats.length > 0) {
      bestFormat = article.availableFormats[0].format;
      formatQuality = FORMAT_BONUS[bestFormat] || 0;
      qualityScore += formatQuality;
    }

    // arXiv bonus (high quality preprints) (+3 points)
    if (article.source === 'arxiv') {
      qualityScore += 3;
    }

    return {
      citationCount,
      citationsPerYear,
      journalImpactFactor: impactScore / 20, // Normalize to 0-1
      recency: yearsSincePublication,
      semanticRelevance: relevanceScore,
      authorHIndex: authorScore / 5, // Normalize to 0-1
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      formatQuality,
      bestFormat,
    };
  }

  /**
   * Normalize citations (logarithmic scale)
   * 0 cit = 0, 10 cit = 15, 100 cit = 25, 1000+ cit = 30
   */
  private normalizeCitations(citations: number): number {
    if (citations === 0) return 0;
    if (citations < 10) return citations * 1.5;
    if (citations < 100) return 15 + Math.log10(citations) * 5;
    return Math.min(30, 25 + Math.log10(citations / 100) * 2.5);
  }

  /**
   * Normalize trend (citations per year)
   */
  private normalizeTrend(citPerYear: number): number {
    if (citPerYear === 0) return 0;
    if (citPerYear < 5) return citPerYear * 2;
    if (citPerYear < 20) return 10 + (citPerYear - 5) * 0.5;
    return Math.min(20, 17.5 + Math.log10(citPerYear / 20) * 2.5);
  }

  /**
   * Calculate recency score based on publication age
   */
  private calculateRecencyScore(yearsSince: number): number {
    if (yearsSince <= RECENCY_SCORES.veryRecent.maxYears) {
      return RECENCY_SCORES.veryRecent.score;
    }
    if (yearsSince <= RECENCY_SCORES.recent.maxYears) {
      return RECENCY_SCORES.recent.score;
    }
    if (yearsSince <= RECENCY_SCORES.medium.maxYears) {
      return RECENCY_SCORES.medium.score;
    }
    if (yearsSince <= RECENCY_SCORES.old.maxYears) {
      return RECENCY_SCORES.old.score;
    }
    return RECENCY_SCORES.veryOld.score;
  }

  /**
   * Get journal impact factor score
   */
  private getJournalImpact(journal?: string): number {
    if (!journal) return JOURNAL_TIERS.tier3.score;

    const journalUpper = journal.toUpperCase();

    // Check Tier 1
    const isTier1Journal = JOURNAL_TIERS.tier1.journals.some((j) => journalUpper.includes(j));
    const isTier1Conference = JOURNAL_TIERS.tier1.conferences.some((c) => journalUpper.includes(c));
    if (isTier1Journal || isTier1Conference) {
      return JOURNAL_TIERS.tier1.score;
    }

    // Check Tier 2
    const isTier2Journal = JOURNAL_TIERS.tier2.journals.some((j) => journalUpper.includes(j));
    const isTier2Conference = JOURNAL_TIERS.tier2.conferences.some((c) => journalUpper.includes(c));
    if (isTier2Journal || isTier2Conference) {
      return JOURNAL_TIERS.tier2.score;
    }

    // Tier 3 (default)
    return JOURNAL_TIERS.tier3.score;
  }

  /**
   * Get author score (simplified)
   * TODO: Integrate with H-index API (Google Scholar, Semantic Scholar)
   */
  private getAuthorScore(authors?: string[]): number {
    // Default average score
    return 2.5;
  }

  /**
   * Classify article into priority tier (P1, P2, P3, or null if below threshold)
   */
  classifyPriority(metrics: ArticleQualityMetrics): 1 | 2 | 3 | null {
    const score = metrics.qualityScore;

    if (score >= QUALITY_THRESHOLDS.P1_MIN) return 1; // P1
    if (score >= QUALITY_THRESHOLDS.P2_MIN) return 2; // P2
    if (score >= QUALITY_THRESHOLDS.P3_MIN) return 3; // P3

    return null; // Below minimum threshold - discard
  }

  /**
   * Enrich articles with quality metrics and priority
   * Filters out articles below minimum quality threshold
   */
  enrichArticles(articles: AcademicArticle[]): EnrichedArticle[] {
    return articles
      .map((article) => {
        const metrics = this.calculateQualityScore(article);
        const priority = this.classifyPriority(metrics);

        if (priority === null) return null; // Filter out low quality

        return {
          ...article,
          metrics,
          priority,
        } as EnrichedArticle;
      })
      .filter((a): a is EnrichedArticle => a !== null);
  }

  /**
   * Sort articles by quality score (descending)
   */
  sortByQuality(articles: EnrichedArticle[]): EnrichedArticle[] {
    return [...articles].sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore);
  }

  /**
   * Group articles by priority
   */
  groupByPriority(articles: EnrichedArticle[]): {
    P1: EnrichedArticle[];
    P2: EnrichedArticle[];
    P3: EnrichedArticle[];
  } {
    return {
      P1: articles.filter((a) => a.priority === 1),
      P2: articles.filter((a) => a.priority === 2),
      P3: articles.filter((a) => a.priority === 3),
    };
  }
}

// Singleton export
export const qualityScorer = new QualityScorerService();
