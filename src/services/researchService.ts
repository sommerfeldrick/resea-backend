import { Groq } from 'groq-sdk';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../config/logger.js';

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
  private openai: OpenAI | null = null;

  constructor() {
    // Inicializa apenas as APIs que têm chave configurada
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      logger.info('Groq SDK initialized');
    }

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      logger.info('OpenAI SDK initialized');
    }

    if (!this.groq && !this.openai) {
      logger.warn('No AI providers configured! Set GROQ_API_KEY or OPENAI_API_KEY.');
    }
  }

  /**
   * SCRAPING - Coleta dados de fontes web (GRÁTIS!)
   */
  async scrapeSources(query: string): Promise<ScrapedSource[]> {
    logger.info(`Starting web scraping for query: "${query}"`);
    const sources: ScrapedSource[] = [];

    // Lista de fontes para pesquisar
    const searchUrls = [
      // Google Scholar (acadêmico)
      `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
      // PubMed (médico/científico)
      `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
      // Wikipedia (contexto geral)
      `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`
    ];

    for (const url of searchUrls) {
      try {
        logger.info(`Scraping: ${url}`);

        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000,
          maxRedirects: 5
        });

        const $ = cheerio.load(response.data);

        // Remove scripts, styles e elementos desnecessários
        $('script, style, nav, footer, header, aside, iframe').remove();

        // Extrai título
        const title = $('h1').first().text().trim() ||
                     $('title').text().trim() ||
                     'Sem título';

        // Extrai conteúdo textual relevante
        const contentParts: string[] = [];

        // Parágrafos
        $('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) { // Apenas textos substanciais
            contentParts.push(text);
          }
        });

        // Headings importantes
        $('h2, h3').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 10) {
            contentParts.push(`## ${text}`);
          }
        });

        // Listas
        $('li').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 20) {
            contentParts.push(`- ${text}`);
          }
        });

        const content = contentParts.slice(0, 30).join('\n\n'); // Limita a 30 partes

        if (content.length > 100) {
          sources.push({
            url,
            title,
            content,
            timestamp: new Date()
          });
          logger.info(`Successfully scraped ${url} - ${content.length} chars`);
        }
      } catch (error) {
        logger.error(`Failed to scrape ${url}:`, error instanceof Error ? error.message : error);
        // Continua com próxima fonte
      }
    }

    logger.info(`Scraping completed: ${sources.length} sources collected`);
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

    logger.info('Starting AI content generation with fallback strategy');

    // Estratégia 1: GROQ (Mais rápido e barato)
    if (this.groq) {
      try {
        logger.info('Attempting generation with Groq...');
        const completion = await this.groq.chat.completions.create({
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente de pesquisa acadêmica especializado. Gere conteúdo de alta qualidade, bem estruturado e baseado em evidências.'
            },
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          logger.info('✅ Content generated successfully with Groq');
          return content;
        }
      } catch (error) {
        logger.error('Groq generation failed:', error instanceof Error ? error.message : error);
      }
    }

    // Estratégia 2: OLLAMA (Local, totalmente grátis)
    try {
      logger.info('Attempting generation with Ollama (local)...');
      const response = await axios.post(
        process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
        {
          model: 'llama2',
          prompt: fullPrompt,
          stream: false
        },
        { timeout: 120000 } // 2 minutos
      );

      if (response.data.response) {
        logger.info('✅ Content generated successfully with Ollama');
        return response.data.response;
      }
    } catch (error) {
      logger.error('Ollama generation failed:', error instanceof Error ? error.message : error);
    }

    // Estratégia 3: OPENAI (Mais caro, último recurso)
    if (this.openai) {
      try {
        logger.info('Attempting generation with OpenAI (last resort)...');
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente de pesquisa acadêmica especializado.'
            },
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          logger.info('✅ Content generated successfully with OpenAI');
          return content;
        }
      } catch (error) {
        logger.error('OpenAI generation failed:', error instanceof Error ? error.message : error);
      }
    }

    // Se todos falharem
    throw new Error('Todas as IAs falharam ao gerar conteúdo. Verifique as configurações das APIs.');
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
