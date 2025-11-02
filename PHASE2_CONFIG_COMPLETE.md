# ✅ Fase 2 Completa: Sistema de Configuração

## 📋 O Que Foi Implementado

Criamos **configuração centralizada** para todo o sistema em `src/config/` com **1.454 linhas** de código:

### 1. **constants.ts** (470 linhas)

#### Quality Scoring System
```typescript
// Thresholds
QUALITY_THRESHOLDS = {
  P1_MIN: 75,  // Excellent
  P2_MIN: 50,  // Good
  P3_MIN: 30,  // Acceptable
}

// Weights (total = 100 points)
QUALITY_WEIGHTS = {
  hasFullText: 25,
  hasStructuredData: 15,
  isOpenAccess: 20,
  citationCount: 15,
  hasAbstract: 10,
  hasReferences: 10,
  yearRecency: 5,
}

// Helpers
getPriority(85) → 'P1'
getCitationScore(150) → 15  // Max score
getYearRecencyBonus(2024) → 5  // Current year bonus
```

#### Search Configuration
```typescript
// Phase-based config
PHASE_CONFIG = {
  P1: { minResults: 20, timeout: 5000, minQualityScore: 75 },
  P2: { minResults: 30, timeout: 8000, minQualityScore: 50 },
  P3: { minResults: 50, timeout: 10000, minQualityScore: 30 },
}

// Limits
SEARCH_LIMITS = {
  DEFAULT_MAX_RESULTS: 100,
  DEFAULT_TIMEOUT: 30000,
  MAX_PARALLEL_APIS: 13,
  MAX_ENRICHMENT_PAPERS: 5,
}

// Relevance
RELEVANCE_CONFIG = {
  MIN_SIMILARITY: 0.3,
  TITLE_WEIGHT: 0.4,
  ABSTRACT_WEIGHT: 0.6,
}
```

#### Content Parsing
```typescript
// Chunking for RAG
CHUNKING_CONFIG = {
  MIN_CHUNK_SIZE: 50,
  MAX_CHUNK_SIZE: 500,
  TARGET_CHUNK_SIZE: 200,
  OVERLAP_SIZE: 50,
  INCLUDE_CONTEXT: true,
}

// Format priorities
FORMAT_PRIORITIES = {
  jats: 10,    // Best
  tei: 9,
  latex: 8,
  json: 7,
  html: 6,
  pdf: 3,
  plain: 1,    // Worst
}

// Section detection
SECTION_PATTERNS = {
  abstract: /(?:abstract|resumo|resumen)/i,
  introduction: /(?:introduction|introdução|background)/i,
  methods: /(?:methods?|methodology|métodos)/i,
  // ... etc
}
```

#### Cache & Embeddings
```typescript
// Cache TTLs
CACHE_TTL = {
  SEARCH_RESULTS: 3600000,   // 1 hour
  EMBEDDINGS: Infinity,      // Never expire
  PDF_CONTENT: 86400000,     // 24 hours
  USER_FAVORITES: Infinity,  // Persistent
}

// Embeddings
EMBEDDINGS_CONFIG = {
  MODEL: 'nomic-embed-text',
  DIMENSION: 768,
  MAX_TEXT_LENGTH: 2048,
  BATCH_SIZE: 10,
  ENABLE_COMPRESSION: true,  // ~60% savings
}

// Similarity
SIMILARITY_THRESHOLDS = {
  VERY_SIMILAR: 0.85,
  SIMILAR: 0.70,
  SOMEWHAT_SIMILAR: 0.50,
  BARELY_SIMILAR: 0.30,
}
```

---

### 2. **apis.config.ts** (970 linhas)

#### Interface APIConfig
```typescript
interface APIConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;        // 1-10
  phase: 'P1' | 'P2' | 'P3';

  rateLimit: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  auth: {
    required: boolean;
    type?: 'apiKey' | 'bearer' | 'basic' | 'none';
    envVar?: string;
  };

  endpoints: {
    search: string;
    article?: string;
    metadata?: string;
  };

  capabilities: {
    fullText: boolean;
    structuredData: boolean;
    openAccess: boolean;
    citations: boolean;
    abstracts: boolean;
    references: boolean;
  };

  coverage: {
    count: string;
    areas: string[];
    updateFrequency: string;
  };

  request: {
    timeout: number;
    maxResults: number;
    defaultFields?: string[];
  };
}
```

#### Todas as 13 APIs Configuradas

