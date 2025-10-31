import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../config/logger.js';
import { withRetry } from '../utils/retry.js';
import { grobidService } from './grobid.service.js';

export interface AcademicPaper {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  url: string;
  doi?: string;
  citationCount?: number;
  source: string; // Qual API retornou isso
  isOpenAccess?: boolean;
  pdfUrl?: string;
  sections?: {
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
  references?: Array<{
    title: string;
    authors: string[];
    year?: number;
  }>;
}

interface SearchOptions {
  maxResults?: number;
  startYear?: number;
  endYear?: number;
  openAccessOnly?: boolean;
}

export class AcademicSearchService {
  private usageStats = {
    openAlex: 0,
    semanticScholar: 0,
    arxiv: 0,
    core: 0,
    doaj: 0,
    pubmed: 0,
    googleScholar: 0,
    crossref: 0
  };

  /**
   * BUSCA EM TODAS AS FONTES GRATUITAS EM PARALELO
   * Retorna resultados combinados e deduplicados
   */
  async searchAll(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    logger.info(`🔍 Starting comprehensive search for: "${query}"`);
    const startTime = Date.now();

    // Busca em TODAS as fontes gratuitas simultaneamente
    const results = await Promise.allSettled([
      this.searchOpenAlex(query, options),
      this.searchSemanticScholar(query, options),
      this.searchArxiv(query, options),
      this.searchCORE(query, options),
      this.searchDOAJ(query, options),
      this.searchPubMed(query, options),
      this.searchGoogleScholar(query, options)
    ]);

    // Coleta papers de todas as fontes que funcionaram
    const allPapers: AcademicPaper[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      const sources = ['OpenAlex', 'Semantic Scholar', 'arXiv', 'CORE', 'DOAJ', 'PubMed', 'Google Scholar'];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allPapers.push(...result.value);
        successCount++;
        logger.info(`✅ ${sources[index]}: ${result.value.length} papers`);
      } else if (result.status === 'rejected') {
        logger.warn(`⚠️  ${sources[index]} failed:`, result.reason?.message || 'Unknown error');
      }
    });

    // Se TODAS as gratuitas falharem, tenta API paga como último recurso
    if (allPapers.length === 0) {
      logger.warn('🚨 All free sources failed! Trying paid API (CrossRef) as last resort...');
      try {
        const paidResults = await this.searchCrossRef(query, options);
        allPapers.push(...paidResults);
        logger.info(`💰 CrossRef (PAID): ${paidResults.length} papers`);
      } catch (error) {
        logger.error('❌ Even paid API failed:', error);
      }
    }

    // Remove duplicatas (mesmo DOI ou título similar)
    const deduplicated = this.deduplicatePapers(allPapers);

    // Ordena por relevância (citações, ano, open access)
    const sorted = this.sortByRelevance(deduplicated);

    const duration = Date.now() - startTime;
    logger.info(`✅ Search completed in ${duration}ms: ${sorted.length} unique papers from ${successCount} sources`);

