import VectorSearchService from './vectorSearch.service';
import NLPService from './nlp.service';
import SmartCache from './smartCache.service';
import { generateText, AIProvider } from './aiIntegration';

interface PaperSearchOptions {
  query: string;
  topK?: number;
  useCache?: boolean;
  aiEnhancement?: boolean;
  provider?: AIProvider;
}

interface EnrichedPaper {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  entities: any[];
  sentiment: number;
  summary: string;
  relevanceScore: number;
  aiInsights?: string;
}

class AcademicSearchOptimized {
  private vectorSearch: VectorSearchService;
  private nlpService: NLPService;
  private smartCache: SmartCache;

  constructor(vectorSearch: VectorSearchService, nlpService: NLPService, smartCache: SmartCache) {
    this.vectorSearch = vectorSearch;
    this.nlpService = nlpService;
    this.smartCache = smartCache;
  }

  async searchPapers(options: PaperSearchOptions): Promise<EnrichedPaper[]> {
    const { query, topK = 10, useCache = true, aiEnhancement = true, provider } = options;
    try {
      const cacheKey = `search:${query}:${topK}`;
      if (useCache) {
        const cachedResults = await this.smartCache.getRedisCache(cacheKey);
        if (cachedResults) return cachedResults;
      }
      const vectorResults = await this.vectorSearch.search(query, topK);
      const enrichedResults: EnrichedPaper[] = await Promise.all(
        vectorResults.map(async (paper: any) => {
          const entities = await this.nlpService.extractEntities(paper.abstract || paper.title);
          const sentiment = this.nlpService.analyzeSentiment(paper.abstract || '');
          const keywords = this.nlpService.extractKeywords(paper.abstract || paper.title);
          const summary = await this.nlpService.summarizeText(paper.abstract || paper.title);
          return {
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            keywords,
            entities,
            sentiment,
            summary,
            relevanceScore: paper.score || 0,
          };
        })
      );

      let finalResults = enrichedResults;
      if (aiEnhancement) {
        finalResults = await this.enhanceWithAI(enrichedResults, query, provider);
      }

      if (useCache) {
        const ttl = this.smartCache.calculateTTL(finalResults);
        await this.smartCache.setRedisCache(cacheKey, finalResults, ttl);
      }

      return finalResults;
    } catch (error) {
      throw error;
    }
  }

  private async enhanceWithAI(papers: EnrichedPaper[], query: string, provider?: AIProvider): Promise<EnrichedPaper[]> {
    try {
      const paperSummaries = papers.map(p => `- ${p.title}: ${p.summary}`).join('\n');
      const aiPrompt = `Analyze these academic papers in relation to the query "${query}": ${paperSummaries}`;
      const aiResponse = await generateText(aiPrompt, { temperature: 0.7, maxTokens: 2000, provider });
      const insightLines = aiResponse.content.split('\n');
      return papers.map((paper, index) => ({ ...paper, aiInsights: insightLines[index] || aiResponse.content }));
    } catch (error) {
      return papers;
    }
  }

  async indexNewPaper(paperId: string, paperContent: string): Promise<void> {
    try {
      await this.vectorSearch.indexPaper(paperId, paperContent);
      const entities = await this.nlpService.extractEntities(paperContent);
      const keywords = await this.nlpService.extractKeywords(paperContent);
      const nlpCacheKey = `nlp:${paperId}`;
      await this.smartCache.setRedisCache(nlpCacheKey, { entities, keywords }, 2592000);
    } catch (error) {
      throw error;
    }
  }

  async analyzePaperBatch(paperIds: string[], paperContents: string[]): Promise<void> {
    try {
      for (let i = 0; i < paperIds.length; i++) {
        await this.indexNewPaper(paperIds[i], paperContents[i]);
      }
    } catch (error) {
      throw error;
    }
  }

  async getCachedResults(query: string): Promise<EnrichedPaper[] | null> {
    const cacheKey = `search:${query}:10`;
    return this.smartCache.getRedisCache(cacheKey);
  }
}

export default AcademicSearchOptimized;