**P1 - Priority 9-10 (Excellent):**
```typescript
API_CONFIGS.openalex = {
  name: 'openalex',
  baseUrl: 'https://api.openalex.org',
  priority: 10,
  phase: 'P1',
  rateLimit: { requestsPerSecond: 10 },
  auth: { required: false },
  capabilities: {
    fullText: false,
    structuredData: true,
    openAccess: true,
    citations: true,
  },
  coverage: {
    count: '240M works',
    areas: ['multidisciplinary'],
  },
}

// + semanticScholar (priority 9)
// + pubmed (priority 9)
```

**P2 - Priority 7-8 (Good):**
```typescript
// + core (priority 8) - 139M OA
// + europepmc (priority 8) - 8.1M full-text
// + arxiv (priority 7) - 2.4M preprints
// + doaj (priority 7) - 11M OA journals
```

**P3 - Priority 4-6 (Acceptable):**
```typescript
// + plos (priority 6) - 300K OA
// + biorxiv (priority 6) - 200K+ preprints
// + medrxiv (priority 6) - 100K+ preprints
// + openaire (priority 5) - 150M EU research
// + datacite (priority 4) - 45M datasets
```

**Backup:**
```typescript
// + googleScholar (priority 1) - scraping
```

#### Helper Functions
```typescript
// Get APIs by phase
getAPIsByPhase('P1')
→ [openalex, semanticScholar, pubmed]

// Get APIs by subject
getAPIsBySubject('biomedicine')
→ [pubmed, europepmc, medrxiv, plos]

// All enabled APIs
getEnabledAPIs()
→ All 13 API configs

// Check auth
requiresAuth('pubmed') → false
getAPIKey('semanticScholar') → process.env.SEMANTIC_SCHOLAR_KEY

// By priority
getAPIsByPriority()
→ [openalex(10), semanticScholar(9), pubmed(9), ...]
```

#### Subject Area Groups
```typescript
API_BY_SUBJECT = {
  biomedicine: ['pubmed', 'europepmc', 'medrxiv', 'plos'],
  computerScience: ['arxiv', 'semanticScholar', 'openalex'],
  physics: ['arxiv', 'openalex'],
  biology: ['biorxiv', 'plos', 'pubmed', 'europepmc'],
  openAccess: ['doaj', 'plos', 'core', 'arxiv'],
  preprints: ['arxiv', 'biorxiv', 'medrxiv'],
  datasets: ['datacite', 'openaire'],
  europe: ['openaire', 'core', 'europepmc'],
}
```

---

### 3. **index.ts** (9 linhas)
```typescript
// Barrel export
export * from './constants';
export * from './apis.config';
```

---

## ✅ Benefícios

### 1. **Single Source of Truth**
```typescript
// ❌ ANTES: Valores hardcoded espalhados
if (score >= 75) { priority = 'P1'; }  // Em 20 lugares diferentes

// ✅ AGORA: Centralizado
import { QUALITY_THRESHOLDS, getPriority } from '@/config';
const priority = getPriority(score);
```

### 2. **Fácil Ajuste de Thresholds**
```typescript
// Mudar de P1_MIN: 75 para 80?
// ✅ 1 linha de mudança em constants.ts
// ✅ Todo sistema atualizado automaticamente
```

### 3. **Type-Safe**
```typescript
// ✅ IntelliSense completo
const pubmed = API_CONFIGS.pubmed;
pubmed.rateLimit.requestsPerSecond  // 10 (autocomplete)
pubmed.auth.envVar                  // 'PUBMED_API_KEY'
```

### 4. **Documentação Inline**
Cada constante tem:
- ✅ JSDoc comment explicando uso
- ✅ Type annotations
- ✅ Exemplos de valores

### 5. **Fácil Adicionar Novas APIs**
Basta adicionar nova entrada em `API_CONFIGS` seguindo interface.

---

## 📊 Estatísticas da Fase 2

| Métrica | Valor |
|---------|-------|
| Arquivos criados | 3 |
| Linhas adicionadas | 1,454 |
| Constantes definidas | 50+ |
| APIs configuradas | 13 |
| Helper functions | 15 |
| Tempo de build | ~15s |
| Erros de compilação | 0 ✅ |

---

## 🎯 Como Usar

### Imports:
```typescript
// Tudo junto
import {
  QUALITY_THRESHOLDS,
  API_CONFIGS,
  getAPIsByPhase,
  CHUNKING_CONFIG
} from '@/config';

// Ou específico
import { QUALITY_THRESHOLDS } from '@/config/constants';
import { API_CONFIGS } from '@/config/apis.config';
```

