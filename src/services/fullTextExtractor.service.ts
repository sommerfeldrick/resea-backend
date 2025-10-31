/**
 * Serviço para extração de texto completo de artigos acadêmicos
 * Pipeline: GROBID (primário) → pdf-parse (fallback) → OCR (última opção)
 */

import axios from 'axios';
import FormData from 'form-data';
import pdfParse from 'pdf-parse';
import { 
  FullPaper, 
  ExtractionConfig, 
  ExtractionResult,
  PaperSection,
  PaperFigure,
  PaperTable,
  PaperReference,
  PaperMetadata 
} from '../types/fullPaper.js';

export class FullTextExtractorService {
  private grobidUrl: string;
  private unpaywallEmail: string;
  private maxPdfSize: number = 50 * 1024 * 1024; // 50MB

  constructor() {
    this.grobidUrl = process.env.GROBID_URL || 'http://localhost:8070';
    this.unpaywallEmail = process.env.UNPAYWALL_EMAIL || 'your@email.com';
  }

  /**
   * Extrai texto completo de um paper
   */
  async extractFullText(
    paper: Partial<FullPaper>,
    config: Partial<ExtractionConfig> = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Encontrar URL do PDF
      const pdfUrl = await this.findPdfUrl(paper);
      
      if (!pdfUrl) {
        return {
          success: false,
          error: 'PDF não encontrado',
          metadata: {
            extractedAt: new Date(),
            extractionMethod: 'pdf-parse',
            confidence: 0
          }
        };
      }

      // 2. Baixar PDF
      const pdfBuffer = await this.downloadPdf(pdfUrl, config.maxPdfSize);
      
      if (!pdfBuffer) {
        return {
          success: false,
          error: 'Falha ao baixar PDF',
          metadata: {
            extractedAt: new Date(),
            extractionMethod: 'pdf-parse',
            pdfUrl,
            confidence: 0
          }
        };
      }

      // 3. Tentar extração com GROBID (melhor qualidade)
      const method = config.method || 'auto';
      let extractionResult: ExtractionResult | null = null;

      if (method === 'grobid' || method === 'auto') {
        extractionResult = await this.extractWithGrobid(pdfBuffer, paper);
        if (extractionResult.success) {
          console.log(`✅ GROBID extraction successful for: ${paper.title}`);
          extractionResult.metadata.pdfUrl = pdfUrl;
          return extractionResult;
        }
      }

      // 4. Fallback: pdf-parse (estrutura mais simples)
      console.log(`⚠️ GROBID failed, trying pdf-parse for: ${paper.title}`);
      extractionResult = await this.extractWithPdfParse(pdfBuffer, paper);
      
      if (extractionResult.success) {
        console.log(`✅ pdf-parse extraction successful`);
        extractionResult.metadata.pdfUrl = pdfUrl;
        return extractionResult;
      }

      // 5. Se tudo falhar
      return {
        success: false,
        error: 'Todas as estratégias de extração falharam',
        metadata: {
          extractedAt: new Date(),
          extractionMethod: 'hybrid',
          pdfUrl,
          confidence: 0
        }
      };

    } catch (error) {
      console.error('Erro na extração de texto:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        metadata: {
          extractedAt: new Date(),
          extractionMethod: 'pdf-parse',
          confidence: 0
        }
      };
    }
  }

  /**
   * Encontra URL do PDF usando múltiplas estratégias
   */
  private async findPdfUrl(paper: Partial<FullPaper>): Promise<string | null> {
    // 1. URL direta se disponível
    if (paper.url && paper.url.includes('.pdf')) {
      return paper.url;
    }

    // 2. arXiv - URL padrão
    if (paper.source === 'arxiv' || paper.url?.includes('arxiv.org')) {
      const arxivId = this.extractArxivId(paper.url || '');
      if (arxivId) {
        return `https://arxiv.org/pdf/${arxivId}.pdf`;
      }
    }

    // 3. Unpaywall API (Open Access)
    if (paper.doi) {
      try {
        const unpaywallUrl = `https://api.unpaywall.org/v2/${paper.doi}?email=${this.unpaywallEmail}`;
        const response = await axios.get(unpaywallUrl, { timeout: 5000 });
        
        if (response.data.best_oa_location?.url_for_pdf) {
          return response.data.best_oa_location.url_for_pdf;
        }
      } catch (error) {
        console.log('Unpaywall lookup failed:', error instanceof Error ? error.message : error);
      }
    }

    // 4. Semantic Scholar PDF
    if (paper.source === 'semantic-scholar' && paper.id) {
      try {
        const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/${paper.id}?fields=openAccessPdf`;
        const response = await axios.get(ssUrl, { timeout: 5000 });
        
        if (response.data.openAccessPdf?.url) {
          return response.data.openAccessPdf.url;
        }
      } catch (error) {
        console.log('Semantic Scholar PDF lookup failed');
      }
    }

    return null;
  }

  /**
   * Extrai ID do arXiv de uma URL
   */
  private extractArxivId(url: string): string | null {
    const match = url.match(/arxiv\.org\/(abs|pdf)\/([0-9.]+)/);
    return match ? match[2] : null;
  }

  /**
   * Baixa PDF e retorna buffer
   */
  private async downloadPdf(url: string, maxSize?: number): Promise<Buffer | null> {
    try {
      const maxSizeBytes = maxSize || this.maxPdfSize;
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: maxSizeBytes,
        headers: {
          'User-Agent': 'ResearchBot/1.0 (Academic Research Assistant)'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extração usando GROBID (melhor qualidade estrutural)
   */
  private async extractWithGrobid(
    pdfBuffer: Buffer,
    paper: Partial<FullPaper>
  ): Promise<ExtractionResult> {
    try {
      const formData = new FormData();
      formData.append('input', pdfBuffer, {
        filename: 'paper.pdf',
        contentType: 'application/pdf'
      });

      const response = await axios.post(
        `${this.grobidUrl}/api/processFulltextDocument`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 60000,
          maxContentLength: 100 * 1024 * 1024
        }
      );

      // Parse XML TEI retornado pelo GROBID
      const sections = this.parseGrobidXml(response.data);
      
      const fullPaper: FullPaper = {
        ...paper as FullPaper,
        fullText: {
          sections,
          rawText: sections.map(s => `${s.title}\n${s.content}`).join('\n\n')
        },
        extraction: {
          extractedAt: new Date(),
          extractionMethod: 'grobid',
          confidence: 0.9,
          pageCount: this.countPages(sections)
        }
      };

      return {
        success: true,
        paper: fullPaper,
        metadata: fullPaper.extraction!
      };

    } catch (error) {
      console.error('GROBID extraction failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'GROBID extraction failed',
        metadata: {
          extractedAt: new Date(),
          extractionMethod: 'grobid',
          confidence: 0
        }
      };
    }
  }

  /**
   * Parse XML TEI do GROBID (simplificado)
   */
  private parseGrobidXml(xmlData: string): PaperSection[] {
    const sections: PaperSection[] = [];
    
    // Regex simples para extrair seções (versão simplificada)
    // Em produção, usar xml2js ou cheerio para parse adequado
    const divRegex = /<div[^>]*>.*?<head[^>]*>(.*?)<\/head>(.*?)<\/div>/gs;
    const matches = xmlData.matchAll(divRegex);

    let sectionIndex = 0;
    for (const match of matches) {
      const title = this.stripHtml(match[1]);
      const content = this.stripHtml(match[2]);
      
      if (title && content) {
        sections.push({
          title,
          content: content.trim(),
          level: 1,
        });
        sectionIndex++;
      }
    }

    // Se não encontrou seções estruturadas, extrair texto bruto
    if (sections.length === 0) {
      const textContent = this.stripHtml(xmlData);
      if (textContent.length > 100) {
        sections.push({
          title: 'Full Text',
          content: textContent,
          level: 1
        });
      }
    }

    return sections;
  }

  /**
   * Remove tags HTML/XML
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extração usando pdf-parse (fallback)
   */
  private async extractWithPdfParse(
    pdfBuffer: Buffer,
    paper: Partial<FullPaper>
  ): Promise<ExtractionResult> {
    try {
      const data = await pdfParse(pdfBuffer);
      
      // Tenta dividir em seções básicas
      const sections = this.splitIntoSections(data.text);
      
      const fullPaper: FullPaper = {
        ...paper as FullPaper,
        fullText: {
          sections,
          rawText: data.text
        },
        extraction: {
          extractedAt: new Date(),
          extractionMethod: 'pdf-parse',
          confidence: 0.7,
          pageCount: data.numpages
        }
      };

      return {
        success: true,
        paper: fullPaper,
        metadata: fullPaper.extraction!
      };

    } catch (error) {
      console.error('pdf-parse extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'pdf-parse failed',
        metadata: {
          extractedAt: new Date(),
          extractionMethod: 'pdf-parse',
          confidence: 0
        }
      };
    }
  }

  /**
   * Divide texto em seções usando heurísticas
   */
  private splitIntoSections(text: string): PaperSection[] {
    const sections: PaperSection[] = [];
    
    // Padrões comuns de títulos de seção
    const sectionPatterns = [
      /^(\d+\.?\s+)?abstract/im,
      /^(\d+\.?\s+)?introduction/im,
      /^(\d+\.?\s+)?related work/im,
      /^(\d+\.?\s+)?methodology/im,
      /^(\d+\.?\s+)?methods/im,
      /^(\d+\.?\s+)?results/im,
      /^(\d+\.?\s+)?discussion/im,
      /^(\d+\.?\s+)?conclusion/im,
      /^(\d+\.?\s+)?references/im,
    ];

    const lines = text.split('\n');
    let currentSection: PaperSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Verifica se é um título de seção
      const isSection = sectionPatterns.some(pattern => pattern.test(trimmed));
      
      if (isSection && trimmed.length < 100) {
        // Salva seção anterior
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }
        
        // Nova seção
        currentSection = {
          title: trimmed,
          content: '',
          level: 1
        };
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Salva última seção
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    // Se não encontrou seções, retorna texto completo
    if (sections.length === 0) {
      sections.push({
        title: 'Full Text',
        content: text,
        level: 1
      });
    }

    return sections;
  }

  /**
   * Estima número de páginas
   */
  private countPages(sections: PaperSection[]): number {
    const totalChars = sections.reduce((sum, s) => sum + s.content.length, 0);
    // Aproximadamente 3000 caracteres por página
    return Math.ceil(totalChars / 3000);
  }

  /**
   * Extrai texto completo de múltiplos papers em lote
   */
  async extractBatch(
    papers: Partial<FullPaper>[],
    config: Partial<ExtractionConfig> = {},
    concurrency: number = 3
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    
    // Processa em lotes para não sobrecarregar
    for (let i = 0; i < papers.length; i += concurrency) {
      const batch = papers.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(paper => this.extractFullText(paper, config))
      );
      results.push(...batchResults);
      
      // Pequeno delay entre lotes
      if (i + concurrency < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

// Singleton export
export const fullTextExtractor = new FullTextExtractorService();
