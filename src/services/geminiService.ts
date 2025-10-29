import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logger } from '../config/logger.js';
import { buscaAcademicaUniversal, enrichWithPDFContent } from './academicSearch.js';
import { generateText } from './aiProvider.js';
import { scrapeArticle, prepareForAI, calculateSavings } from './webScraper.js';
import type {
  TaskPlan,
  MindMapData,
  AcademicSource,
  AcademicSearchFilters
} from '../types/index.js';

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate task plan from user query
 */
export async function generateTaskPlan(query: string): Promise<TaskPlan> {
  logger.info('Generating task plan', { query });

  try {
    const genAI = getAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            taskTitle: {
              type: SchemaType.STRING,
              description: 'Um título conciso para a tarefa de pesquisa em português.'
            },
            taskDescription: {
              type: SchemaType.OBJECT,
              properties: {
                type: {
                  type: SchemaType.STRING,
                  description: "O tipo de documento a ser produzido (ex: 'revisão de literatura acadêmica')."
                },
                style: {
                  type: SchemaType.STRING,
                  description: "O estilo de escrita (ex: 'acadêmico formal humanizado')."
                },
                audience: {
                  type: SchemaType.STRING,
                  description: 'O público-alvo do documento.'
                },
                wordCount: {
                  type: SchemaType.STRING,
                  description: "A contagem de palavras estimada (ex: '8000-12000 palavras')."
                }
              },
              required: ['type', 'style', 'audience', 'wordCount']
            },
            executionPlan: {
              type: SchemaType.OBJECT,
              properties: {
                thinking: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Uma lista de etapas de 'pensamento' para estruturar o trabalho."
                },
                research: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: 'Uma lista de etapas de pesquisa acionáveis.'
                },
                writing: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: 'Uma lista de etapas de redação para montar o documento.'
                }
              },
              required: ['thinking', 'research', 'writing']
            }
          },
          required: ['taskTitle', 'taskDescription', 'executionPlan']
        }
      }
    });

    const result = await model.generateContent(`Você é um assistente de pesquisa especialista. Com base na consulta do usuário "${query}", crie um plano detalhado de pesquisa e redação. A pesquisa deve ser profunda e o estilo de escrita deve ser humanizado, evitando jargões excessivos para ser claro e envolvente. A saída deve ser um objeto JSON que siga estritamente o esquema fornecido. O idioma de saída deve ser o português do Brasil.`);
    const response = await result.response;
    const plan = JSON.parse(response.text());
    logger.info('Task plan generated successfully', { title: plan.taskTitle });
    return plan;
  } catch (error: any) {
    logger.error('Failed to generate task plan', { error: error.message, query });
    throw new Error('Falha ao gerar o plano de pesquisa. A API pode estar indisponível.');
  }
}

/**
 * Generate mind map from task plan
 */
export async function generateMindMap(plan: TaskPlan): Promise<MindMapData> {
  logger.info('Generating mind map', { title: plan.taskTitle });

  try {
    const genAI = getAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            nodes: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  type: {
                    type: SchemaType.STRING,
                    description: "Opcional, pode ser 'input' para o nó principal."
                  },
                  data: {
                    type: SchemaType.OBJECT,
                    properties: {
                      label: { type: SchemaType.STRING }
                    },
                    required: ['label']
                  },
                  position: {
                    type: SchemaType.OBJECT,
                    properties: {
                      x: { type: SchemaType.NUMBER },
                      y: { type: SchemaType.NUMBER }
                    },
                    required: ['x', 'y']
                  }
                },
                required: ['id', 'data', 'position']
              }
            },
            edges: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  source: { type: SchemaType.STRING },
                  target: { type: SchemaType.STRING },
                  animated: { type: SchemaType.BOOLEAN }
                },
                required: ['id', 'source', 'target']
              }
            }
          },
          required: ['nodes', 'edges']
        }
      }
    });

    const result = await model.generateContent(`Crie uma estrutura de dados de mapa mental para o ReactFlow com base no seguinte plano de pesquisa: ${JSON.stringify(plan.executionPlan)}.
      O nó principal deve ser o título da tarefa: "${plan.taskTitle}".
      Crie nós para cada um dos principais temas nas fases de 'pensamento' e 'pesquisa'.
      Conecte os nós temáticos ao nó principal.
      A saída deve ser um objeto JSON válido com propriedades 'nodes' e 'edges'.
      - Cada nó em 'nodes' deve ter 'id' (string), 'data: { label: string }', e 'position: { x: number, y: number }'.
      - Posicione o nó principal em { x: 250, y: 5 } e distribua os outros nós ao redor dele de forma lógica.
      - Cada aresta em 'edges' deve ter 'id' (ex: 'e1-2'), 'source' (id do nó de origem), e 'target' (id do nó de destino).
      O idioma de saída deve ser o português do Brasil.`);
    const response = await result.response;
    const mindMapData = JSON.parse(response.text());
    logger.info('Mind map generated successfully');
    return mindMapData;
  } catch (error: any) {
    logger.error('Failed to generate mind map, using fallback', {
      error: error.message
    });

    // Fallback mind map
    return {
      nodes: [
        {
          id: '1',
          type: 'input',
          data: { label: plan.taskTitle },
          position: { x: 250, y: 25 }
        },
        { id: '2', data: { label: 'Pesquisa' }, position: { x: 100, y: 125 } },
        { id: '3', data: { label: 'Redação' }, position: { x: 400, y: 125 } }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2', animated: true },
        { id: 'e1-3', source: '1', target: '3', animated: true }
      ]
    };
  }
}