### Exemplos de Uso:

#### 1. Quality Scoring
```typescript
import { getPriority, getCitationScore } from '@/config';

const score =
  (hasFullText ? 25 : 0) +
  (isOpenAccess ? 20 : 0) +
  getCitationScore(citationCount) +
  // ... outros fatores

const priority = getPriority(score);  // 'P1' | 'P2' | 'P3'
```

#### 2. Busca em Fases
```typescript
import { PHASE_CONFIG, getAPIsByPhase } from '@/config';

// Fase P1
const p1APIs = getAPIsByPhase('P1');
const p1Results = await searchAPIs(p1APIs, query, {
  timeout: PHASE_CONFIG.P1.timeout,
  minQualityScore: PHASE_CONFIG.P1.minQualityScore,
});

if (p1Results.length < PHASE_CONFIG.P1.minResults) {
  // Ir para P2
  const p2APIs = getAPIsByPhase('P2');
  // ...
}
```

#### 3. Configuração de API
```typescript
import { API_CONFIGS, requiresAuth, getAPIKey } from '@/config';

const pubmed = API_CONFIGS.pubmed;

const headers: any = {
  'User-Agent': 'ReseaBot/1.0',
};

if (requiresAuth('pubmed')) {
  const apiKey = getAPIKey('pubmed');
  if (apiKey) {
    headers['api_key'] = apiKey;
  }
}

const response = await axios.get(pubmed.endpoints.search, {
  headers,
  timeout: pubmed.request.timeout,
});
```

#### 4. Subject-Specific Search
```typescript
import { getAPIsBySubject } from '@/config';

// Busca focada em biomedicina
const bioAPIs = getAPIsBySubject('biomedicine');
// → [pubmed, europepmc, medrxiv, plos]

const results = await searchAPIs(bioAPIs, 'covid-19 vaccines');
```

---

## 🚀 Próximas Fases

### **Fase 3: BaseAPIService** (próximo)
Criar classe base para todas as APIs:
```typescript
class BaseAPIService {
  protected config: APIConfig;
  protected rateLimiter: RateLimiter;

  async search(query: string): Promise<AcademicArticle[]>
  async fetchArticle(id: string): Promise<AcademicArticle>
  protected async request(url: string): Promise<any>
  protected handleError(error: any): void
}
```

Features:
- Token bucket rate limiting
- Automatic retry with exponential backoff
- Circuit breaker integration
- Error handling padronizado
- Request/response logging

### Fase 4: Individual APIs
Refatorar cada API para usar BaseAPIService:
```typescript
class SemanticScholarAPI extends BaseAPIService {
  constructor() {
    super(API_CONFIGS.semanticScholar);
  }

  async search(query: string): Promise<AcademicArticle[]> {
    // Implementation
  }
}
```

### Fase 5: Quality Scoring
```typescript
class QualityScorer {
  calculateScore(article: AcademicArticle): number
  assignPriority(score: number): ArticlePriority
  filterByQuality(articles: AcademicArticle[], minScore: number)
}
```

### Fase 6: Content Parsing
```typescript
class ContentParser {
  parseJATS(xml: string): StructuredContent
  parseLaTeX(latex: string): StructuredContent
  chunk(content: StructuredContent): ContentChunk[]
}
```

---

## ✅ Checklist de Aprovação

- [x] Build passa sem erros
- [x] Todas 13 APIs configuradas
- [x] Helpers implementados
- [x] Type-safe
- [x] Documentado
- [x] Commit feito

---

## 📝 Decisão Necessária

**Qual o próximo passo?**

**Opção A:** Continuar com Fase 3 (BaseAPIService)
- Criar classe base com rate limiting
- Token bucket algorithm
- Retry logic e circuit breaker

**Opção B:** Você me enviar mais código do seu plano
- Parsers (JATS, LaTeX, TEI)
- Quality scorer
- Outros componentes

**Opção C:** Revisar/ajustar configurações antes de continuar

---

**Status:** ✅ Fase 2 completa
**Commits:**
- `ff692f1` - Phase 1: Types Foundation
- `d3bbd88` - Phase 2: Configuration

**Build:** ✅ Passing
**Total linhas:** 2,697 (1,243 types + 1,454 config)
**Deploy:** 🟡 Esperando todas fases antes de push
