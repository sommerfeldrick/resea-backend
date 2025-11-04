import { logger } from '../config/logger.js';
import { buscaAcademicaUniversal, enrichWithPDFContent } from './academicSearchService.js';
import { generateText } from './aiProvider.js';
import { scrapeArticle, prepareForAI, calculateSavings } from './webScraper.js';
import { filterRelevantPapers } from '../utils/relevanceFilter.js';
import type {
  TaskPlan,
  MindMapData,
  AcademicSource,
  AcademicSearchFilters
} from '../types/index.js';

/**
 * Clean JSON response from AI (remove markdown code blocks and thinking tags)
 */
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  // AND remove thinking tags (<think>...</think>) from models like Llama 4 Maverick
  let cleaned = text.trim();

  // Remove <think>...</think> tags (from reasoning models)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

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
    const prompt = `Você é um pesquisador acadêmico experiente. Analise profundamente a consulta "${query}" e crie um plano de pesquisa EXAUSTIVO e de ALTA QUALIDADE.

CRITÉRIOS DE QUALIDADE:
- Pesquisa deve cobrir TODOS os aspectos do tema (histórico, estado atual, aplicações, desafios, tendências futuras)
- Mínimo de 8-10 etapas de pesquisa específicas e detalhadas
- Cada etapa deve focar em um aspecto crítico do tema
- Incluir análise comparativa, estudos de caso, e revisão sistemática
- Considerar perspectivas multidisciplinares quando relevante

Retorne APENAS um objeto JSON válido (sem markdown, sem \`\`\`json) com a seguinte estrutura:
{
  "taskTitle": "título acadêmico preciso e descritivo em português",
  "taskDescription": {
    "type": "tipo de documento (ex: 'revisão sistemática de literatura', 'artigo científico', 'estudo de caso')",
    "style": "acadêmico formal rigoroso com fundamentação teórica sólida",
    "audience": "pesquisadores, acadêmicos, profissionais da área",
    "wordCount": "10000-15000 palavras (pesquisa aprofundada)"
  },
  "executionPlan": {
    "thinking": [
      "Análise epistemológica do tema e delimitação do escopo",
      "Identificação das principais teorias, modelos e frameworks relevantes",
      "Mapeamento das lacunas de conhecimento e questões de pesquisa",
      "Definição de critérios de qualidade e relevância para seleção de fontes",
      "Estabelecimento de metodologia de análise e síntese de informações"
    ],
    "research": [
      "Revisão sistemática da literatura fundamental e clássica (últimas 3 décadas)",
      "Análise detalhada dos avanços recentes e estado da arte (últimos 5 anos)",
      "Investigação de aplicações práticas, estudos de caso e evidências empíricas",
      "Exame crítico de metodologias, técnicas e abordagens existentes",
      "Identificação de desafios, limitações e controvérsias atuais",
      "Análise comparativa de diferentes perspectivas e escolas de pensamento",
      "Prospecção de tendências emergentes e direções futuras de pesquisa",
      "Síntese de implicações práticas, éticas e sociais do tema"
    ],
    "writing": [
      "Estruturação lógica com introdução contextualizada e objetivos claros",
      "Desenvolvimento de fundamentação teórica robusta com citações qualificadas",
      "Apresentação sistemática de evidências, análises e discussões críticas",
      "Síntese integrativa de conhecimentos com análise comparativa",
      "Conclusões fundamentadas com implicações e recomendações para pesquisas futuras",
      "Revisão completa para coerência argumentativa, clareza expositiva e rigor acadêmico"
    ]
  }
}

IMPORTANTE: Adapte as etapas especificamente para o tema "${query}", mantendo profundidade e abrangência.`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de pesquisa especialista. Retorne APENAS JSON válido, sem formatação markdown.',
      temperature: 0.7,
      maxTokens: 4000
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
    const prompt = `Crie um mapa mental COMPLETO E DETALHADO para o ReactFlow baseado no plano de pesquisa: ${JSON.stringify(plan.executionPlan)}.

ESTRUTURA DO MAPA MENTAL:
1. Nó CENTRAL: "${plan.taskTitle}" (posição: x: 400, y: 50)
2. Nós PRINCIPAIS (2º nível) - conectados ao central:
   - Fundamentação Teórica
   - Metodologia de Pesquisa
   - Análise e Discussão
   - Aplicações Práticas
   - Perspectivas Futuras
3. Nós SECUNDÁRIOS (3º nível) - conectados aos principais:
   - Extraia de ${plan.executionPlan.thinking.length} etapas de pensamento
   - Extraia de ${plan.executionPlan.research.length} etapas de pesquisa
   - Crie pelo menos 12-15 nós secundários com conceitos específicos

POSICIONAMENTO INTELIGENTE:
- Nó central: x: 400, y: 50
- Nós principais: distribuir radialmente ao redor do central (raio 200px)
- Nós secundários: distribuir ao redor dos principais (raio 150px)
- Evitar sobreposição de nós (mínimo 120px de distância)
- Criar layout organizado em círculos concêntricos

FORMATO DE RETORNO:
Retorne APENAS um objeto JSON válido (sem markdown, sem \`\`\`json) com:
{
  "nodes": [
    {
      "id": "1",
      "type": "input",
      "data": { "label": "${plan.taskTitle}" },
      "position": { "x": 400, "y": 50 }
    },
    // ... outros nós principais e secundários
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "1",
      "target": "2",
      "animated": true,
      "label": "relaciona-se com"
    },
    // ... outras conexões
  ]
}

IMPORTANTE:
- Mínimo de 15 nós (1 central + 5 principais + 9+ secundários)
- Cada edge deve ter label descrevendo a relação
- Labels dos nós devem ser concisos (máximo 4 palavras)
- Idioma: português do Brasil`;

    const response = await generateText(prompt, {
      systemPrompt: 'Você é um especialista em criar mapas mentais. Retorne APENAS JSON válido, sem formatação markdown.',
      temperature: 0.7,
      maxTokens: 3000
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
    // Search academic databases with extensive results
    const academicResults = await buscaAcademicaUniversal(combinedQuery, {
      maxResults: 60,
      ...filters
    });

    if (academicResults.length === 0) {
      logger.warn('No academic results found', { step });
      return {
        summary: `Nenhum artigo acadêmico encontrado para: "${step}". A busca continuará com outras fontes.`,
        sources: []
      };
    }

    // 🆕 Filtrar papers por relevância (score mínimo: 0.3)
    const relevantPapers = filterRelevantPapers(academicResults, originalQuery, 0.3);

    if (relevantPapers.length === 0) {
      logger.warn('No relevant papers found after filtering', {
        step,
        originalCount: academicResults.length
      });
      return {
        summary: `Nenhum artigo relevante encontrado para: "${originalQuery}". Os ${academicResults.length} papers encontrados não são relacionados ao tema.`,
        sources: []
      };
    }

    logger.info(`Filtered ${academicResults.length} papers → ${relevantPapers.length} relevant`, {
      query: originalQuery,
      filteredOut: academicResults.length - relevantPapers.length
    });

    // Optionally enrich top results with full PDF content
    const enriched = await enrichWithPDFContent(relevantPapers, 3);

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

    const prompt = `Você é um pesquisador acadêmico realizando uma REVISÃO SISTEMÁTICA DE LITERATURA. Analise profundamente os ${sources.length} artigos acadêmicos abaixo sobre: "${step}" (tema geral: "${originalQuery}").

ANÁLISE CRÍTICA REQUERIDA:
1. **Síntese Temática**: Agrupe os achados em temas principais, identificando padrões consistentes
2. **Análise Comparativa**: Compare e contraste diferentes abordagens, metodologias e resultados
3. **Avaliação Crítica**: Analise a qualidade metodológica, limitações e vieses dos estudos
4. **Consensos e Controvérsias**: Identifique áreas de acordo científico e pontos de debate
5. **Lacunas de Conhecimento**: Mapeie o que ainda não foi adequadamente investigado
6. **Implicações Práticas**: Discuta aplicações e relevância dos achados
7. **Tendências Temporais**: Analise a evolução do conhecimento ao longo dos anos
8. **Recomendações**: Sugira direções para pesquisas futuras

FORMATO DE SAÍDA (Markdown estruturado):
## Síntese Temática
[Principais temas e padrões identificados]

## Análise Comparativa
[Comparação entre diferentes abordagens e resultados]

## Avaliação Metodológica
[Análise crítica das metodologias empregadas]

## Consensos Científicos
[Pontos de concordância entre os estudos]

## Controvérsias e Debates
[Áreas de divergência e discussão]

## Lacunas de Pesquisa
[O que ainda precisa ser investigado]

## Implicações Práticas
[Aplicações e relevância dos achados]

## Recomendações para Pesquisas Futuras
[Direções sugeridas para investigação]

CRITÉRIOS:
- Mínimo 800 palavras de análise profunda
- Citar especificamente os autores e anos dos estudos
- Linguagem acadêmica formal e rigorosa
- Fundamentação baseada em evidências
- Pensamento crítico e analítico

ARTIGOS PARA ANÁLISE (${sources.length} fontes):
${contexto}`;

    // Use multi-AI provider instead of direct Gemini call
    const response = await generateText(prompt, {
      systemPrompt: 'Você é um assistente de pesquisa acadêmica especializado em análise crítica de literatura científica.',
      temperature: 0.7,
      maxTokens: 4000
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

    FONTES DE PESQUISA (${uniqueSources.length} papers científicos):
    ${researchContext}

    ⚠️ ATENÇÃO: Você DEVE citar TODAS as fontes acima ao longo do texto usando o formato [CITE:FONTE_X] (AUTOR, ANO).

    Escreva um documento acadêmico completo em português do Brasil, seguindo RIGOROSAMENTE:

    1. **Estrutura ABNT Completa**:
       - Título principal (# Título)
       - Resumo executivo (## Resumo)
       - Introdução (## 1. Introdução)
       - Desenvolvimento com capítulos numerados (## 2. ..., ## 3. ...)
       - Conclusão (## ${uniqueSources.length + 2}. Conclusão)
       - Referências Bibliográficas (## Referências)

    2. **Citações OBRIGATÓRIAS em CADA parágrafo**:
       Formato: "...afirmação científica [CITE:FONTE_1] (SILVA et al., 2022)."

       EXEMPLO CORRETO:
       "A análise de elementos finitos (AEF) tem sido amplamente utilizada na biomecânica oral [CITE:FONTE_1] (YANG et al., 2020). Estudos recentes demonstram sua eficácia na simulação de forças oclusais [CITE:FONTE_2] (FERREIRA; SANTOS, 2021)."

       ❌ INCORRETO (sem citações): "A análise de elementos finitos é importante na odontologia."
       ✅ CORRETO (com citações): "A análise de elementos finitos é importante na odontologia [CITE:FONTE_1] (YANG et al., 2020)."

    3. **Linguagem Acadêmica**:
       - Tom formal e impessoal
       - Verbos no presente do indicativo ou pretérito perfeito
       - Evite opinião pessoal, use "observa-se que", "verificou-se que"

    4. **Formato Markdown**:
       - Títulos com ## (h2) e ### (h3)
       - Parágrafos com quebras de linha duplas
       - Negrito em termos técnicos importantes

    5. **Seção de Referências COMPLETA**:
       Liste TODAS as ${uniqueSources.length} fontes em formato ABNT:

       SOBRENOME, Prenome. **Título do artigo**. _Nome da revista_, v. X, n. Y, p. Z-W, ano. Disponível em: <URL>. Acesso em: ${new Date().toLocaleDateString('pt-BR')}.

    6. **Tamanho Mínimo**: ${plan.taskDescription.wordCount || '3000-5000 palavras'}

    COMECE AGORA COM O DOCUMENTO COMPLETO. NÃO ESQUEÇA DE CITAR CADA FONTE!
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
