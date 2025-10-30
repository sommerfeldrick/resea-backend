import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../config/logger.js';
import { academicSearchService, type AcademicPaper } from './academicSearchService.js';

interface ScrapedSource {
  url: string;
  title: string;
  content: string;
  timestamp: Date;
}

interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  useCache?: boolean;
}

export class ResearchService {
  private groq: Groq | null = null;
  private togetherAI: any = null;
  private cohere: any = null;
  private gemini: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    // Inicializa TODAS as APIs gratuitas disponíveis

    // 1. Groq - Mais rápido
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      logger.info('✅ Groq SDK initialized');
    }

    // 2. Together.AI - Potente ($25 crédito grátis)
    if (process.env.TOGETHER_API_KEY) {
      // Together.AI usa API compatível com OpenAI
      this.togetherAI = new OpenAI({
        apiKey: process.env.TOGETHER_API_KEY,
        baseURL: 'https://api.together.xyz/v1'
      });
      logger.info('✅ Together.AI SDK initialized');
    }

    // 3. Cohere - Command R+ (100 req/min grátis)
    if (process.env.COHERE_API_KEY) {
      this.cohere = {
        apiKey: process.env.COHERE_API_KEY,
        baseURL: 'https://api.cohere.ai/v1'
      };
      logger.info('✅ Cohere SDK initialized');
    }

    // 4. Google Gemini - Grátis até 60 req/min
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      logger.info('✅ Gemini SDK initialized');
    }

    // 5. OpenAI - PAGO, último recurso
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      logger.info('⚠️  OpenAI SDK initialized (PAID - will use as last resort)');
    }

    const freeCount = [this.groq, this.togetherAI, this.cohere, this.gemini].filter(Boolean).length;
    logger.info(`🤖 AI Providers ready: ${freeCount} free + ${this.openai ? '1 paid' : '0 paid'}`);
  }

  /**
   * Busca papers acadêmicos usando TODAS as fontes disponíveis
   * Usa API acadêmicas (OpenAlex, Semantic Scholar, arXiv, etc.) ao invés de scraping
   */
  async scrapeSources(query: string): Promise<ScrapedSource[]> {
    logger.info(`📚 Starting comprehensive academic search for: "${query}"`);

    try {
      // Usa o novo serviço de busca acadêmica (7 fontes gratuitas + 1 paga)
      const papers = await academicSearchService.searchAll(query, {
        maxResults: 20,
        openAccessOnly: false
      });

      logger.info(`✅ Found ${papers.length} academic papers from multiple sources`);

      // Converte papers para formato ScrapedSource
      const sources: ScrapedSource[] = papers.map((paper: AcademicPaper) => ({
        url: paper.url,
        title: paper.title,
        content: this.formatPaperContent(paper),
        timestamp: new Date()
      }));

      // Se nenhum paper foi encontrado, tenta scraping antigo como fallback
      if (sources.length === 0) {
        logger.warn('No papers found via APIs, trying legacy scraping...');
        return await this.legacyScrapeSources(query);
      }

      return sources;
    } catch (error) {
      logger.error('Academic search failed, falling back to legacy scraping:', error);
      return await this.legacyScrapeSources(query);
    }
  }

  /**
   * Formata paper acadêmico em texto estruturado
   */
  private formatPaperContent(paper: AcademicPaper): string {
    const parts: string[] = [];

    parts.push(`# ${paper.title}`);

    if (paper.authors.length > 0) {
      parts.push(`**Autores:** ${paper.authors.slice(0, 5).join(', ')}${paper.authors.length > 5 ? ' et al.' : ''}`);
    }

    if (paper.year) {
      parts.push(`**Ano:** ${paper.year}`);
    }

    if (paper.citationCount) {
      parts.push(`**Citações:** ${paper.citationCount}`);
    }

    if (paper.doi) {
      parts.push(`**DOI:** ${paper.doi}`);
    }

    parts.push(`**Fonte:** ${paper.source}`);

    if (paper.isOpenAccess) {
      parts.push(`**Acesso Aberto:** ✅ Sim`);
    }

    if (paper.abstract) {
      parts.push(`\n**Resumo:**\n${paper.abstract}`);
    }

    return parts.join('\n');
  }

  /**
   * Scraping legado (fallback) - mantido para compatibilidade
   */
  private async legacyScrapeSources(query: string): Promise<ScrapedSource[]> {
    logger.info(`Using legacy web scraping for: "${query}"`);
    const sources: ScrapedSource[] = [];

    const searchUrls = [
      `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
      `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
      `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`
    ];

    for (const url of searchUrls) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000,
          maxRedirects: 5
        });

        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, aside, iframe').remove();

        const title = $('h1').first().text().trim() || $('title').text().trim() || 'Sem título';
        const contentParts: string[] = [];

        $('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) contentParts.push(text);
        });

        const content = contentParts.slice(0, 30).join('\n\n');

        if (content.length > 100) {
          sources.push({ url, title, content, timestamp: new Date() });
          logger.info(`Scraped ${url} - ${content.length} chars`);
        }
      } catch (error) {
        logger.error(`Failed to scrape ${url}`);
      }
    }

    return sources;
  }

  /**
   * Prepara contexto a partir dos dados coletados
   */
  private prepareContext(sources: ScrapedSource[]): string {
    if (sources.length === 0) {
      return 'Nenhum dado de pesquisa disponível.';
    }

    const contextParts = sources.map((source, index) => {
      return `
### Fonte ${index + 1}: ${source.title}
URL: ${source.url}

${source.content.substring(0, 2000)}
      `.trim();
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * GERAÇÃO COM IA - Multi-provider com fallback automático
   * Ordem: Groq → Together.AI → Cohere → Gemini → Ollama → OpenAI (PAGO)
   */
  async generateContent(
    prompt: string,
    sources: ScrapedSource[],
    options: GenerateOptions = {}
  ): Promise<string> {
    const {
      maxTokens = 4000,
      temperature = 0.7
    } = options;

    // Prepara contexto da pesquisa
    const context = this.prepareContext(sources);
    const fullPrompt = `${prompt}\n\nCONTEXTO DA PESQUISA:\n${context}`;
    const systemPrompt = 'Você é um assistente de pesquisa acadêmica especializado. Gere conteúdo de alta qualidade, bem estruturado e baseado em evidências.';

    logger.info('🤖 Starting AI content generation with 6-tier fallback strategy');

    // === GRATUITAS ===

    // 1. GROQ (Mais rápido)
    if (this.groq) {
      try {
        logger.info('[1/6] Trying Groq (FREE - fastest)...');
        const completion = await this.groq.chat.completions.create({
          model: 'mixtral-8x7b-32768',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          logger.info('✅ Content generated with Groq');
          return content;
        }
      } catch (error) {
        logger.warn('❌ Groq failed, trying next...');
      }
    }

    // 2. Together.AI (Mais potente - Llama 3 70B)
    if (this.togetherAI) {
      try {
        logger.info('[2/6] Trying Together.AI (FREE - $25 credit)...');
        const completion = await this.togetherAI.chat.completions.create({
          model: 'meta-llama/Llama-3-70b-chat-hf',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          logger.info('✅ Content generated with Together.AI');
          return content;
        }
      } catch (error) {
        logger.warn('❌ Together.AI failed, trying next...');
      }
    }

    // 3. Cohere (Command R+)
    if (this.cohere) {
      try {
        logger.info('[3/6] Trying Cohere (FREE - 100 req/min)...');
        const response = await axios.post(
          `${this.cohere.baseURL}/chat`,
          {
            message: fullPrompt,
            model: 'command-r-plus',
            temperature,
            max_tokens: maxTokens
          },
          {
            headers: {
              'Authorization': `Bearer ${this.cohere.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        if (response.data.text) {
          logger.info('✅ Content generated with Cohere');
          return response.data.text;
        }
      } catch (error) {
        logger.warn('❌ Cohere failed, trying next...');
      }
    }

    // 4. Google Gemini (Grátis 60 req/min)
    if (this.gemini) {
      try {
        logger.info('[4/6] Trying Gemini (FREE - 60 req/min)...');
        const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const content = response.text();

        if (content) {
          logger.info('✅ Content generated with Gemini');
          return content;
        }
      } catch (error) {
        logger.warn('❌ Gemini failed, trying next...');
      }
    }

    // 5. Ollama (Local, 100% grátis)
    try {
      logger.info('[5/6] Trying Ollama (FREE - local)...');
      const response = await axios.post(
        process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
        {
          model: 'llama2',
          prompt: fullPrompt,
          stream: false
        },
        { timeout: 120000 }
      );

      if (response.data.response) {
        logger.info('✅ Content generated with Ollama');
        return response.data.response;
      }
    } catch (error) {
      logger.warn('❌ Ollama failed, trying last resort...');
    }

    // === PAGA (Último recurso) ===

    // 6. OpenAI (PAGO - Mais caro)
    if (this.openai) {
      try {
        logger.warn('[6/6] All free APIs failed! Trying OpenAI (PAID - last resort)...');
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          logger.info('💰 Content generated with OpenAI (PAID)');
          return content;
        }
      } catch (error) {
        logger.error('❌ Even OpenAI failed!');
      }
    }

    // Se TODAS falharem
    throw new Error('❌ Todas as 6 IAs falharam! Verifique as configurações das APIs.');
  }

  /**
   * Conta palavras em um texto
   */
  countWords(text: string): number {
    if (!text || typeof text !== 'string') return 0;

    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Gera um plano de pesquisa baseado na query
   */
  async generateResearchPlan(query: string): Promise<any> {
    const planPrompt = `
Crie um plano de pesquisa acadêmica detalhado para o seguinte tópico:
"${query}"

Forneça a resposta em formato JSON com a seguinte estrutura:
{
  "taskTitle": "Título da pesquisa",
  "taskDescription": {
    "type": "Tipo de documento",
    "audience": "Público alvo",
    "style": "Estilo de escrita",
    "wordCount": "Contagem estimada"
  },
  "executionPlan": {
    "thinking": ["passos de análise"],
    "research": ["passos de pesquisa"],
    "writing": ["passos de escrita"]
  }
}
    `.trim();

    try {
      const content = await this.generateContent(planPrompt, [], {
        maxTokens: 2000,
        temperature: 0.5
      });

      // Tenta parsear JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback se não conseguir parsear
      return {
        taskTitle: query,
        taskDescription: {
          type: 'Pesquisa Acadêmica',
          audience: 'Estudantes e Pesquisadores',
          style: 'Científico',
          wordCount: '2000-3000'
        },
        executionPlan: {
          thinking: ['Análise do tema', 'Identificação de conceitos-chave'],
          research: ['Busca de fontes', 'Leitura e síntese'],
          writing: ['Estruturação', 'Redação', 'Revisão']
        }
      };
    } catch (error) {
      logger.error('Failed to generate research plan:', error);
      throw error;
    }
  }
}

// Singleton instance
export const researchService = new ResearchService();