/**
 * Perform research step with enhanced search
 */
export async function performResearchStep(
  step: string,
  originalQuery: string,
  filters: AcademicSearchFilters = {}
): Promise<{ summary: string; sources: AcademicSource[] }> {
  const combinedQuery = `${originalQuery} - ${step}`;
  logger.info('Performing research step', { step, originalQuery });

  try {
    // Search academic databases
    const academicResults = await buscaAcademicaUniversal(combinedQuery, {
      maxResults: 15,
      ...filters
    });

    if (academicResults.length === 0) {
      logger.warn('No academic results found', { step });
      return {
        summary: `Nenhum artigo acadêmico encontrado para: "${step}". A busca continuará com outras fontes.`,
        sources: []
      };
    }

    // Optionally enrich top results with full PDF content
    const enriched = await enrichWithPDFContent(academicResults, 3);

    const sources: AcademicSource[] = enriched.map((res) => ({
      uri: res.link,
      title: res.titulo,
      authors: res.autores,
      year: res.ano,
      summary: res.resumo,
      sourceProvider: res.fonte,
      citationCount: res.citationCount,
      doi: res.doi,
      pdfUrl: res.pdfUrl
    }));

    // Use web scraping for articles with PDFs to save tokens
    const enableScraping = process.env.ENABLE_WEB_SCRAPING === 'true';
    let totalSavings = 0;

    if (enableScraping) {
      for (const source of sources.slice(0, 5)) { // Scrape top 5
        if (source.pdfUrl) {
          const scraped = await scrapeArticle(source.pdfUrl);
          if (scraped) {
            const prepared = prepareForAI(scraped);
            const savings = calculateSavings(scraped.fullText || '', prepared);
            totalSavings += savings.savingsPercent;

            // Update source with scraped data
            source.title = scraped.title;
            source.authors = scraped.authors.join(', ');
            source.summary = scraped.abstract;
            source.sections = scraped.sections;

            logger.info('Article scraped successfully', {
              title: source.title,
              tokenSavings: `${savings.savingsPercent.toFixed(0)}%`
            });
          }
        }
      }

      if (totalSavings > 0) {
        logger.info('Total token savings from scraping', {
          averageSavings: `${(totalSavings / Math.min(5, sources.length)).toFixed(0)}%`
        });
      }
    }

    // Build context from abstracts and sections
    const contexto = sources
      .map((s, idx) => {
        let context = `[${idx + 1}] ${s.title}`;
        if (s.authors) context += `\nAutores: ${s.authors}`;
        if (s.year) context += ` (${s.year})`;
        if (s.citationCount) context += ` | Citações: ${s.citationCount}`;
        if (s.summary) context += `\nResumo: ${s.summary}`;

        // Add section snippets if available
        if (s.sections?.abstract) {
          context += `\nAbstract: ${s.sections.abstract.substring(0, 500)}...`;
        }
        if (s.sections?.conclusion) {
          context += `\nConclusão: ${s.sections.conclusion.substring(0, 300)}...`;
        }

        return context;
      })
      .join('\n\n---\n\n');

    const prompt = `Com base nos artigos acadêmicos abaixo, forneça um resumo analítico e detalhado em português do Brasil sobre o tópico de pesquisa: "${step}" (contexto geral: "${originalQuery}").

O resumo deve:
1. Sintetizar os principais achados e contribuições dos artigos
2. Identificar consensos e divergências entre os autores
3. Destacar metodologias relevantes
4. Apontar lacunas ou oportunidades de pesquisa futura
5. Ser escrito em linguagem acadêmica mas acessível

Artigos:
${contexto}`;

    // Use multi-AI provider instead of direct Gemini call
    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de pesquisa acadêmica especializado em análise crítica de literatura científica.',
      temperature: 0.7,
      maxTokens: 2000
    });

    logger.info('Research step completed', {
      step,
      sourcesFound: sources.length,
      aiProvider: response.provider
    });

    return {
      summary: response.text,
      sources
    };
  } catch (error: any) {
    logger.error('Research step failed', {
      step,
      error: error.message
    });

    return {
      summary: `Falha ao pesquisar: "${step}". A API pode estar temporariamente indisponível.`,
      sources: []
    };
  }
}

/**
 * Generate document outline
 */
