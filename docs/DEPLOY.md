# 🚀 Guia de Deploy - Resea AI Backend

Este guia cobre o deploy completo da aplicação Resea AI Backend em produção (Render.com).

---

## 📋 Pré-requisitos

### 1. Contas Necessárias

- ✅ **Render.com** - Hosting do backend
- ✅ **Neon/Supabase** - PostgreSQL database (plano gratuito)
- ✅ **Upstash** - Redis managed (plano gratuito)
- ✅ **Qdrant Cloud** - Vector database (plano gratuito)
- ✅ **GitHub** - Repositório do código

### 2. API Keys Necessárias (Todas Gratuitas)

```bash
# SmileAI Integration (OAuth)
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=Q2NM4Z6f4xt6HzlGhwRroO6eN5byqdjjmJoblJZX
MAIN_DOMAIN_API=https://smileai.com.br

# AI Providers (usar pelo menos 1)
GEMINI_API_KEY=          # https://aistudio.google.com/app/apikey (RECOMENDADO)
GROQ_API_KEY=            # https://console.groq.com/keys
OPENROUTER_API_KEY=      # https://openrouter.ai/keys
OLLAMA_API_KEY=          # https://ollama.com/settings/keys

# Academic Search
SEMANTIC_SCHOLAR_KEY=    # https://www.semanticscholar.org/product/api (OBRIGATÓRIO)

# Frontend URL
FRONTEND_URL=https://app.smileai.com.br
```

---

## 🏗️ Parte 1: Configurar Infraestrutura

### 1.1 PostgreSQL (Neon ou Supabase)

**Opção A: Neon (Recomendado)**
```bash
# 1. Acesse https://neon.tech
# 2. Crie novo projeto: "resea-production"
# 3. Copie a connection string:
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Opção B: Supabase**
```bash
# 1. Acesse https://supabase.com
# 2. Crie novo projeto: "resea-production"
# 3. Em Settings > Database, copie a connection string:
DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
```

### 1.2 Redis (Upstash)

```bash
# 1. Acesse https://upstash.com
# 2. Crie novo database: "resea-cache"
# 3. Copie a Redis URL:
REDIS_URL=rediss://default:pass@happy-xxx.upstash.io:6379
```

### 1.3 Qdrant Cloud

```bash
# 1. Acesse https://cloud.qdrant.io
# 2. Crie novo cluster: "resea-vectors" (Free tier: 1GB)
# 3. Copie as credenciais:
QDRANT_URL=https://xxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-api-key
```

---

## 🚀 Parte 2: Deploy no Render

### 2.1 Criar Web Service

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **New +** → **Web Service**
3. Conecte seu repositório GitHub: `ricardosommerfeld/resea-backend`
4. Configure:

```yaml
Name: resea-backend
Environment: Node
Region: Ohio (us-east-2) # Mais próximo do Neon
Branch: main
Build Command: npm install && npm run build
Start Command: npm start
Plan: Free (ou Starter se precisar sempre ativo)
```

### 2.2 Configurar Environment Variables

No Render Dashboard, vá em **Environment** e adicione:

```bash
# === Node.js ===
NODE_ENV=production
PORT=3001

# === SmileAI OAuth ===
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=Q2NM4Z6f4xt6HzlGhwRroO6eN5byqdjjmJoblJZX
MAIN_DOMAIN_API=https://smileai.com.br

# === Frontend ===
FRONTEND_URL=https://app.smileai.com.br

# === Database ===
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# === Redis Cache ===
REDIS_URL=rediss://default:pass@xxx.upstash.io:6379

# === Qdrant Vector DB ===
QDRANT_URL=https://xxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key

# === AI Providers (pelo menos 1 obrigatório) ===
# Recomendado: Gemini (melhor custo-benefício)
GEMINI_API_KEY=your-gemini-key

# Opcionais (fallback automático):
GROQ_API_KEY=your-groq-key
OPENROUTER_API_KEY=your-openrouter-key
OLLAMA_API_KEY=your-ollama-key

# === Academic Search ===
SEMANTIC_SCHOLAR_KEY=your-semantic-scholar-key  # OBRIGATÓRIO

# === Performance ===
RATE_LIMIT_WINDOW_MS=900000        # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100        # 100 requests por janela
LOG_LEVEL=info                     # info | debug | warn | error
SYNC_INTERVAL_MINUTES=60           # Incremental sync a cada 60 min

# === Embeddings ===
OLLAMA_BASE_URL=https://api.ollama.com
EMBEDDING_MODEL=nomic-embed-text   # 768 dimensions
```

### 2.3 Deploy

1. Clique em **Create Web Service**
2. Aguarde o build completar (~5-10 minutos)
3. Verifique os logs para confirmar:

```
✅ Database initialized successfully
✅ Redis connected successfully
🚀 Server running on port 3001
🤖 AI Providers (Multi-Provider): Gemini ✓, Groq ✓
✅ Incremental Indexing started
```

---

## 🔍 Parte 3: Validação Pós-Deploy

### 3.1 Health Check

```bash
# Endpoint principal
curl https://resea-backend.onrender.com/api/health

