# Resea AI Research Assistant - Backend

Backend API Node.js/Express para o assistente de pesquisa acadêmica com IA.

## 🚀 Características

### Segurança
- ✅ API Keys protegidas no servidor
- ✅ Rate limiting configurável
- ✅ Helmet para headers de segurança
- ✅ CORS configurado
- ✅ Validação de entrada com Zod

### Performance
- ✅ Cache em memória / Redis
- ✅ Retry logic com exponential backoff
- ✅ Circuit breakers para cada API acadêmica
- ✅ Compressão gzip
- ✅ Streaming de conteúdo

### Extração Avançada de Artigos
- ✅ **Busca em 4 APIs acadêmicas**: Semantic Scholar, CrossRef, OpenAlex, PubMed
- ✅ **Extração de PDF**: Download e parsing automático
- ✅ **Análise de seções**: Abstract, Introdução, Metodologia, Resultados, Discussão, Conclusão
- ✅ **Filtros avançados**: Ano, citações mínimas, open access, idioma
- ✅ **Ranking por qualidade**: Baseado em citações e conteúdo
- ✅ **Deduplicação inteligente**: Remove artigos duplicados
- ✅ **Enriquecimento automático**: Adiciona conteúdo completo dos PDFs

### Observabilidade
- ✅ Logging estruturado com Winston
- ✅ Health check endpoint
- ✅ Métricas de circuit breakers
- ✅ HTTP request logging

## 📦 Instalação

```bash
cd backend
npm install
```

## ⚙️ Configuração

Crie um arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

Edite `.env` com suas configurações:

```env
# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# API Keys (obrigatório)
GEMINI_API_KEY=sua_chave_aqui

# Redis (opcional)
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## 🏃 Execução

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

### Testes
```bash
npm test
npm run test:coverage
```

## 📡 API Endpoints

### Gerar Plano de Pesquisa
```http
POST /api/generate-plan
Content-Type: application/json

{
  "query": "Impacto da IA na educação"
}
```

### Gerar Mapa Mental
```http
POST /api/generate-mindmap
Content-Type: application/json

{
  "taskTitle": "...",
  "taskDescription": {...},
  "executionPlan": {...}
}
```

### Executar Passo de Pesquisa
```http
POST /api/research-step
Content-Type: application/json

{
  "step": "Investigar aplicações de IA",
  "originalQuery": "Impacto da IA na educação",
  "filters": {
    "startYear": 2020,
    "minCitations": 10,
    "maxResults": 15,
    "openAccessOnly": false
  }
}
```

### Gerar Esboço
```http
POST /api/generate-outline
Content-Type: application/json

{
  "plan": {...},
  "researchResults": [...]
}
```

### Gerar Conteúdo (Streaming)
```http
POST /api/generate-content
Content-Type: application/json

{
  "plan": {...},
  "researchResults": [...]
}
```

Retorna Server-Sent Events:
```
data: {"chunk": "# Título\n\n"}
data: {"chunk": "Conteúdo..."}
data: {"done": true}
```

### Health Check
```http
GET /api/health
```

### Limpar Cache
```http
POST /api/cache/clear
```

## 🔍 Sistema de Busca Acadêmica

### APIs Suportadas

1. **Semantic Scholar**
   - Melhor para: Artigos de ciência da computação e IA
   - Campos: Citações, PDFs open access, abstracts
   - Rate limit: 100 req/5min (sem API key)

2. **CrossRef**
   - Melhor para: Metadados de publicações
   - Campos: DOI, contagem de citações, links para PDFs
   - Rate limit: Sem limite (educado: 50 req/s)

3. **OpenAlex**
   - Melhor para: Cobertura ampla, open access
   - Campos: Autores, instituições, citações
   - Rate limit: 10 req/s

4. **PubMed**
   - Melhor para: Biomedicina e ciências da saúde
   - Campos: Resumos médicos, PMC links
   - Rate limit: 3 req/s (sem API key)

### Filtros Disponíveis

```typescript
interface AcademicSearchFilters {
  startYear?: number;        // Ano inicial (ex: 2020)
  endYear?: number;          // Ano final (ex: 2024)
  minCitations?: number;     // Mínimo de citações (ex: 10)
  maxResults?: number;       // Máximo de resultados (padrão: 20)
  language?: string;         // Idioma (ex: 'pt', 'en')
  sourceTypes?: string[];    // Tipos (ex: ['journal-article'])
  openAccessOnly?: boolean;  // Apenas open access
}
```

### Extração de PDF

O sistema tenta automaticamente:
1. Encontrar URL do PDF nas respostas das APIs
2. Baixar o PDF (limite: 50MB, timeout: 30s)
3. Extrair texto completo
4. Identificar seções do artigo usando heurísticas
5. Calcular qualidade do artigo

Seções extraídas:
- Abstract
- Introduction
- Methodology
- Results
- Discussion
- Conclusion

## 🛡️ Circuit Breakers

Cada API acadêmica tem seu próprio circuit breaker:
- **Threshold**: 5 falhas consecutivas
- **Timeout**: 60 segundos
- **Estados**: CLOSED → OPEN → HALF_OPEN

Quando OPEN, requisições falham imediatamente para evitar sobrecarga.

## 💾 Cache

### Memória (padrão)
- Limpa automaticamente a cada 5 minutos
- TTL padrão: 1 hora

### Redis (opcional)
```bash
# Instalar Redis
brew install redis  # macOS
apt-get install redis  # Ubuntu

# Iniciar Redis
redis-server

# Configurar .env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

## 📊 Logs

Logs são salvos em:
- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros
- `logs/exceptions.log` - Exceções não tratadas
- `logs/rejections.log` - Promise rejections

Formato:
```
2024-01-15 10:30:45 [info]: Academic search started {"keywords":["IA","educação"]}
2024-01-15 10:30:46 [info]: Semantic Scholar results {"count":10,"query":"IA educação"}
```

## 🧪 Testes

```bash
# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage
```

## 🐳 Docker (Futuro)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

## 📈 Monitoramento

### Métricas Disponíveis

```http
GET /api/health
```

Retorna:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "cache": {
    "size": 42,
    "keys": ["search:...", "..."]
  },
  "searchStats": {
    "circuitBreakers": [
      {"name": "SemanticScholar", "state": "CLOSED"},
      {"name": "CrossRef", "state": "CLOSED"},
      {"name": "OpenAlex", "state": "OPEN"},
      {"name": "PubMed", "state": "CLOSED"}
    ]
  }
}
```

## 🔧 Troubleshooting

### PDF extraction failed
- Verifique se o PDF é acessível publicamente
- Alguns publishers bloqueiam scraping
- Timeout pode ser muito curto para PDFs grandes

### Circuit breaker OPEN
- API pode estar fora do ar
- Rate limit excedido
- Reset manual: reiniciar servidor ou aguardar timeout

### Cache not working
- Verifique permissões de escrita em `logs/`
- Redis: verifique conexão com `redis-cli ping`

### Rate limit exceeded
- Ajuste `RATE_LIMIT_MAX_REQUESTS` no `.env`
- Considere adicionar API keys para APIs acadêmicas

## 📝 Licença

MIT
