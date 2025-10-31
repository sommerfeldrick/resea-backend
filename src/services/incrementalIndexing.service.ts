/**
 * Serviço de Indexação Incremental
 * Sincroniza novos papers automaticamente sem reindexar tudo
 */

import { hybridSearchService } from './hybridSearch.service.js';
import { FullTextExtractorService } from './fullTextExtractor.service.js';
import { metricsService } from './metrics.service.js';
import { smartCache } from './smartCache.service.js';
import axios from 'axios';

// Instância do extractor
const fullTextExtractor = new FullTextExtractorService();

export interface SyncConfig {
  sources: string[];
  interval: number; // em minutos
  batchSize: number;
  maxPapersPerSync: number;
}

export interface SyncStatus {
  lastSync: Date | null;
  nextSync: Date | null;
  papersIndexed: number;
  totalSyncs: number;
  isRunning: boolean;
  lastError: string | null;
}

export class IncrementalIndexingService {
  private config: SyncConfig;
  private status: SyncStatus;
  private intervalId: NodeJS.Timeout | null = null;
  private lastProcessedIds: Set<string> = new Set();

  constructor() {
    this.config = {
      sources: ['semanticScholar', 'arxiv'],
      interval: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60'), // 1 hora padrão
      batchSize: 50,
      maxPapersPerSync: 500,
    };

    this.status = {
      lastSync: null,
      nextSync: null,
      papersIndexed: 0,
      totalSyncs: 0,
      isRunning: false,
      lastError: null,
    };

    console.log(`📅 Incremental Indexing configurado: sync a cada ${this.config.interval} minutos`);
  }

  /**
   * Inicia o sync automático
   */
  start(): void {
    if (this.intervalId) {
      console.log('⚠️ Sync já está rodando');
      return;
    }

    console.log('🚀 Iniciando Incremental Indexing automático');
    
    // Primeira execução imediata (após 5 segundos)
    setTimeout(() => this.syncNewPapers(), 5000);

    // Execuções periódicas
    this.intervalId = setInterval(
      () => this.syncNewPapers(),
      this.config.interval * 60 * 1000
    );

    this.status.nextSync = new Date(Date.now() + this.config.interval * 60 * 1000);
  }