    return sorted.slice(0, options.maxResults || 50);
  }

  /**
   * 1. OpenAlex - ILIMITADO, 250M+ papers, SEM API KEY!
   * https://openalex.org/
   */
  async searchOpenAlex(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.openAlex++;

      let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}`;
      url += `&per-page=${options.maxResults || 20}`;

      if (options.openAccessOnly) {
        url += '&filter=is_oa:true';
      }

      if (options.startYear) {
        url += `&filter=from_publication_date:${options.startYear}-01-01`;
      }

      const response = await withRetry(
        () => axios.get(url, {
          headers: { 'User-Agent': 'ResearchAssistant/1.0 (mailto:your@email.com)' },
          timeout: 10000
        }),
        { maxAttempts: 3, initialDelay: 1000 },
        'OpenAlex search'
      );

      return response.data.results.map((work: any) => ({
        id: work.id,
        title: work.title || 'Untitled',
        authors: work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [],
        year: work.publication_year,
        abstract: work.abstract_inverted_index ? this.reconstructAbstract(work.abstract_inverted_index) : undefined,
        url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : work.id,
        doi: work.doi?.replace('https://doi.org/', ''),
        citationCount: work.cited_by_count || 0,
        source: 'OpenAlex',
        isOpenAccess: work.open_access?.is_oa,
        pdfUrl: work.open_access?.oa_url
      }));
    } catch (error) {
      logger.error('OpenAlex search failed:', error);
      return [];
    }
  }

  /**
   * 2. Semantic Scholar - 100 req/min GRÁTIS, 200M+ papers
   * https://www.semanticscholar.org/product/api
   */
  async searchSemanticScholar(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.semanticScholar++;

      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,abstract,citationCount,url,openAccessPdf&limit=${options.maxResults || 20}`;

      const headers: any = {
        'User-Agent': 'ResearchAssistant/1.0'
      };

      // API key opcional - aumenta limite de 100 para 5000 req/min
      if (process.env.SEMANTIC_SCHOLAR_KEY) {
        headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY;
      }

      const response = await withRetry(
        () => axios.get(url, { headers, timeout: 10000 }),
        { maxAttempts: 3, initialDelay: 1000 },
        'Semantic Scholar search'
      );

      if (!response.data.data) return [];

      return response.data.data.map((paper: any) => ({
        id: paper.paperId,
        title: paper.title,
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        abstract: paper.abstract,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        citationCount: paper.citationCount,
        source: 'Semantic Scholar',
        isOpenAccess: !!paper.openAccessPdf,
        pdfUrl: paper.openAccessPdf?.url
      }));
    } catch (error) {
      logger.error('Semantic Scholar search failed:', error);
      return [];
    }
  }

  /**
   * 3. arXiv - ILIMITADO, papers técnicos de física, CS, matemática
   * http://arxiv.org/help/api
   */
  async searchArxiv(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.arxiv++;

      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${options.maxResults || 20}&sortBy=relevance&sortOrder=descending`;

      const response = await withRetry(
        () => axios.get(url, { timeout: 10000 }),
        { maxAttempts: 3, initialDelay: 1000 },
        'arXiv search'
      );
      const xml = response.data;

      // Parse XML
      const $ = cheerio.load(xml, { xmlMode: true });
      const papers: AcademicPaper[] = [];

      $('entry').each((i, entry) => {
        const $entry = $(entry);

        papers.push({
          id: $entry.find('id').text(),
          title: $entry.find('title').text().trim(),
          authors: $entry.find('author name').map((i, el) => $(el).text()).get(),
          year: parseInt($entry.find('published').text().substring(0, 4)),
          abstract: $entry.find('summary').text().trim(),
          url: $entry.find('id').text(),
          source: 'arXiv',
          isOpenAccess: true,
          pdfUrl: $entry.find('id').text().replace('/abs/', '/pdf/')
        });
      });

      return papers;
    } catch (error) {
      logger.error('arXiv search failed:', error);
      return [];
    }
  }

  /**
   * 4. CORE - 10k requisições/dia GRÁTIS, 200M+ papers
   * https://core.ac.uk/services/api
   */
  async searchCORE(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.core++;

      if (!process.env.CORE_API_KEY) {
        logger.warn('CORE_API_KEY not set, skipping CORE search');
        return [];
      }

      const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${options.maxResults || 20}`;

      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${process.env.CORE_API_KEY}` },
        timeout: 10000
      });

      return response.data.results?.map((work: any) => ({
        id: work.id,
        title: work.title,
        authors: work.authors || [],
        year: work.yearPublished,
        abstract: work.abstract,
        url: work.downloadUrl || work.sourceFulltextUrls?.[0],
        doi: work.doi,
        source: 'CORE',
        isOpenAccess: true,
        pdfUrl: work.downloadUrl
      })) || [];
    } catch (error) {
      logger.error('CORE search failed:', error);
      return [];
    }
  }

  /**
   * 5. DOAJ - Directory of Open Access Journals, 18k+ journals
   * https://doaj.org/api/docs
   */
  async searchDOAJ(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.doaj++;

      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${options.maxResults || 20}`;

      const response = await axios.get(url, { timeout: 10000 });

      return response.data.results?.map((article: any) => ({
        id: article.id,
        title: article.bibjson?.title,
        authors: article.bibjson?.author?.map((a: any) => a.name) || [],
        year: parseInt(article.bibjson?.year),
        abstract: article.bibjson?.abstract,
        url: article.bibjson?.link?.[0]?.url,
        doi: article.bibjson?.identifier?.find((i: any) => i.type === 'doi')?.id,
        source: 'DOAJ',
        isOpenAccess: true
      })) || [];
    } catch (error) {
      logger.error('DOAJ search failed:', error);
      return [];
    }
  }

  /**
   * 6. PubMed API (E-utilities) - GRÁTIS, medicina/biologia
   * https://www.ncbi.nlm.nih.gov/books/NBK25501/
   */
  async searchPubMed(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.pubmed++;

      // Busca IDs
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${options.maxResults || 20}&retmode=json`;

      const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
      const ids = searchResponse.data.esearchresult?.idlist || [];

      if (ids.length === 0) return [];

      // Busca detalhes dos IDs
      const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;

      const fetchResponse = await axios.get(fetchUrl, { timeout: 10000 });
      const papers: AcademicPaper[] = [];

      Object.values(fetchResponse.data.result || {}).forEach((item: any) => {
        if (item.uid) {
          papers.push({
            id: item.uid,
            title: item.title,
            authors: item.authors?.map((a: any) => a.name) || [],
            year: parseInt(item.pubdate?.substring(0, 4)),
            abstract: item.abstract,
            url: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
            doi: item.elocationid?.replace('doi: ', ''),
            source: 'PubMed',
            citationCount: item.pmcrefcount
          });
        }
      });

      return papers;
    } catch (error) {
      logger.error('PubMed search failed:', error);
      return [];
    }
  }

  /**
   * 7. Google Scholar (Scraping) - Fallback
   */
  async searchGoogleScholar(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.googleScholar++;

      const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const papers: AcademicPaper[] = [];

      $('.gs_ri').each((i, element) => {
        const $el = $(element);
        const title = $el.find('.gs_rt').text().replace(/^\[.*?\]\s*/, '');
        const authors = $el.find('.gs_a').text();
        const snippet = $el.find('.gs_rs').text();
        const link = $el.find('.gs_rt a').attr('href');

        if (title && link) {
          papers.push({
            id: `scholar_${i}`,
            title,
            authors: [authors.split('-')[0]?.trim()].filter(Boolean),
            abstract: snippet,
            url: link,
            source: 'Google Scholar (Scraping)',
            year: parseInt(authors.match(/\d{4}/)?.[0] || '')
          });
        }
      });

      return papers.slice(0, options.maxResults || 10);
    } catch (error) {
      logger.error('Google Scholar scraping failed:', error);
      return [];
    }
  }

  /**
   * 8. CrossRef API - PAGA ($0.001/request) - ÚLTIMO RECURSO!
   * https://www.crossref.org/documentation/retrieve-metadata/rest-api/
   */
  async searchCrossRef(query: string, options: SearchOptions = {}): Promise<AcademicPaper[]> {
    try {
      this.usageStats.crossref++;
      logger.warn('💰 Using PAID API (CrossRef) - This will cost money!');

      if (!process.env.CROSSREF_API_KEY) {
        logger.error('CROSSREF_API_KEY not set!');
        return [];
      }

      const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${options.maxResults || 20}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'ResearchAssistant/1.0 (mailto:your@email.com)',
          'Crossref-Plus-API-Token': `Bearer ${process.env.CROSSREF_API_KEY}`
        },
        timeout: 10000
      });

      return response.data.message?.items?.map((item: any) => ({
        id: item.DOI,
        title: item.title?.[0],
        authors: item.author?.map((a: any) => `${a.given} ${a.family}`) || [],
        year: item.published?.['date-parts']?.[0]?.[0],
        abstract: item.abstract,
        url: `https://doi.org/${item.DOI}`,
        doi: item.DOI,
        citationCount: item['is-referenced-by-count'],
        source: 'CrossRef (PAID)',
        isOpenAccess: item.link?.some((l: any) => l.intended === 'open-access')
      })) || [];
    } catch (error) {
      logger.error('CrossRef (PAID) search failed:', error);
      return [];
    }
  }

  /**
   * Remove papers duplicados por DOI ou título similar
   */
  private deduplicatePapers(papers: AcademicPaper[]): AcademicPaper[] {
    const seen = new Set<string>();
    const unique: AcademicPaper[] = [];

    for (const paper of papers) {
      // Usa DOI se disponível, senão usa título normalizado
      const key = paper.doi || this.normalizeTitle(paper.title);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(paper);
      }
    }

    return unique;
  }

  /**
   * Ordena papers por relevância
   */
  private sortByRelevance(papers: AcademicPaper[]): AcademicPaper[] {
    return papers.sort((a, b) => {
      // Prioriza: open access > citações > ano recente
      const scoreA = (a.isOpenAccess ? 1000 : 0) + (a.citationCount || 0) + (a.year || 0);
      const scoreB = (b.isOpenAccess ? 1000 : 0) + (b.citationCount || 0) + (b.year || 0);
      return scoreB - scoreA;
    });
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
  }

  private reconstructAbstract(invertedIndex: any): string {
    try {
      const words: string[] = [];
      Object.entries(invertedIndex).forEach(([word, positions]: [string, any]) => {
        positions.forEach((pos: number) => {
          words[pos] = word;
        });
      });
      return words.join(' ').substring(0, 500);
    } catch {
      return '';
    }
  }

  /**
   * Retorna estatísticas de uso
   */
  getUsageStats() {
    return this.usageStats;
  }
}