# Resposta esperada:
{
  "status": "healthy",
  "uptime": 123.45,
  "services": {
    "aiProviders": { "available": true, "availableCount": 2 },
    "database": { "available": true, "type": "postgresql" },
    "redis": { "available": true, "type": "redis" },
    "qdrant": { "available": true, "collections": 1 },
    "incrementalIndexing": { "isRunning": true }
  }
}
```

### 3.2 Testar AI Providers

```bash
curl https://resea-backend.onrender.com/api/health/ai

# Deve mostrar status de cada provider:
{
  "health": {
    "gemini": { "available": true, "latency": 234 },
    "groq": { "available": true, "latency": 156 }
  }
}
```

### 3.3 Testar Autenticação

```bash
# Login via SmileAI OAuth
curl -X POST https://resea-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"senha"}'

# Resposta esperada:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { "id": 123, "email": "seu@email.com" }
}
```

### 3.4 Testar Pesquisa Acadêmica

```bash
# Busca em 7 fontes acadêmicas
curl -X POST https://resea-backend.onrender.com/api/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"machine learning","limit":10}'

# Deve retornar papers de OpenAlex, Semantic Scholar, arXiv, etc.
```

---

## 📊 Parte 4: Monitoramento

### 4.1 Logs (Render Dashboard)

```bash
# Acesse: https://dashboard.render.com/web/YOUR_SERVICE/logs

# Logs importantes:
✅ Database initialized successfully
✅ Redis connected successfully
🔄 Starting Incremental Indexing (every 60 minutes)
🤖 AI Providers: Gemini ✓, Groq ✓
```

### 4.2 Métricas (Prometheus)

```bash
# Endpoint de métricas
curl https://resea-backend.onrender.com/api/metrics

# Métricas disponíveis:
- http_requests_total
- http_request_duration_seconds
- ai_provider_requests_total
- cache_hits_total
- academic_search_requests_total
```

### 4.3 Alertas Automáticos

Configure no Render:
1. **Deploy Notifications** → Slack/Email
2. **Health Check URL**: `/api/health`
3. **Expected Status**: 200

---

## 🔐 Parte 5: Rotação de API Keys

### 5.1 Rotação Manual (Local)

```bash
# Use o script automatizado
cd /path/to/resea-backend
chmod +x scripts/rotate-api-keys.sh

# Rotacionar todas as keys
./scripts/rotate-api-keys.sh all

# Ou rotacionar apenas uma:
./scripts/rotate-api-keys.sh gemini
```

### 5.2 Rotação em Produção (Render)

```bash
# 1. Acesse: https://dashboard.render.com/web/YOUR_SERVICE/env
# 2. Encontre a variável (ex: GEMINI_API_KEY)
# 3. Clique em Edit → Cole nova key → Save
# 4. Render reiniciará automaticamente
```

### 5.3 Frequência Recomendada

```
Semantic Scholar: A cada 6 meses (limite de rate)
Gemini/Groq/etc: A cada 3 meses (segurança)
OAuth Credentials: Apenas se comprometido
```

---

## 🐛 Parte 6: Troubleshooting

### Problema 1: "Database initialization failed"

```bash
# Causa: DATABASE_URL inválida ou database inacessível

# Solução:
1. Verifique se DATABASE_URL está correta
2. Teste conexão local:
   psql "postgresql://user:pass@host/db?sslmode=require"
3. Confirme se IP do Render está permitido (Neon/Supabase whitelist)
```

### Problema 2: "Redis connection failed"

```bash
# Causa: REDIS_URL inválida ou Upstash down