  /**
   * Para o sync automático
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Incremental Indexing parado');
    }
  }

  /**
   * Sincroniza novos papers de todas as fontes
   */
  async syncNewPapers(): Promise<void> {
    if (this.status.isRunning) {
      console.log('⚠️ Sync já está em execução, pulando...');
      return;
    }

    this.status.isRunning = true;
    this.status.lastError = null;
    const startTime = Date.now();

    console.log('🔄 Iniciando sync de novos papers...');

    try {
      let totalNewPapers = 0;

      // Sync de cada fonte
      for (const source of this.config.sources) {
        console.log(`📥 Buscando novos papers de ${source}...`);
        
        const newPapers = await this.fetchNewPapersFromSource(source);
        console.log(`✅ Encontrados ${newPapers.length} novos papers em ${source}`);

        // Indexa em lotes
        for (let i = 0; i < newPapers.length; i += this.config.batchSize) {
          const batch = newPapers.slice(i, i + this.config.batchSize);
          await this.indexBatch(batch);
          totalNewPapers += batch.length;

          // Pequeno delay entre lotes
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Atualiza status
      this.status.lastSync = new Date();
      this.status.nextSync = new Date(Date.now() + this.config.interval * 60 * 1000);
      this.status.papersIndexed += totalNewPapers;
      this.status.totalSyncs++;

      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Sync completo: ${totalNewPapers} papers indexados em ${duration.toFixed(2)}s`);

      // Registra métricas
      metricsService.indexingTotal.inc({ status: 'success' }, totalNewPapers);
      metricsService.indexingDuration.observe(duration);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = errorMsg;
      console.error('❌ Erro no sync:', errorMsg);
      
      metricsService.indexingTotal.inc({ status: 'error' });
      metricsService.errorsTotal.inc({ type: 'incremental_sync' });
    } finally {
      this.status.isRunning = false;
    }
  }

  /**
   * Busca novos papers de uma fonte específica
   */
  private async fetchNewPapersFromSource(source: string): Promise<any[]> {
    // 🆕 Busca último timestamp de sync do cache
    const lastSyncKey = `last_sync:${source}`;
    const lastSyncTimestamp = await smartCache.get<number>(lastSyncKey);

    const now = new Date();
    const since = lastSyncTimestamp
      ? new Date(lastSyncTimestamp)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: 24h ago

    console.log(`📅 Fetching ${source} papers since ${since.toISOString()}`);

    let papers: any[] = [];

    switch (source) {
      case 'semanticScholar':
        papers = await this.fetchFromSemanticScholar(since);
        break;

      case 'arxiv':
        papers = await this.fetchFromArxiv(since);
        break;

      default:
        console.warn(`⚠️ Fonte desconhecida: ${source}`);
        return [];
    }

    // 🆕 Salva timestamp atual no cache (7 dias de TTL)
    if (papers.length > 0) {
      await smartCache.set(lastSyncKey, now.getTime(), 7 * 24 * 60 * 60);
      console.log(`✅ Saved sync timestamp for ${source}`);
    }

    return papers;
  }

  /**
   * Busca papers recentes do Semantic Scholar
   */
  private async fetchFromSemanticScholar(since: Date): Promise<any[]> {
    try {
      const apiKey = process.env.SEMANTIC_SCHOLAR_KEY;
      const headers = apiKey ? { 'x-api-key': apiKey } : {};

      // Busca papers recentes em áreas relevantes
      const fields = 'paperId,title,abstract,year,citationCount,authors,publicationDate';
      const query = 'computer science OR artificial intelligence';
      
      const response = await axios.get(
        `https://api.semanticscholar.org/graph/v1/paper/search`,
        {
          params: {
            query,
            fields,
            limit: this.config.maxPapersPerSync,
            publicationDateOrYear: `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}:`,
          },
          headers,
          timeout: 30000,
        }
      );

      const papers = response.data.data || [];
      
      // Filtra papers já processados
      return papers.filter((p: any) => !this.lastProcessedIds.has(p.paperId));

    } catch (error) {
      console.error('Erro ao buscar Semantic Scholar:', error);
      return [];
    }
  }

  /**
   * Busca papers recentes do arXiv
   */
  private async fetchFromArxiv(since: Date): Promise<any[]> {
    try {
      const maxResults = Math.min(this.config.maxPapersPerSync, 1000);
      const categories = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'];
      
      const response = await axios.get('http://export.arxiv.org/api/query', {
        params: {
          search_query: `cat:${categories.join(' OR cat:')}`,
          sortBy: 'submittedDate',
          sortOrder: 'descending',
          max_results: maxResults,
        },
        timeout: 30000,
      });

      // Parse XML simples (em produção usar xml2js)
      const papers = this.parseArxivXML(response.data);
      
      // Filtra papers já processados e recentes
      return papers.filter((p: any) => {
        const paperDate = new Date(p.published);
        return paperDate >= since && !this.lastProcessedIds.has(p.id);
      });

    } catch (error) {
      console.error('Erro ao buscar arXiv:', error);
      return [];
    }
  }

  /**
   * Parse simples de XML do arXiv
   */
  private parseArxivXML(xml: string): any[] {
    const papers: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      
      const id = entry.match(/<id>(.*?)<\/id>/)?.[1] || '';
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1]?.trim() || '';
      const summary = entry.match(/<summary>(.*?)<\/summary>/)?.[1]?.trim() || '';
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || '';

      if (id && title) {
        papers.push({
          id,
          title,
          abstract: summary,
          published,
          source: 'arxiv',
        });
      }
    }

    return papers;
  }

  /**
   * Indexa um lote de papers
   */
  private async indexBatch(papers: any[]): Promise<void> {
    console.log(`📦 Indexando lote de ${papers.length} papers...`);

    for (const paper of papers) {
      try {
        // Marca como processado
        this.lastProcessedIds.add(paper.paperId || paper.id);

        // Extrai full text se possível
        let fullPaper = paper;
        try {
          const extracted = await fullTextExtractor.extractFullText(paper.paperId || paper.id);
          if (extracted) {
            fullPaper = { ...paper, fullText: extracted };
          }
        } catch (error) {
          console.warn(`⚠️ Não foi possível extrair texto completo de ${paper.title}`);
        }

        // Indexa no híbrido
        await hybridSearchService.indexPaper(fullPaper);

      } catch (error) {
        console.error(`❌ Erro ao indexar paper ${paper.title}:`, error);
      }
    }

    // Limpa IDs antigos (mantém apenas últimos 10k)
    if (this.lastProcessedIds.size > 10000) {
      const idsArray = Array.from(this.lastProcessedIds);
      this.lastProcessedIds = new Set(idsArray.slice(-10000));
    }
  }

  /**
   * Retorna status atual
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuração atualizada:', this.config);

    // Reinicia se necessário
    if (this.intervalId && newConfig.interval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Force sync manual
   */
  async forceSyncNow(): Promise<void> {
    console.log('🔄 Forçando sync manual...');
    await this.syncNewPapers();
  }
}

// Singleton export
export const incrementalIndexingService = new IncrementalIndexingService();
