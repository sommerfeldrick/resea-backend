import pdfParse from 'pdf-parse';
import axios from 'axios';
import { logger } from '../config/logger.js';
import type { PDFExtractionResult } from '../types/index.js';

/**
 * Extract text content from PDF URL or buffer
 */
export async function extractPDFContent(pdfUrl: string): Promise<PDFExtractionResult | null> {
  try {
    logger.info('Extracting PDF content', { pdfUrl });

    // Download PDF
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReseaBot/1.0)'
      }
    });

    const buffer = Buffer.from(response.data);
    const data = await pdfParse(buffer);

    const fullText = data.text;
    const sections = extractSections(fullText);

    return {
      fullText,
      sections,
      metadata: {
        pages: data.numpages,
        wordCount: fullText.split(/\s+/).length
      }
    };
  } catch (error: any) {
    logger.error('PDF extraction failed', {
      pdfUrl,
      error: error.message
    });
    return null;
  }
}

/**
 * Extract academic paper sections using heuristics
 */
function extractSections(text: string): PDFExtractionResult['sections'] {
  const sections: PDFExtractionResult['sections'] = {};

  // Common section headers in English and Portuguese
  const sectionPatterns = {
    abstract: /(?:abstract|resumo)\s*\n([\s\S]{100,3000}?)(?:\n\s*\n|introduction|introdução)/i,
    introduction: /(?:introduction|introdução)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|methodology|metodologia|materials|methods)/i,
    methodology: /(?:methodology|methods|metodologia|materiais e métodos)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|results|resultados)/i,
    results: /(?:results|resultados)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|discussion|discussão|conclusion|conclusão)/i,
    discussion: /(?:discussion|discussão)\s*\n([\s\S]{100,5000}?)(?:\n\s*\n|conclusion|conclusão|references|referências)/i,
    conclusion: /(?:conclusion|conclusions|conclusão|conclusões)\s*\n([\s\S]{100,3000}?)(?:\n\s*\n|references|referências|acknowledgments|agradecimentos)/i
  };

  for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      sections[sectionName as keyof typeof sections] = cleanText(match[1]);
    }
  }

  return sections;
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
    .trim();
}

/**
 * Try to find PDF URL from paper metadata
 */
export function findPDFUrl(paper: any): string | null {
  // Semantic Scholar
  if (paper.openAccessPdf?.url) return paper.openAccessPdf.url;
  if (paper.isOpenAccess && paper.url) {
    // Try common PDF patterns
    const possiblePdfUrls = [
      paper.url.replace(/\/abs\//, '/pdf/'),
      paper.url + '.pdf',
      paper.url.replace(/\/$/, '') + '.pdf'
    ];
    return possiblePdfUrls[0]; // Return first candidate
  }

  // CrossRef
  if (paper.link && paper.link.some((l: any) => l['content-type'] === 'application/pdf')) {
    return paper.link.find((l: any) => l['content-type'] === 'application/pdf').URL;
  }

  // OpenAlex
  if (paper.open_access?.oa_url) return paper.open_access.oa_url;
  if (paper.primary_location?.pdf_url) return paper.primary_location.pdf_url;

  // PubMed Central
  if (paper.uid) {
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${paper.uid}/pdf/`;
  }

  return null;
}

/**
 * Analyze paper quality based on content
 */
export function analyzePaperQuality(pdfContent: PDFExtractionResult | null): {
  score: number;
  reasons: string[];
} {
  if (!pdfContent) {
    return { score: 0, reasons: ['PDF não disponível'] };
  }

  let score = 50; // Base score
  const reasons: string[] = [];

  // Check for complete sections
  const { sections, metadata } = pdfContent;

  if (sections.abstract) {
    score += 10;
    reasons.push('Possui resumo');
  }

  if (sections.methodology) {
    score += 15;
    reasons.push('Metodologia detalhada');
  }

  if (sections.results) {
    score += 15;
    reasons.push('Resultados documentados');
  }

  if (sections.discussion) {
    score += 5;
    reasons.push('Discussão presente');
  }

  if (sections.conclusion) {
    score += 5;
    reasons.push('Conclusão presente');
  }

  // Check content length
  if (metadata.wordCount > 3000) {
    score += 5;
    reasons.push('Artigo completo');
  }

  if (metadata.wordCount < 500) {
    score -= 20;
    reasons.push('Conteúdo muito curto');
  }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}
