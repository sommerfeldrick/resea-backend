import axios from 'axios';
import { logger } from '../config/logger.js';
import { withRetry, CircuitBreaker } from '../utils/retry.js';
import { getCache } from '../utils/cache.js';
import { extractPDFContent, findPDFUrl } from './pdfExtractor.js';
import type { AcademicAPIResult, AcademicSearchFilters } from '../types/index.js';

// Circuit breakers for each API
const circuitBreakers = {
  semanticScholar: new CircuitBreaker(5, 60000, 'SemanticScholar'),
  crossref: new CircuitBreaker(5, 60000, 'CrossRef'),
  openAlex: new CircuitBreaker(5, 60000, 'OpenAlex'),
  pubmed: new CircuitBreaker(5, 60000, 'PubMed')
};

/**
 * Extract keywords from text with improved filtering
 */
export function extrairPalavrasChave(texto: string, maxPalavras = 7): string[] {
  const ignorar = new Set([
    'de', 'da', 'do', 'em', 'para', 'com', 'que', 'e', 'a', 'o', 'as', 'os',
    'por', 'um', 'uma', 'na', 'no', 'the', 'and', 'or', 'of', 'in', 'to', 'for'
  ]);

  const palavras = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, '')
    .split(/\s+/);

  const freq: { [key: string]: number } = {};

  for (const p of palavras) {
    if (p.length > 3 && !ignorar.has(p)) {
      freq[p] = (freq[p] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPalavras)
    .map(([p]) => p);
}

/**
 * Semantic Scholar API with enhanced features
 */
async function buscarSemanticScholar(
  palavras: string[],
  filters: AcademicSearchFilters = {}
): Promise<AcademicAPIResult[]> {
  return circuitBreakers.semanticScholar.execute(async () => {
    const query = palavras.join(' ');
    const limit = filters.maxResults || 10;

    // Build query parameters
    const params: any = {
      query,
      limit,
      fields: 'title,authors,url,abstract,year,citationCount,isOpenAccess,openAccessPdf,externalIds'
    };

    if (filters.startYear) {
      params.year = `${filters.startYear}-${filters.endYear || new Date().getFullYear()}`;
    }

    if (filters.minCitations) {
      params.minCitationCount = filters.minCitations;
    }

    if (filters.openAccessOnly) {
      params.openAccessPdf = '';
    }

    const url = 'https://api.semanticscholar.org/graph/v1/paper/search';

    const response = await withRetry(
      () => axios.get(url, {
        params,
        timeout: 15000,
        headers: process.env.SEMANTIC_SCHOLAR_API_KEY
          ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY }
          : {}
      }),
      {},
      'SemanticScholar search'
    );

    const results = (response.data.data || []).map((d: any) => ({
      fonte: 'Semantic Scholar',
      titulo: d.title,
      autores: d.authors?.map((a: any) => a.name).join(', '),
      ano: d.year,
      resumo: d.abstract,
      link: d.url || `https://www.semanticscholar.org/paper/${d.paperId}`,
      doi: d.externalIds?.DOI,
      citationCount: d.citationCount || 0,
      pdfUrl: d.openAccessPdf?.url,
      isOpenAccess: d.isOpenAccess
    }));

    logger.info('Semantic Scholar results', { count: results.length, query });
    return results;
  }).catch(error => {
    logger.warn('Semantic Scholar search failed', { error: error.message });
    return [];
  });
}

/**
 * CrossRef API with enhanced features
 */
async function buscarCrossref(
  palavras: string[],
  filters: AcademicSearchFilters = {}
): Promise<AcademicAPIResult[]> {
  return circuitBreakers.crossref.execute(async () => {
    const query = palavras.join(' ');
    const rows = filters.maxResults || 10;

    const params: any = {
      query,
      rows,
      select: 'DOI,title,author,published,abstract,link,is-referenced-by-count,type'
    };

    // Add filters
    if (filters.startYear) {
      params.filter = `from-pub-date:${filters.startYear}`;
      if (filters.endYear) {
        params.filter += `,until-pub-date:${filters.endYear}`;
      }
    }

    const url = 'https://api.crossref.org/works';

    const response = await withRetry(
      () => axios.get(url, {
        params,
        timeout: 15000,
        headers: {
          'User-Agent': 'ReseaAI/1.0 (mailto:research@example.com)'
        }
      }),
      {},
      'CrossRef search'
    );

    const items = response.data.message?.items || [];

    const results = items
      .filter((i: any) => {
        if (filters.minCitations && (i['is-referenced-by-count'] || 0) < filters.minCitations) {
          return false;
        }
        return true;
      })
      .map((i: any) => ({
        fonte: 'CrossRef',
        titulo: i.title?.[0],
        autores: i.author
          ? i.author.map((a: any) => `${a.given || ''} ${a.family || ''}`).join(', ')
          : undefined,
        ano: i.published?.['date-parts']?.[0]?.[0] || i.created?.['date-parts']?.[0]?.[0],
        resumo: i.abstract,
        link: i.URL,
        doi: i.DOI,
        citationCount: i['is-referenced-by-count'] || 0,
        pdfUrl: i.link?.find((l: any) => l['content-type'] === 'application/pdf')?.URL
      }));

    logger.info('CrossRef results', { count: results.length, query });
    return results;
  }).catch(error => {
    logger.warn('CrossRef search failed', { error: error.message });
    return [];
  });
}

