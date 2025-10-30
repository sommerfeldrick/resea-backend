import { GoogleGenAI, Type } from "@google/genai";
import type { TaskPlan, MindMapData, ResearchResult, AcademicSource } from '../types';

// ============================================================
// 1. New Academic Search Engine
// ============================================================

interface AcademicAPIResult {
  fonte: string;
  titulo: string;
  autores?: string;
  ano?: string | number;
  resumo?: string;
  link: string;
}

function extrairPalavrasChave(texto: string, maxPalavras = 5): string[] {
  const ignorar = ["de","da","do","em","para","com","que","e","a","o","as","os","por","um","uma","na","no"];
  const palavras = texto.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  const freq: { [key: string]: number } = {};
  for (const p of palavras) {
    if (p.length > 3 && !ignorar.includes(p)) freq[p] = (freq[p] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a,b) => b[1] - a[1])
    .slice(0, maxPalavras)
    .map(([p]) => p);
}

// === Semantic Scholar ===
async function buscarSemanticScholar(palavras: string[]): Promise<AcademicAPIResult[]> {
  try {
    const query = palavras.join(" ");
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,authors,url,abstract,year`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map((d: any) => ({
      fonte: "Semantic Scholar",
      titulo: d.title,
      autores: d.authors?.map((a: any) => a.name).join(", "),
      ano: d.year,
      resumo: d.abstract,
      link: d.url
    }));
  } catch { return []; }
}

// === CrossRef ===
async function buscarCrossref(palavras: string[]): Promise<AcademicAPIResult[]> {
  try {
    const query = palavras.join("+");
    const url = `https://api.crossref.org/works?query=${query}&rows=3`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const items = json.message?.items || [];
    return items.map((i: any) => ({
      fonte: "CrossRef",
      titulo: i.title?.[0],
      autores: i.author
        ? i.author.map((a: any) => `${a.given || ""} ${a.family || ""}`).join(", ")
        : "",
      ano: i.created?.["date-parts"]?.[0]?.[0],
      link: i.URL,
      doi: i.DOI
    }));
  } catch { return []; }
}

// === OpenAlex ===
async function buscarOpenAlex(palavras: string[]): Promise<AcademicAPIResult[]> {
  try {
    const query = palavras.join("+");
    const url = `https://api.openalex.org/works?search=${query}&per-page=3`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      fonte: "OpenAlex",
      titulo: r.display_name,
      autores: r.authorships?.map((a: any) => a.author.display_name).join(", "),
      ano: r.publication_year,
      link: r.id,
      doi: r.doi
    }));
  } catch { return []; }
}

// === PubMed ===
async function buscarPubMed(palavras: string[]): Promise<AcademicAPIResult[]> {
  try {
    const termo = palavras.join("+");
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&term=${termo}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchJson = await searchRes.json();
    const ids = searchJson.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];
    const fetchJson = await fetchRes.json();
    const artigos = Object.values(fetchJson.result).filter((a: any) => a.uid);
    return artigos.map((a: any) => ({
      fonte: "PubMed",
      titulo: a.title,
      autores: a.authors?.map((x: any) => x.name).join(", "),
      ano: a.pubdate?.substring(0, 4),
      link: `https://pubmed.ncbi.nlm.nih.gov/${a.uid}/`
    }));
  } catch { return []; }
}

async function buscaAcademicaUniversal(texto: string): Promise<AcademicAPIResult[]> {
  const palavras = extrairPalavrasChave(texto);
  console.log("🔍 Palavras-chave detectadas:", palavras);

  const fontes = [
    buscarSemanticScholar,
    buscarCrossref,
    buscarOpenAlex,
    buscarPubMed
  ];
  
  let todosResultados: AcademicAPIResult[] = [];
  const promessas = fontes.map(buscar => buscar(palavras));
  const resultadosPorFonte = await Promise.all(promessas);

  for (const resultados of resultadosPorFonte) {
    if (resultados.length) {
      console.log(`✅ Resultados encontrados via ${resultados[0].fonte}`);
      todosResultados.push(...resultados);
    }
  }

  // Remove duplicates based on title, favoring more complete entries
  const unicos = [...new Map(todosResultados.map(item => [item.titulo, item])).values()];

  if (unicos.length > 0) {
    return unicos;
  }

  console.log("⚠️ Nenhum resultado encontrado nas APIs acadêmicas.");
  return [];
}


