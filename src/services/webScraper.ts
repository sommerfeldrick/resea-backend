/**
 * Web Scraper Service
 * Extrai informações de artigos ANTES de passar para IA
 * ECONOMIA: Evita usar tokens de IA para processar texto bruto
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { logger } from '../config/logger.js';

export interface ScrapedArticle {
  title: string;
  authors: string[];
  abstract: string;
  fullText?: string;
  sections: {
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
  keywords: string[];
  references: string[];
  metadata: {
    year?: number;
    doi?: string;
    journal?: string;
    wordCount: number;
  };
}

/**
 * Scrape article from URL (HTML or PDF)
 */
export async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    logger.info('Scraping article', { url });

    // Detectar tipo de conteúdo
    const response = await axios.head(url, { timeout: 5000 });
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/pdf')) {
      return await scrapePDF(url);
    } else {
      return await scrapeHTML(url);
    }
  } catch (error: any) {
    logger.error('Article scraping failed', { url, error: error.message });
    return null;
  }
}

/**
 * Scrape PDF article
 */
async function scrapePDF(url: string): Promise<ScrapedArticle | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReseaBot/1.0)'
      }
    });

    const buffer = Buffer.from(response.data);
    const data = await pdfParse(buffer);
    const fullText = data.text;

    return {
      title: extractTitleFromPDF(fullText),
      authors: extractAuthorsFromPDF(fullText),
      abstract: extractSection(fullText, 'abstract'),
      fullText,
      sections: {
        introduction: extractSection(fullText, 'introduction'),
        methodology: extractSection(fullText, 'methodology'),
        results: extractSection(fullText, 'results'),
        discussion: extractSection(fullText, 'discussion'),
        conclusion: extractSection(fullText, 'conclusion')
      },
      keywords: extractKeywords(fullText),
      references: extractReferences(fullText),
      metadata: {
        wordCount: fullText.split(/\s+/).length
      }
    };
  } catch (error: any) {
    logger.error('PDF scraping failed', { url, error: error.message });
    return null;
  }
}

/**
 * Scrape HTML article
 */
async function scrapeHTML(url: string): Promise<ScrapedArticle | null> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReseaBot/1.0)'
      }
    });

    const $ = cheerio.load(response.data);

    // Tentar múltiplos seletores comuns para artigos acadêmicos
    const title = extractTitleFromHTML($);
    const authors = extractAuthorsFromHTML($);
    const abstract = extractAbstractFromHTML($);
    const fullText = extractFullTextFromHTML($);

    return {
      title,
      authors,
      abstract,
      fullText,
      sections: extractSectionsFromHTML($),
      keywords: extractKeywordsFromHTML($),
      references: extractReferencesFromHTML($),
      metadata: {
        year: extractYearFromHTML($),
        doi: extractDOIFromHTML($),
        journal: extractJournalFromHTML($),
        wordCount: fullText.split(/\s+/).length
      }
    };
  } catch (error: any) {
    logger.error('HTML scraping failed', { url, error: error.message });
    return null;
  }
}

/**
 * Extract title from HTML
 */
function extractTitleFromHTML($: cheerio.CheerioAPI): string {
  const selectors = [
    'meta[name="citation_title"]',
    'meta[property="og:title"]',
    'h1.article-title',
    'h1.title',
    'title'
  ];

  for (const selector of selectors) {
    const content = $(selector).attr('content') || $(selector).text();
    if (content && content.trim()) {
      return content.trim();
    }
  }

  return 'Título não encontrado';
}

/**
 * Extract authors from HTML
 */
function extractAuthorsFromHTML($: cheerio.CheerioAPI): string[] {
  const authors: string[] = [];

  // Meta tags
  $('meta[name="citation_author"]').each((_, el) => {
    const author = $(el).attr('content');
    if (author) authors.push(author);
  });

  // Se não encontrou, tentar outros seletores
  if (authors.length === 0) {
    $('.author-name, .author, [itemprop="author"]').each((_, el) => {
      const author = $(el).text().trim();
      if (author) authors.push(author);
    });
  }

  return authors;
}

/**
 * Extract abstract from HTML
 */
