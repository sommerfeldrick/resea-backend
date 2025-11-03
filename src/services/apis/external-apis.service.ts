/**
 * External APIs Service
 * Orchestrates searches across all 13 academic APIs:
 * - OpenAlex, Semantic Scholar, PubMed, CORE
 * - Europe PMC, arXiv, DOAJ, PLOS
 * - bioRxiv, medRxiv, OpenAIRE, DataCite, Google Scholar
 */

import type { AcademicArticle } from '../../types/article.types';
import { Logger } from '../../utils/simple-logger';
import { OpenAlexService } from './openalex.service';
import { SemanticScholarService } from './semantic-scholar.service';
import { PubMedService } from './pubmed.service';
import { COREService } from './core.service';
import { EuropePMCService } from './europepmc.service';
import { ArXivService } from './arxiv.service';
import { DOAJService } from './doaj.service';
import { PLOSService } from './plos.service';
import { BioRxivService } from './biorxiv.service';
import { MedRxivService } from './medrxiv.service';
import { OpenAIREService } from './openaire.service';
import { DataCiteService } from './datacite.service';
import { GoogleScholarService } from './google-scholar.service';

export class ExternalAPIsService {
  private logger: Logger;

  // All API services
  private openAlex: OpenAlexService;
  private semanticScholar: SemanticScholarService;
  private pubmed: PubMedService;
  private core: COREService;
  private europePMC: EuropePMCService;
  private arxiv: ArXivService;
  private doaj: DOAJService;
  private plos: PLOSService;
  private biorxiv: BioRxivService;
  private medrxiv: MedRxivService;
  private openaire: OpenAIREService;
  private datacite: DataCiteService;
  private googleScholar: GoogleScholarService;

  constructor() {
    this.logger = new Logger('ExternalAPIsService');

    // Initialize all API services
    this.openAlex = new OpenAlexService();
    this.semanticScholar = new SemanticScholarService();
    this.pubmed = new PubMedService();
    this.core = new COREService();
    this.europePMC = new EuropePMCService();
    this.arxiv = new ArXivService();
    this.doaj = new DOAJService();
    this.plos = new PLOSService();
    this.biorxiv = new BioRxivService();
    this.medrxiv = new MedRxivService();
    this.openaire = new OpenAIREService();
    this.datacite = new DataCiteService();
    this.googleScholar = new GoogleScholarService();

    this.logger.info('Initialized 13 API services');
  }

  /**
   * Search across all configured APIs in parallel
   */
  async searchAllAPIs(
    query: string,
    limitPerAPI: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    this.logger.info(`🌐 Searching all APIs: "${query}" (${limitPerAPI} per API)`);

    const startTime = Date.now();

    // Call all APIs in parallel
    const searchPromises = [
      this.safeSearch(this.openAlex, query, limitPerAPI, filters),
      this.safeSearch(this.semanticScholar, query, limitPerAPI, filters),
      this.safeSearch(this.pubmed, query, limitPerAPI, filters),
      this.safeSearch(this.core, query, limitPerAPI, filters),
      this.safeSearch(this.europePMC, query, limitPerAPI, filters),
      this.safeSearch(this.arxiv, query, limitPerAPI, filters),
      this.safeSearch(this.doaj, query, limitPerAPI, filters),
      this.safeSearch(this.plos, query, limitPerAPI, filters),
      this.safeSearch(this.biorxiv, query, limitPerAPI, filters),
      this.safeSearch(this.medrxiv, query, limitPerAPI, filters),
      this.safeSearch(this.openaire, query, limitPerAPI, filters),
      this.safeSearch(this.datacite, query, limitPerAPI, filters),
      this.safeSearch(this.googleScholar, query, limitPerAPI, filters),
    ];

    // Wait for all to complete
    const results = await Promise.all(searchPromises);

    // Flatten results
    const allArticles = results.flat();

    // Deduplicate by DOI
    const deduplicated = this.deduplicateArticles(allArticles);

    const elapsed = Date.now() - startTime;

    this.logger.info(
      `✅ Found ${deduplicated.length} unique articles from ${allArticles.length} total (${elapsed}ms)`
    );

    return deduplicated;
  }

  /**
   * Search specific APIs by name
   */
  async searchAPIs(
    query: string,
    apiNames: string[],
    limitPerAPI: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    this.logger.info(`Searching ${apiNames.length} APIs: ${apiNames.join(', ')}`);

    const apiMap: Record<string, any> = {
      openalex: this.openAlex,
      semanticscholar: this.semanticScholar,
      pubmed: this.pubmed,
      core: this.core,
      europepmc: this.europePMC,
      arxiv: this.arxiv,
      doaj: this.doaj,
      plos: this.plos,
      biorxiv: this.biorxiv,
      medrxiv: this.medrxiv,
      openaire: this.openaire,
      datacite: this.datacite,
      googlescholar: this.googleScholar,
    };

    // Filter to only requested APIs
    const searchPromises = apiNames
      .map(name => apiMap[name.toLowerCase()])
      .filter(Boolean)
      .map(api => this.safeSearch(api, query, limitPerAPI, filters));

    const results = await Promise.all(searchPromises);
    const allArticles = results.flat();
    const deduplicated = this.deduplicateArticles(allArticles);

    this.logger.info(`Found ${deduplicated.length} unique articles`);

    return deduplicated;
  }

  /**
   * Safe search wrapper (catches errors)
   */
  private async safeSearch(
    api: any,
    query: string,
    limit: number,
    filters?: { requireFullText?: boolean }
  ): Promise<AcademicArticle[]> {
    try {
      return await api.search(query, limit, filters);
    } catch (error: any) {
      this.logger.error(`API search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Deduplicate articles by DOI (or title if no DOI)
   */
  private deduplicateArticles(articles: AcademicArticle[]): AcademicArticle[] {
    const seen = new Set<string>();
    const deduplicated: AcademicArticle[] = [];

    for (const article of articles) {
      // Use DOI as primary key, fallback to normalized title
      const key = article.doi || article.title.toLowerCase().trim();

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(article);
      }
    }

    return deduplicated;
  }
}