// ============================================================
// 2. Gemini API Services
// ============================================================

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTaskPlan = async (query: string): Promise<TaskPlan> => {
  console.log("Generating task plan for:", query);
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: `Você é um assistente de pesquisa especialista. Com base na consulta do usuário "${query}", crie um plano detalhado de pesquisa e redação. A pesquisa deve ser profunda e o estilo de escrita deve ser humanizado, evitando jargões excessivos para ser claro e envolvente. A saída deve ser um objeto JSON que siga estritamente o esquema fornecido. O idioma de saída deve ser o português do Brasil.`,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
              taskTitle: { type: Type.STRING, description: "Um título conciso para a tarefa de pesquisa em português." },
              taskDescription: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "O tipo de documento a ser produzido (ex: 'revisão de literatura acadêmica')." },
                  style: { type: Type.STRING, description: "O estilo de escrita (ex: 'acadêmico formal humanizado')." },
                  audience: { type: Type.STRING, description: "O público-alvo do documento." },
                  wordCount: { type: Type.STRING, description: "A contagem de palavras estimada (ex: '8000-12000 palavras')." },
                },
                required: ["type", "style", "audience", "wordCount"]
              },
              executionPlan: {
                type: Type.OBJECT,
                properties: {
                  thinking: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma lista de etapas de 'pensamento' para estruturar o trabalho." },
                  research: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma lista de etapas de pesquisa acionáveis." },
                  writing: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma lista de etapas de redação para montar o documento." },
                },
                required: ["thinking", "research", "writing"]
              }
            },
            required: ["taskTitle", "taskDescription", "executionPlan"]
          },
       },
    });
    
    const plan = JSON.parse(response.text);
    return plan;
  } catch (error) {
    console.error("Error generating task plan:", error);
    throw new Error("Falha ao gerar o plano de pesquisa. A API pode estar indisponível ou a consulta pode ser inválida.");
  }
};

export const generateMindMap = async (plan: TaskPlan): Promise<MindMapData> => {
    console.log("Generating mind map for:", plan.taskTitle);
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Crie uma estrutura de dados de mapa mental para o ReactFlow com base no seguinte plano de pesquisa: ${JSON.stringify(plan.executionPlan)}.
            O nó principal deve ser o título da tarefa: "${plan.taskTitle}".
            Crie nós para cada um dos principais temas nas fases de 'pensamento' e 'pesquisa'.
            Conecte os nós temáticos ao nó principal.
            A saída deve ser um objeto JSON válido com propriedades 'nodes' e 'edges'.
            - Cada nó em 'nodes' deve ter 'id' (string), 'data: { label: string }', e 'position: { x: number, y: number }'.
            - Posicione o nó principal em { x: 250, y: 5 } e distribua os outros nós ao redor dele de forma lógica.
            - Cada aresta em 'edges' deve ter 'id' (ex: 'e1-2'), 'source' (id do nó de origem), e 'target' (id do nó de destino).
            O idioma de saída deve ser o português do Brasil.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    type: { type: Type.STRING, description: "Opcional, pode ser 'input' para o nó principal." },
                                    data: {
                                        type: Type.OBJECT,
                                        properties: {
                                            label: { type: Type.STRING }
                                        },
                                        required: ["label"]
                                    },
                                    position: {
                                        type: Type.OBJECT,
                                        properties: {
                                            x: { type: Type.NUMBER },
                                            y: { type: Type.NUMBER }
                                        },
                                        required: ["x", "y"]
                                    }
                                },
                                required: ["id", "data", "position"]
                            }
                        },
                        edges: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    source: { type: Type.STRING },
                                    target: { type: Type.STRING },
                                    animated: { type: Type.BOOLEAN }
                                },
                                required: ["id", "source", "target"]
                            }
                        }
                    },
                    required: ["nodes", "edges"]
                }
            }
        });

        const mindMapData = JSON.parse(response.text);
        return mindMapData;
    } catch (error) {
         console.error("Error generating mind map, falling back to mock:", error);
         return {
            nodes: [
                { id: '1', type: 'input', data: { label: plan.taskTitle }, position: { x: 250, y: 25 } },
                { id: '2', data: { label: 'Pesquisa' }, position: { x: 100, y: 125 } },
                { id: '3', data: { label: 'Redação' }, position: { x: 400, y: 125 } }
            ],
            edges: [
                { id: 'e1-2', source: '1', target: '2', animated: true },
                { id: 'e1-3', source: '1', 'target': '3', animated: true }
            ],
       }
    }
}