export async function generateOutline(
  plan: TaskPlan,
  researchResults: Array<{ query: string; summary: string }>
): Promise<string> {
  logger.info('Generating outline');

  try {
    const researchContext = researchResults
      .map((r) => `Tópico: ${r.query}\nResumo: ${r.summary}`)
      .join('\n\n');

    const prompt = `
    Com base no plano de tarefa e nos resultados da pesquisa abaixo, crie um esboço (outline) detalhado em formato Markdown para o documento final.
    O esboço deve organizar os pontos principais, argumentos e onde as citações podem ser usadas.
    O idioma de saída deve ser o português do Brasil.

    PLANO DA TAREFA:
    - Título: ${plan.taskTitle}
    - Plano de Redação: ${plan.executionPlan.writing.join(', ')}

    RESULTADOS DA PESQUISA:
    ${researchContext}

    Crie o esboço agora em formato Markdown com seções numeradas.
    `;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em estruturação de documentos acadêmicos.',
      temperature: 0.5,
      maxTokens: 1500
    });

    logger.info('Outline generated successfully', { provider: response.provider });
    return response.text;
  } catch (error: any) {
    logger.error('Failed to generate outline', { error: error.message });
    return '## Erro ao Gerar o Esboço\n\nNão foi possível criar o esboço do documento.';
  }
}

/**
 * Generate final content with streaming
 */
export async function* generateContentStream(
  plan: TaskPlan,
  researchResults: Array<{
    query: string;
    summary: string;
    sources: AcademicSource[];
  }>
): AsyncGenerator<string> {
  logger.info('Starting content generation stream');

  try {
    const genAI = getAIClient();

    // Collect all unique sources
    const uniqueSources = [
      ...new Map(
        researchResults.flatMap((r) => r.sources).map((item) => [item.uri, item])
      ).values()
    ];

    if (uniqueSources.length === 0) {
      yield '## Documento Final\n\nNão foram encontradas fontes acadêmicas suficientes.';
      return;
    }

    // Build research context with full metadata
    const researchContext =
      `A pesquisa resultou nas seguintes fontes. Use-as para embasar o texto.\n\n` +
      uniqueSources
        .map((source, index) => {
          const authors = source.authors || 'Autor Desconhecido';
          const year = source.year || new Date().getFullYear();

          let citationText = 'AUTOR, ANO';
          try {
            const authorList = authors.split(',');
            const firstAuthorSurname = (
              authorList[0]?.trim().split(' ').pop() || ''
            ).toUpperCase();

            if (authorList.length > 3) {
              citationText = `${firstAuthorSurname} et al., ${year}`;
            } else if (authorList.length > 1) {
              const lastAuthorSurname = (
                authorList[authorList.length - 1]?.trim().split(' ').pop() || ''
              ).toUpperCase();
              citationText = `${firstAuthorSurname}; ${lastAuthorSurname}, ${year}`;
            } else {
              citationText = `${firstAuthorSurname}, ${year}`;
            }
          } catch (e) {
            citationText = `FONTE ${index + 1}, ${year}`;
          }

          let sourceInfo = `FONTE_${index + 1}:
- Citação no texto (formato ABNT): (${citationText})
- Autores: ${authors}
- Ano: ${year}
- Título: ${source.title}
- URL: ${source.uri}`;

          if (source.citationCount) {
            sourceInfo += `\n- Citações: ${source.citationCount}`;
          }

          if (source.doi) {
            sourceInfo += `\n- DOI: ${source.doi}`;
          }

          // Add key sections if available
          if (source.sections?.abstract) {
            sourceInfo += `\n- Abstract: ${source.sections.abstract.substring(0, 300)}...`;
          }

          if (source.sections?.conclusion) {
            sourceInfo += `\n- Conclusão: ${source.sections.conclusion.substring(0, 300)}...`;
          }

          return sourceInfo;
        })
        .join('\n\n');

    const prompt = `
    Você é um escritor acadêmico especialista, perito em formatação de trabalhos científicos segundo as normas da ABNT.

    PLANO DA TAREFA:
    - Título: ${plan.taskTitle}
    - Descrição: ${JSON.stringify(plan.taskDescription)}

    FONTES DE PESQUISA:
    ${researchContext}

    Escreva um documento acadêmico completo em português do Brasil, seguindo:

    1. **Estrutura ABNT**: Introdução, Desenvolvimento (capítulos numerados), Conclusão
    2. **Citações**: Use [CITE:FONTE_X] seguido de (AUTOR, ANO)
       Exemplo: "...resultados significativos [CITE:FONTE_1] (SILVA et al., 2022)."
    3. **Linguagem**: Formal, impessoal, clara e acadêmica
    4. **Formato**: Markdown com seções numeradas
    5. **Referências**: Seção final com TODAS as fontes em formato ABNT:
       SOBRENOME, N. **Título do artigo**. Disponível em: <URL>. Acesso em: ${new Date().toLocaleDateString('pt-BR')}.

    Comece agora com o título principal.
    `;

    // Use multi-AI provider
    const result = await generateText(prompt, {
      systemPrompt: 'Você é um escritor acadêmico especialista, perito em formatação de trabalhos científicos segundo as normas da ABNT.',
      temperature: 0.7
    });

    yield result.text;

    logger.info('Content generation stream completed');
  } catch (error: any) {
    logger.error('Content generation stream failed', { error: error.message });
    yield '\n\n**Ocorreu um erro ao gerar o documento final.**';
  }
}