/**
 * OpenAlex API with enhanced features
 */
async function buscarOpenAlex(
  palavras: string[],
  filters: AcademicSearchFilters = {}
): Promise<AcademicAPIResult[]> {
  return circuitBreakers.openAlex.execute(async () => {
    const query = palavras.join(' ');
    const perPage = filters.maxResults || 10;

    const params: any = {
      search: query,
      'per-page': perPage
    };

    // Add filters
    if (filters.startYear) {
      params.filter = `publication_year:${filters.startYear}-${filters.endYear || new Date().getFullYear()}`;
    }

    if (filters.openAccessOnly) {
      params.filter = params.filter
        ? `${params.filter},is_oa:true`
        : 'is_oa:true';
    }

    const url = 'https://api.openalex.org/works';

    const response = await withRetry(
      () => axios.get(url, {
        params,
        timeout: 15000,
        headers: {
          'User-Agent': 'mailto:research@example.com'
        }
      }),
      {},
      'OpenAlex search'
    );

    const results = (response.data.results || [])
      .filter((r: any) => {
        if (filters.minCitations && (r.cited_by_count || 0) < filters.minCitations) {
          return false;
        }
        return true;
      })
      .map((r: any) => ({
        fonte: 'OpenAlex',
        titulo: r.display_name,
        autores: r.authorships?.map((a: any) => a.author.display_name).join(', '),
        ano: r.publication_year,
        resumo: r.abstract_inverted_index ? reconstructAbstract(r.abstract_inverted_index) : undefined,
        link: r.id,
        doi: r.doi?.replace('https://doi.org/', ''),
        citationCount: r.cited_by_count || 0,
        pdfUrl: r.primary_location?.pdf_url || r.open_access?.oa_url,
        isOpenAccess: r.open_access?.is_oa
      }));

    logger.info('OpenAlex results', { count: results.length, query });
    return results;
  }).catch(error => {
    logger.warn('OpenAlex search failed', { error: error.message });
    return [];
  });
}

/**
 * PubMed API with enhanced features
 */
async function buscarPubMed(
  palavras: string[],
  filters: AcademicSearchFilters = {}
): Promise<AcademicAPIResult[]> {
  return circuitBreakers.pubmed.execute(async () => {
    const termo = palavras.join('+');
    const retmax = filters.maxResults || 10;

    // Build search query with filters
    let searchTerm = termo;
    if (filters.startYear) {
      searchTerm += `+AND+${filters.startYear}:${filters.endYear || new Date().getFullYear()}[dp]`;
    }

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`;
    const searchParams = {
      db: 'pubmed',
      retmode: 'json',
      retmax,
      term: searchTerm
    };

    const searchRes = await withRetry(
      () => axios.get(searchUrl, { params: searchParams, timeout: 15000 }),
      {},
      'PubMed search'
    );

    const ids = searchRes.data.esearchresult?.idlist || [];
    if (ids.length === 0) {
      logger.info('PubMed results', { count: 0, query: termo });
      return [];
    }

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`;
    const fetchParams = {
      db: 'pubmed',
      retmode: 'json',
      id: ids.join(',')
    };

    const fetchRes = await withRetry(
      () => axios.get(fetchUrl, { params: fetchParams, timeout: 15000 }),
      {},
      'PubMed fetch'
    );

    const artigos = Object.values(fetchRes.data.result).filter((a: any) => a.uid);

    const results = artigos.map((a: any) => ({
      fonte: 'PubMed',
      titulo: a.title,
      autores: a.authors?.map((x: any) => x.name).join(', '),
      ano: a.pubdate?.substring(0, 4),
      link: `https://pubmed.ncbi.nlm.nih.gov/${a.uid}/`,
      citationCount: 0, // PubMed doesn't provide this easily
      pdfUrl: a.pmcrefcount > 0 ? `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${a.uid}/pdf/` : undefined
    }));

    logger.info('PubMed results', { count: results.length, query: termo });
    return results;
  }).catch(error => {
    logger.warn('PubMed search failed', { error: error.message });
    return [];
  });
}