export const performResearchStep = async (step: string, originalQuery: string): Promise<{ summary: string; sources: AcademicSource[] }> => {
    const combinedQuery = `${originalQuery} - ${step}`;
    console.log("Performing academic research for:", combinedQuery);
    try {
        const academicResults = await buscaAcademicaUniversal(combinedQuery);

        if (academicResults.length === 0) {
            return {
                summary: `Nenhum artigo acadêmico encontrado para: "${step}". A busca continuará com outras fontes.`,
                sources: []
            };
        }
        
        const sources: AcademicSource[] = academicResults.map(res => ({
            uri: res.link,
            title: res.titulo,
            authors: res.autores,
            year: res.ano,
            summary: res.resumo,
            sourceProvider: res.fonte,
        }));

        const ai = getAIClient();
        const abstractsContext = sources
            .filter(s => s.summary)
            .map(s => `Título: ${s.title}\nResumo: ${s.summary}`)
            .join('\n\n---\n\n');

        if (!abstractsContext) {
             return {
                summary: `Foram encontrados ${sources.length} artigos, mas sem resumos disponíveis para análise automática.`,
                sources: sources
            };
        }

        const prompt = `Com base nos resumos de artigos acadêmicos abaixo, forneça um resumo conciso e informativo em português do Brasil sobre o tópico de pesquisa: "${step}" (contexto geral: "${originalQuery}")\n\nResumos:\n${abstractsContext}`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return {
            summary: response.text,
            sources: sources
        };

    } catch (error) {
        console.error("Error performing academic research step:", error);
        return {
            summary: `Falha ao pesquisar: "${step}". A API pode estar temporariamente indisponível.`,
            sources: []
        };
    }
};