// Singleton
export const academicSearchService = new AcademicSearchService();

/**
 * Helper: busca universal (compatibilidade com código antigo)
 */
export async function buscaAcademicaUniversal(
  query: string,
  options: SearchOptions = {}
): Promise<AcademicPaper[]> {
  return academicSearchService.searchAll(query, options);
}

/**
 * Helper: enriquecer com PDF usando GROBID
 */
export async function enrichWithPDFContent(
  papers: AcademicPaper[],
  maxPdfs: number = 3
): Promise<AcademicPaper[]> {
  logger.info(`📄 Starting PDF enrichment for ${Math.min(papers.length, maxPdfs)} papers`);

  const papersWithPdf = papers.filter(p => p.pdfUrl);
  const toEnrich = papersWithPdf.slice(0, maxPdfs);

  if (toEnrich.length === 0) {
    logger.warn('No papers with PDF URLs found for enrichment');
    return papers;
  }

  const enriched: AcademicPaper[] = [];
  let successCount = 0;

  for (const paper of toEnrich) {
    try {
      logger.info(`Downloading PDF: ${paper.title.substring(0, 60)}...`);

      // Download PDF
      const pdfResponse = await axios.get(paper.pdfUrl!, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        headers: {
          'User-Agent': 'ResearchAssistant/1.0 (mailto:your@email.com)'
        }
      });

      const pdfBuffer = Buffer.from(pdfResponse.data);
      logger.info(`PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(0)}KB`);

      // Extract with GROBID
      const extraction = await grobidService.extractFromPDF(pdfBuffer, `${paper.id}.pdf`);

      if (extraction) {
        enriched.push({
          ...paper,
          sections: extraction.sections,
          references: extraction.references
        });
        successCount++;
        logger.info(`✅ Successfully enriched: ${paper.title.substring(0, 60)}...`);
      } else {
        enriched.push(paper);
        logger.warn(`⚠️  GROBID extraction returned null for: ${paper.title.substring(0, 60)}...`);
      }
    } catch (error: any) {
      enriched.push(paper);
      logger.error(`❌ Failed to enrich paper: ${paper.title.substring(0, 60)}...`, {
        error: error.message,
        pdfUrl: paper.pdfUrl
      });
    }
  }

  // Add remaining papers (não processados)
  const remainingPapers = papers.slice(toEnrich.length);
  enriched.push(...remainingPapers);

  logger.info(`📄 PDF enrichment completed: ${successCount}/${toEnrich.length} successful`);
  return enriched;
}

/**
 * Helper: estatísticas de busca (compatibilidade com código antigo)
 */
export function getSearchStats() {
  return {
    usageStats: academicSearchService.getUsageStats(),
    totalSearches: Object.values(academicSearchService.getUsageStats()).reduce((a, b) => a + b, 0)
  };
}