function extractAbstractFromHTML($: cheerio.CheerioAPI): string {
  const selectors = [
    'meta[name="citation_abstract"]',
    'meta[name="description"]',
    '.abstract',
    '#abstract',
    '[id*="abstract"]',
    'section.abstract'
  ];

  for (const selector of selectors) {
    const content = $(selector).attr('content') || $(selector).text();
    if (content && content.trim().length > 100) {
      return content.trim();
    }
  }

  return '';
}

/**
 * Extract full text from HTML
 */
function extractFullTextFromHTML($: cheerio.CheerioAPI): string {
  // Remover scripts, styles, navegação
  $('script, style, nav, header, footer, .references').remove();

  // Tentar pegar o conteúdo principal
  const mainSelectors = [
    'article',
    'main',
    '.article-content',
    '.main-content',
    '#main-content'
  ];

  for (const selector of mainSelectors) {
    const content = $(selector).text();
    if (content && content.trim().length > 500) {
      return content.trim();
    }
  }

  // Fallback: pegar body
  return $('body').text().trim();
}

/**
 * Extract sections from HTML
 */
function extractSectionsFromHTML($: cheerio.CheerioAPI): ScrapedArticle['sections'] {
  const sections: ScrapedArticle['sections'] = {};

  const sectionMap = {
    introduction: ['introduction', 'introdução', 'intro'],
    methodology: ['methodology', 'methods', 'metodologia', 'métodos', 'materials'],
    results: ['results', 'resultados'],
    discussion: ['discussion', 'discussão'],
    conclusion: ['conclusion', 'conclusions', 'conclusão', 'conclusões']
  };

  for (const [key, patterns] of Object.entries(sectionMap)) {
    for (const pattern of patterns) {
      const selector = `section:contains("${pattern}"), h2:contains("${pattern}"), h3:contains("${pattern}")`;
      const element = $(selector).first();

      if (element.length) {
        const text = element.parent().text() || element.next('p, div').text();
        if (text && text.trim().length > 100) {
          sections[key as keyof ScrapedArticle['sections']] = text.trim().substring(0, 2000);
          break;
        }
      }
    }
  }

  return sections;
}

/**
 * Extract keywords from HTML
 */
function extractKeywordsFromHTML($: cheerio.CheerioAPI): string[] {
  const keywords: string[] = [];

  // Meta tags
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    keywords.push(...metaKeywords.split(',').map(k => k.trim()));
  }

  // Citation keywords
  $('meta[name="citation_keywords"]').each((_, el) => {
    const keyword = $(el).attr('content');
    if (keyword) keywords.push(keyword);
  });

  return keywords.filter(k => k.length > 0);
}

/**
 * Extract references from HTML
 */
function extractReferencesFromHTML($: cheerio.CheerioAPI): string[] {
  const references: string[] = [];

  $('.reference, .citation, [id*="ref-"]').each((_, el) => {
    const ref = $(el).text().trim();
    if (ref && ref.length > 20) {
      references.push(ref);
    }
  });

  return references.slice(0, 50); // Limitar a 50 referências
}

/**
 * Extract year from HTML
 */
function extractYearFromHTML($: cheerio.CheerioAPI): number | undefined {
  const yearMeta = $('meta[name="citation_publication_date"]').attr('content');
  if (yearMeta) {
    const year = parseInt(yearMeta.substring(0, 4));
    if (!isNaN(year)) return year;
  }

  const yearMatch = $('body').text().match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  return undefined;
}

/**
 * Extract DOI from HTML
 */