# Solução:
1. Verifique REDIS_URL (deve começar com rediss://)
2. Teste com redis-cli:
   redis-cli -u "rediss://default:pass@host:6379" PING
3. Sistema continua funcionando com cache em memória
```

### Problema 3: "No AI providers available"

```bash
# Causa: Nenhuma API key de AI configurada

# Solução:
1. Adicione pelo menos uma:
   - GEMINI_API_KEY (recomendado)
   - GROQ_API_KEY
   - OPENROUTER_API_KEY
2. Verifique validade das keys em seus dashboards
3. Confirme se não atingiu rate limits
```

### Problema 4: "Rate limit exceeded"

```bash
# Causa: Muitas requisições em curto período

# Solução:
1. Aumente RATE_LIMIT_MAX_REQUESTS (padrão: 100)
2. Aumente RATE_LIMIT_WINDOW_MS (padrão: 15 min)
3. Use cache para reduzir chamadas de API
4. Considere upgrade para Render Starter (IP dedicado)
```

### Problema 5: "Qdrant connection timeout"

```bash
# Causa: Qdrant Cloud inacessível ou quota excedida

# Solução:
1. Verifique status em https://cloud.qdrant.io
2. Confirme QDRANT_URL e QDRANT_API_KEY
3. Verifique storage usado (free tier: 1GB)
4. Sistema continua funcionando sem semantic search
```

---

## 📈 Parte 7: Performance Tuning

### 7.1 Otimizações Já Implementadas

```
✅ Multi-layer caching (L1 Memory + L2 Redis + Semantic)
✅ Qdrant quantization (75% memory reduction)
✅ Incremental sync with timestamps (80% API call reduction)
✅ Batch embeddings processing (10 per batch)
✅ Circuit breakers para cada AI provider
✅ Retry with exponential backoff
✅ Connection pooling (PostgreSQL)
```

### 7.2 Configurações de Performance

```bash
# Ajuste conforme necessidade:

# Sync mais frequente (custo de API maior)
SYNC_INTERVAL_MINUTES=30  # Padrão: 60

# Cache mais agressivo (uso de memória maior)
# Em smartCache.service.ts:
maxLocalCacheSize: 1000    # Padrão: 500
redisTTL: 7200             # 2 horas (padrão: 1 hora)

# Rate limiting mais permissivo
RATE_LIMIT_MAX_REQUESTS=200  # Padrão: 100
```

### 7.3 Scaling Recommendations

```
Free tier (Render):
- ✅ Até 100 usuários simultâneos
- ✅ ~5000 requests/dia
- ⚠️ Cold start após 15 min inatividade

Starter ($7/mês):
- ✅ Até 500 usuários simultâneos
- ✅ ~50000 requests/dia
- ✅ Sem cold start
- ✅ IP dedicado (melhor rate limiting)
```

---

## 🔒 Parte 8: Segurança

### 8.1 Checklist de Segurança

```
✅ HTTPS obrigatório (Render fornece SSL grátis)
✅ Helmet.js configurado (security headers)
✅ CORS restrito a domínios conhecidos
✅ Rate limiting ativo
✅ JWT tokens com expiração
✅ Secrets em environment variables (nunca no código)
✅ PostgreSQL com SSL (sslmode=require)
✅ Redis com TLS (rediss://)
✅ Request tracing com correlation IDs
```

### 8.2 Backup da Database

```bash
# Neon: Backups automáticos diários (retenção: 7 dias)
# Supabase: Backups automáticos diários (retenção: 7 dias)

# Backup manual (via pg_dump):
pg_dump "postgresql://user:pass@host/db?sslmode=require" > backup.sql

# Restore:
psql "postgresql://user:pass@host/db?sslmode=require" < backup.sql
```

### 8.3 Disaster Recovery

```
1. Database: Restaurar de backup Neon/Supabase
2. Redis: Cache é temporário, reconstrói automaticamente
3. Qdrant: Re-executar incremental sync (script manual)
4. Código: Git revert ou redeploy branch anterior
```

---

## 📚 Parte 9: Recursos Úteis

### Dashboards

```
Render: https://dashboard.render.com
Neon: https://console.neon.tech
Upstash: https://console.upstash.com
Qdrant: https://cloud.qdrant.io
```

### Documentação

```
API Docs: /api (GET root endpoint)
Health: /api/health
Metrics: /api/metrics
Logs: Render Dashboard > Logs
```

### Suporte

```
Issues: https://github.com/ricardosommerfeld/resea-backend/issues
SmileAI: https://smileai.com.br/suporte
```

---

## ✅ Checklist Final

Antes de considerar o deploy concluído, verifique:

- [ ] Health check retorna 200 OK
- [ ] Pelo menos 1 AI provider disponível
- [ ] Database conectada e migrações aplicadas
- [ ] Redis conectado (ou fallback para memory)
- [ ] Qdrant conectado com coleção criada
- [ ] Incremental sync rodando automaticamente
- [ ] Frontend consegue fazer login via OAuth
- [ ] Busca acadêmica retornando papers
- [ ] Logs não mostram erros críticos
- [ ] Métricas Prometheus acessíveis
- [ ] Rate limiting funcionando corretamente
- [ ] CORS configurado para frontend
- [ ] Backup automático da database ativo
- [ ] Monitoring configurado (Render notifications)

---

## 🎉 Deploy Completo!

Seu backend Resea AI está pronto para produção com:

- ✅ Multi-provider AI (Gemini, Groq, OpenRouter, Ollama)
- ✅ 7 fontes acadêmicas (OpenAlex, Semantic Scholar, arXiv, CORE, DOAJ, PubMed, Google Scholar)
- ✅ Multi-layer caching (L1 + L2 + Semantic)
- ✅ Vector search com Qdrant quantization
- ✅ Incremental sync automático
- ✅ Circuit breakers e retry logic
- ✅ Request tracing e structured logging
- ✅ Prometheus metrics
- ✅ Comprehensive health checks

**Custo total: $0/mês** (tudo no free tier) 🎊
