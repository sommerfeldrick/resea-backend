/**
 * Serviço de Query Expansion
 * Expande queries curtas para melhorar recall
 */

import axios from 'axios';

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  synonyms: string[];
  relatedTerms: string[];
}

export class QueryExpansionService {
  private ollamaUrl: string;
  private ollamaApiKey: string;
  private model: string;
  private cache: Map<string, ExpandedQuery> = new Map();
  private maxCacheSize: number = 500;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'https://api.ollama.com';
    this.ollamaApiKey = process.env.OLLAMA_API_KEY || '';
    this.model = process.env.RERANKER_MODEL || 'llama3.2';

    console.log('🔍 Query Expansion Service inicializado');
  }

  /**
   * Expande uma query curta
   */
  async expandQuery(query: string): Promise<ExpandedQuery> {
    // Verifica cache
    if (this.cache.has(query)) {
      return this.cache.get(query)!;
    }

    try {
      // Se query é muito longa (>50 palavras), não expande
      const wordCount = query.split(/\s+/).length;
      if (wordCount > 50) {
        return {
          original: query,
          expanded: [query],
          synonyms: [],
          relatedTerms: [],
        };
      }

      console.log(`🔄 Expandindo query: "${query}"`);

      // Usa LLM para expansão semântica
      const expandedTerms = await this.llmExpansion(query);

      // Adiciona sinônimos simples (fallback)
      const synonyms = this.getSimpleSynonyms(query);

      const result: ExpandedQuery = {
        original: query,
        expanded: [query, ...expandedTerms],
        synonyms,
        relatedTerms: expandedTerms,
      };

      // Salva no cache
      this.addToCache(query, result);

      return result;

    } catch (error) {
      console.error('Erro ao expandir query:', error);
      // Fallback: retorna apenas a query original
      return {
        original: query,
        expanded: [query],
        synonyms: [],
        relatedTerms: [],
      };
    }
  }

  /**
   * Expansão usando LLM (Ollama)
   */
  private async llmExpansion(query: string): Promise<string[]> {
    try {
      const prompt = `Given the search query: "${query}"

Generate 5 semantically related search terms that would help find relevant academic papers. Include:
- Synonyms
- Related concepts
- Common variations
- Technical terms

Output only the terms, one per line, without numbers or explanations.`;

      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 100,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.ollamaApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const text = response.data.response || '';
      
      // Parse resposta
      const terms = text
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && line.length < 100)
        .map((line: string) => line.replace(/^[-*•\d.]+\s*/, '')) // Remove bullets/números
        .slice(0, 5);

      return terms;

    } catch (error) {
      console.warn('LLM expansion falhou, usando fallback');
      return [];
    }
  }

  /**
   * Sinônimos simples baseados em regras (fallback)
   */
  private getSimpleSynonyms(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const synonymMap: { [key: string]: string[] } = {
      // IA e ML
      'ai': ['artificial intelligence', 'machine intelligence'],
      'artificial intelligence': ['ai', 'machine intelligence'],
      'ml': ['machine learning', 'statistical learning'],
      'machine learning': ['ml', 'statistical learning', 'deep learning'],
      'deep learning': ['neural networks', 'dl', 'machine learning'],
      'neural networks': ['deep learning', 'artificial neural networks', 'ann'],
      
      // NLP
      'nlp': ['natural language processing', 'text processing'],
      'natural language processing': ['nlp', 'text mining'],
      
      // Visão Computacional
      'cv': ['computer vision', 'image processing'],
      'computer vision': ['cv', 'image recognition', 'visual recognition'],
      
      // Português ↔ Inglês
      'aprendizado de máquina': ['machine learning', 'ml'],
      'inteligência artificial': ['artificial intelligence', 'ai'],
      'redes neurais': ['neural networks', 'deep learning'],
      'processamento de linguagem natural': ['natural language processing', 'nlp'],
      
      // Domínios
      'education': ['learning', 'teaching', 'pedagogy', 'educação'],
      'educação': ['education', 'ensino', 'aprendizagem'],
      'health': ['healthcare', 'medicine', 'medical', 'saúde'],
      'saúde': ['health', 'healthcare', 'medicina'],
    };

    const synonyms: string[] = [];
    
    for (const [key, values] of Object.entries(synonymMap)) {
      if (lowerQuery.includes(key)) {
        synonyms.push(...values);
      }
    }

    return [...new Set(synonyms)]; // Remove duplicatas
  }

  /**
   * Gera múltiplas variações de uma query
   */
  async generateQueryVariations(query: string): Promise<string[]> {
    const expanded = await this.expandQuery(query);
    const variations: string[] = [query];

    // Adiciona termos expandidos
    variations.push(...expanded.expanded);

    // Adiciona combinações com sinônimos
    for (const synonym of expanded.synonyms.slice(0, 3)) {
      variations.push(`${query} ${synonym}`);
    }

    // Remove duplicatas e limita
    return [...new Set(variations)].slice(0, 10);
  }

  /**
   * Adiciona ao cache
   */
  private addToCache(query: string, result: ExpandedQuery): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove primeira entrada (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(query, result);
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Estatísticas
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      hitRate: this.cache.size / this.maxCacheSize,
    };
  }
}

// Singleton export
export const queryExpansionService = new QueryExpansionService();
