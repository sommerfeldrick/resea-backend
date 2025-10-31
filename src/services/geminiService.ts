import { logger } from '../config/logger.js';
import { buscaAcademicaUniversal, enrichWithPDFContent } from './academicSearchService.js';
import { generateText } from './aiProvider.js';
import { scrapeArticle, prepareForAI, calculateSavings } from './webScraper.js';
import type {
  TaskPlan,
  MindMapData,
  AcademicSource,
  AcademicSearchFilters
} from '../types/index.js';

/**
 * Clean JSON response from AI (remove markdown code blocks)
 */
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  let cleaned = text.trim();

  // Remove ```json at the start
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  // Remove ``` at the end
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Generate task plan from user query
 */
export async function generateTaskPlan(query: string): Promise<TaskPlan> {
  logger.info('Generating task plan', { query });

  try {
    const prompt = `Com base na consulta do usuário "${query}", crie um plano detalhado de pesquisa e redação. A pesquisa deve ser profunda e o estilo de escrita deve ser humanizado, evitando jargões excessivos para ser claro e envolvente.

Retorne APENAS um objeto JSON válido (sem markdown, sem \`\`\`json) com a seguinte estrutura:
{
  "taskTitle": "título conciso em português",
  "taskDescription": {
    "type": "tipo de documento (ex: 'revisão de literatura acadêmica')",
    "style": "estilo de escrita (ex: 'acadêmico formal humanizado')",
    "audience": "público-alvo",
    "wordCount": "contagem estimada (ex: '8000-12000 palavras')"
  },
  "executionPlan": {
    "thinking": ["etapa 1 de pensamento", "etapa 2...", "..."],
    "research": ["etapa 1 de pesquisa", "etapa 2...", "..."],
    "writing": ["etapa 1 de redação", "etapa 2...", "..."]
  }
}`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de pesquisa especialista. Retorne APENAS JSON válido, sem formatação markdown.',
      temperature: 0.7,
      maxTokens: 2000
    });

    const cleanedText = cleanJsonResponse(response.text);
    const plan = JSON.parse(cleanedText);
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
    const prompt = `Crie uma estrutura de dados de mapa mental para o ReactFlow com base no seguinte plano de pesquisa: ${JSON.stringify(plan.executionPlan)}.

O nó principal deve ser o título da tarefa: "${plan.taskTitle}".
Crie nós para cada um dos principais temas nas fases de 'pensamento' e 'pesquisa'.
Conecte os nós temáticos ao nó principal.

Retorne APENAS um objeto JSON válido (sem markdown, sem \`\`\`json) com propriedades 'nodes' e 'edges':
- Cada nó em 'nodes' deve ter 'id' (string), 'data: { label: string }', e 'position: { x: number, y: number }'.
- Posicione o nó principal em { x: 250, y: 5 } e distribua os outros nós ao redor dele de forma lógica.
- Cada aresta em 'edges' deve ter 'id' (ex: 'e1-2'), 'source' (id do nó de origem), e 'target' (id do nó de destino).
O idioma deve ser português do Brasil.`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em criar mapas mentais. Retorne APENAS JSON válido, sem formatação markdown.',
      temperature: 0.7,
      maxTokens: 1500
    });

    const cleanedText = cleanJsonResponse(response.text);
    const mindMapData = JSON.parse(cleanedText);
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
      uri: res.url,
      title: res.title,
      authors: res.authors.join(', '),
      year: res.year,
      summary: res.abstract || '',
      sourceProvider: res.source,
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