export const generateOutline = async (plan: TaskPlan, researchResults: ResearchResult[]): Promise<string> => {
    console.log("Generating outline...");
    try {
        const ai = getAIClient();
        const researchContext = researchResults.map(r => `Tópico: ${r.query}\nResumo: ${r.summary}`).join('\n\n');
        const prompt = `
        Com base no plano de tarefa e nos resultados da pesquisa abaixo, crie um esboço (outline) detalhado em formato Markdown para o documento final.
        O esboço deve organizar os pontos principais, argumentos e onde as citações podem ser usadas.
        O idioma de saída deve ser o português do Brasil.

        PLANO DA TAREFA:
        - Título: ${plan.taskTitle}
        - Plano de Redação: ${plan.executionPlan.writing.join(', ')}

        RESULTADOS DA PESQUISA:
        ${researchContext}

        Crie o esboço agora.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating outline:", error);
        return "## Erro ao Gerar o Esboço\n\nNão foi possível criar o esboço do documento. Por favor, verifique os resultados da pesquisa e tente novamente.";
    }
};

export async function* generateContentStream(plan: TaskPlan, researchResults: ResearchResult[]): AsyncGenerator<string> {
    console.log("Generating final content...");
    try {
        const ai = getAIClient();
        
        const uniqueSources = [...new Map(researchResults.flatMap(r => r.sources).map(item => [item.uri, item])).values()];

        if (uniqueSources.length === 0) {
            yield "## Documento Final\n\nNão foram encontradas fontes acadêmicas suficientes para gerar o documento. Por favor, tente uma nova pesquisa com termos diferentes.";
            return;
        }

        const researchContext = `A pesquisa resultou nas seguintes fontes. Use-as para embasar o texto e para a seção de Referências.\n\n` + 
            uniqueSources.map((source, index) => {
                const authors = source.authors || 'Autor Desconhecido';
                const year = source.year || new Date().getFullYear();
                
                let citationText = 'AUTOR, ANO';
                try {
                    const authorList = authors.split(',');
                    const firstAuthorSurname = (authorList[0].trim().split(' ').pop() || '').toUpperCase();
                    if (authorList.length > 3) {
                         citationText = `${firstAuthorSurname} et al., ${year}`;
                    } else if (authorList.length > 1) {
                        const lastAuthorSurname = (authorList[authorList.length - 1].trim().split(' ').pop() || '').toUpperCase();
                        citationText = `${firstAuthorSurname}; ${lastAuthorSurname}, ${year}`;
                    } else {
                        citationText = `${firstAuthorSurname}, ${year}`;
                    }
                } catch(e) {
                     citationText = `FONTE ${index+1}, ${year}`
                }

                return `FONTE_${index + 1}:
- Citação no texto (formato ABNT): (${citationText})
- Autores: ${authors}
- Ano: ${year}
- Título: ${source.title}
- URL: ${source.uri}`;
            }).join('\n\n');

        const prompt = `
        Você é um escritor acadêmico especialista, perito em formatação de trabalhos científicos segundo as normas da ABNT (Associação Brasileira de Normas Técnicas). Sua tarefa é escrever um documento abrangente em português do Brasil, em formato Markdown, que siga a estrutura de um Trabalho de Conclusão de Curso (TCC).

        PLANO DA TAREFA:
        - Título: ${plan.taskTitle}
        - Descrição: ${JSON.stringify(plan.taskDescription)}

        FONTES DE PESQUISA DISPONÍVEIS:
        ${researchContext}

        Com base estritamente no plano e nas fontes de pesquisa fornecidas, escreva o documento final completo, seguindo as diretrizes abaixo:

        1.  **Estrutura ABNT**: Organize o conteúdo em seções: Introdução, Desenvolvimento (dividido em capítulos com títulos numerados, ex: 2. NOME DO CAPÍTULO), e Conclusão.
        2.  **Citações no Texto**: Ao usar informações de uma fonte, você **DEVE** incluir uma referência no formato [CITE:FONTE_X], onde X é o número da fonte, seguido da citação ABNT entre parênteses. Exemplo: ...a pesquisa mostra resultados significativos [CITE:FONTE_1] (SILVA et al., 2022). O marcador [CITE:FONTE_X] é para processamento e não deve aparecer no texto final, mas é obrigatório no seu output.
        3.  **Linguagem Formal e Humanizada**: Utilize uma linguagem acadêmica, formal, impessoal e fluida, apropriada para um TCC, mas que seja clara e de fácil compreensão.
        4.  **Formatação Markdown**: Use Markdown para estruturar o documento (ex: # Título Principal, ## 1. Introdução, ### 2.1. Sub-seção).
        5.  **Seção de Referências**: Ao final do documento, crie uma seção "## Referências". Liste **TODAS** as fontes da seção "FONTES DE PESQUISA DISPONÍVEIS", formatadas no padrão ABNT. Exemplo:
            SOBRENOME, N. **Título do artigo**. Disponível em: <URL>. Acesso em: ${new Date().toLocaleDateString('pt-BR')}.

        Comece com o título principal do trabalho.
        `;

        const response = await ai.models.generateContentStream({
           model: "gemini-2.5-pro",
           contents: prompt,
        });

        for await (const chunk of response) {
          yield chunk.text;
        }
    } catch (error) {
        console.error("Error generating content stream:", error);
        yield "\n\n**Ocorreu um erro ao gerar o documento final. Por favor, tente novamente.**";
    }
}