function extractDOIFromHTML($: cheerio.CheerioAPI): string | undefined {
  const doiMeta = $('meta[name="citation_doi"]').attr('content');
  if (doiMeta) return doiMeta;

  const doiLink = $('a[href*="doi.org"]').attr('href');
  if (doiLink) {
    return doiLink.replace(/.*doi\.org\//, '');
  }

  return undefined;
}

/**
 * Extract journal from HTML
 */
function extractJournalFromHTML($: cheerio.CheerioAPI): string | undefined {
  return $('meta[name="citation_journal_title"]').attr('content');
}

/**
 * Helper functions for PDF extraction
 */
function extractTitleFromPDF(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  return lines[0]?.substring(0, 200) || 'Título não encontrado';
}

function extractAuthorsFromPDF(text: string): string[] {
  // Heurística simples: procurar por nomes após o título
  const lines = text.split('\n');
  const authors: string[] = [];

  for (let i = 1; i < Math.min(10, lines.length); i++) {
    const line = lines[i]?.trim();
    if (line && line.length < 100 && /^[A-Z]/.test(line)) {
      authors.push(line);
    } else if (authors.length > 0) {
      break;
    }
  }

  return authors;
}

function extractSection(text: string, sectionName: string): string {
  const patterns: Record<string, RegExp> = {
    abstract: /(?:abstract|resumo)\s*\n([\s\S]{100,3000}?)(?:\n\s*\n|introduction|introdução)/i,
    introduction: /(?:introduction|introdução)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|methodology|metodologia)/i,
    methodology: /(?:methodology|methods|metodologia|métodos)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|results|resultados)/i,
    results: /(?:results|resultados)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|discussion|discussão)/i,
    discussion: /(?:discussion|discussão)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|conclusion|conclusão)/i,
    conclusion: /(?:conclusion|conclusão)\s*\n([\s\S]{100,3000}?)(?:\n\s*\n|references|referências)/i
  };

  const pattern = patterns[sectionName];
  if (!pattern) return '';

  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
}

function extractKeywords(text: string): string[] {
  const keywordMatch = text.match(/(?:keywords|palavras-chave)[:\s]+([^\n]+)/i);
  if (keywordMatch) {
    return keywordMatch[1].split(/[,;]/).map(k => k.trim()).filter(k => k.length > 0);
  }
  return [];
}

function extractReferences(text: string): string[] {
  const referencesMatch = text.match(/(?:references|referências)\s*\n([\s\S]+)/i);
  if (referencesMatch) {
    return referencesMatch[1]
      .split('\n')
      .filter(line => line.trim().length > 20)
      .slice(0, 50);
  }
  return [];
}

/**
 * Process scraped data to reduce size before AI
 * ECONOMIA: Envia apenas resumo para IA ao invés de texto completo
 */
export function prepareForAI(article: ScrapedArticle): string {
  const parts: string[] = [];

  // Título e autores
  parts.push(`# ${article.title}`);
  if (article.authors.length > 0) {
    parts.push(`Autores: ${article.authors.join(', ')}`);
  }

  // Metadata
  if (article.metadata.year) {
    parts.push(`Ano: ${article.metadata.year}`);
  }
  if (article.metadata.doi) {
    parts.push(`DOI: ${article.metadata.doi}`);
  }

  // Abstract
  if (article.abstract) {
    parts.push(`\n## Resumo\n${article.abstract}`);
  }

  // Keywords
  if (article.keywords.length > 0) {
    parts.push(`\nPalavras-chave: ${article.keywords.join(', ')}`);
  }

  // Seções principais (apenas primeiros 500 chars de cada)
  const sections = article.sections;
  if (sections.introduction) {
    parts.push(`\n## Introdução\n${sections.introduction.substring(0, 500)}...`);
  }
  if (sections.methodology) {
    parts.push(`\n## Metodologia\n${sections.methodology.substring(0, 500)}...`);
  }
  if (sections.results) {
    parts.push(`\n## Resultados\n${sections.results.substring(0, 500)}...`);
  }
  if (sections.conclusion) {
    parts.push(`\n## Conclusão\n${sections.conclusion.substring(0, 500)}...`);
  }

  return parts.join('\n');
}

/**
 * Calculate token savings
 */
export function calculateSavings(originalText: string, processedText: string): {
  originalTokens: number;
  processedTokens: number;
  savings: number;
  savingsPercent: number;
} {
  // Aproximação: 1 token ≈ 4 caracteres
  const originalTokens = Math.ceil(originalText.length / 4);
  const processedTokens = Math.ceil(processedText.length / 4);
  const savings = originalTokens - processedTokens;
  const savingsPercent = (savings / originalTokens) * 100;

  return {
    originalTokens,
    processedTokens,
    savings,
    savingsPercent
  };
}