/**
 * Reconstruct abstract from OpenAlex inverted index
 */
function reconstructAbstract(invertedIndex: { [word: string]: number[] }): string {
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').substring(0, 500); // Limit to 500 chars
}

/**
 * Universal academic search with all improvements
 */
export async function buscaAcademicaUniversal(
  texto: string,
  filters: AcademicSearchFilters = {}
): Promise<AcademicAPIResult[]> {
  const palavras = extrairPalavrasChave(texto);
  logger.info('Academic search started', { keywords: palavras, filters });

  // Check cache first
  const cache = getCache();
  const cacheKey = `search:${texto}:${JSON.stringify(filters)}`;
  const cached = await cache.get<AcademicAPIResult[]>(cacheKey);

  if (cached) {
    logger.info('Returning cached search results', { count: cached.length });
    return cached;
  }

  // Search all APIs in parallel
  const [
    semanticResults,
    crossrefResults,
    openAlexResults,
    pubmedResults
  ] = await Promise.all([
    buscarSemanticScholar(palavras, filters),
    buscarCrossref(palavras, filters),
    buscarOpenAlex(palavras, filters),
    buscarPubMed(palavras, filters)
  ]);

  let todosResultados = [
    ...semanticResults,
    ...crossrefResults,
    ...openAlexResults,
    ...pubmedResults
  ];

  // Remove duplicates based on title similarity
  const unicos = deduplicateResults(todosResultados);

  // Sort by citation count (if available)
  unicos.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));

  // Limit results
  const maxResults = filters.maxResults || 20;
  const finalResults = unicos.slice(0, maxResults);

  logger.info('Academic search completed', {
    total: todosResultados.length,
    unique: unicos.length,
    final: finalResults.length
  });

  // Cache results for 1 hour
  await cache.set(cacheKey, finalResults, 3600000);

  return finalResults;
}

/**
 * Deduplicate results based on title similarity
 */
function deduplicateResults(results: AcademicAPIResult[]): AcademicAPIResult[] {
  const seen = new Map<string, AcademicAPIResult>();

  for (const result of results) {
    const normalizedTitle = result.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();

    const existing = seen.get(normalizedTitle);

    if (!existing) {
      seen.set(normalizedTitle, result);
    } else {
      // Keep the one with more information (prefer with PDF, more citations, etc.)
      if (shouldReplace(existing, result)) {
        seen.set(normalizedTitle, result);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Determine if a result should replace an existing one
 */
function shouldReplace(existing: AcademicAPIResult, candidate: AcademicAPIResult): boolean {
  // Prefer results with PDF
  if (candidate.pdfUrl && !existing.pdfUrl) return true;
  if (!candidate.pdfUrl && existing.pdfUrl) return false;

  // Prefer results with more citations
  if ((candidate.citationCount || 0) > (existing.citationCount || 0)) return true;

  // Prefer results with abstract
  if (candidate.resumo && !existing.resumo) return true;

  return false;
}

/**
 * Enrich results with full PDF content (optional, expensive operation)
 */
export async function enrichWithPDFContent(
  results: AcademicAPIResult[],
  maxToExtract: number = 5
): Promise<AcademicAPIResult[]> {
  logger.info('Enriching results with PDF content', { maxToExtract });

  const enriched = await Promise.all(
    results.slice(0, maxToExtract).map(async (result) => {
      if (!result.pdfUrl) return result;

      try {
        const pdfContent = await extractPDFContent(result.pdfUrl);
        if (pdfContent) {
          return {
            ...result,
            fullText: pdfContent.fullText.substring(0, 10000), // Limit size
            sections: pdfContent.sections
          };
        }
      } catch (error: any) {
        logger.warn('Failed to extract PDF', {
          title: result.titulo,
          error: error.message
        });
      }

      return result;
    })
  );

  // Return enriched results + remaining unenriched
  return [...enriched, ...results.slice(maxToExtract)];
}

/**
 * Get circuit breaker stats
 */
export function getSearchStats() {
  return {
    circuitBreakers: Object.entries(circuitBreakers).map(([name, cb]) => ({
      name,
      state: cb.getState()
    }))
  };
}
