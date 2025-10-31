# 🔐 Configuração de Variáveis de Ambiente no Render.com

## 🎯 Visão Geral

Este guia mostra como configurar todas as variáveis de ambiente **diretamente no Render**, sem precisar de arquivo `.env`. Isso é mais seguro e é a melhor prática para produção.

---

## 📋 Passo a Passo

### 1. Acessar o Dashboard do Render

1. Acesse https://dashboard.render.com
2. Faça login na sua conta
3. Selecione seu serviço **resea-backend**
4. Clique na aba **Environment** no menu lateral esquerdo

### 2. Adicionar Variáveis de Ambiente

Clique no botão **"Add Environment Variable"** e adicione **cada uma** das variáveis abaixo:

---

## 🔑 Variáveis Obrigatórias

### **Autenticação e Domínio**

```
MAIN_DOMAIN_API=https://smileai.com.br
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=Q2NM4Z6f4xt6HzlGhwRrooO6eN5byqdjjmJoblJZX
```

### **HuggingFace API (CRÍTICO - Fase 1)**

```
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Como obter:**
1. Acesse https://huggingface.co/settings/tokens
2. Faça login ou crie uma conta
3. Clique em **"New token"**
4. Nome: `resea-backend-production`
5. Type: **Read** (suficiente para inference)
6. Clique em **"Generate token"**
7. **Copie e salve o token** (começa com `hf_`)

---

### **Unpaywall API (Descoberta de PDFs Open Access)**

```
UNPAYWALL_EMAIL=seu-email-real@exemplo.com
```

**Nota:** Use seu email real. Unpaywall usa isso apenas para contato em caso de problemas.

---

### **URLs dos Serviços**

#### **Opção 1: Serviços Locais (Não recomendado para Render)**
```
GROBID_URL=http://localhost:8070
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
```

#### **Opção 2: Serviços em Cloud (RECOMENDADO)**

**Para GROBID:**
```
GROBID_URL=https://cloud.science-miner.com/grobid
```
*Alternativa gratuita: Use o serviço público do GROBID (limite de requests)*

**Para Qdrant:**
```
QDRANT_URL=https://xxxxx-xxxxx.us-east.aws.cloud.qdrant.io
QDRANT_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
```

**Como configurar Qdrant Cloud (GRATUITO até 1GB):**
1. Acesse https://cloud.qdrant.io
2. Crie conta gratuita
3. Crie um cluster: **"Create Cluster"**
4. Nome: `resea-production`
5. Region: **US East** (mais próximo do Render)
6. Plan: **Free** (1GB, 100K vetores)
7. Aguarde provisionamento (~2 minutos)
8. Copie a **Cluster URL** e **API Key**

**Para Redis:**
```
REDIS_URL=redis://default:senha@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:12345
```

**Como configurar Redis Cloud (GRATUITO até 30MB):**
1. Acesse https://redis.com/try-free/
2. Crie conta gratuita
3. Crie database: **"New Database"**
4. Nome: `resea-cache`
5. Plan: **Free** (30MB)
6. Region: **US East**
7. Copie a **Redis URL** (formato completo com senha)

---

### **Pesos da Busca Híbrida (Opcional)**

```
VECTOR_WEIGHT=0.7
BM25_WEIGHT=0.3
```

### **Modelos de IA (Opcional - usa defaults)**

```
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
```

---

## 🚀 Arquitetura Recomendada para Produção

### **Opção A: Tudo em Cloud (RECOMENDADO)**

```
✅ Backend (Render)
  ├── GROBID: cloud.science-miner.com (público)
  ├── Qdrant: cloud.qdrant.io (free tier)
  └── Redis: redis.com (free tier)

✅ Vantagens:
  - Tudo gerenciado
  - Escalável
  - Free tier generoso
  - Zero manutenção
```

### **Opção B: Serviços Próprios no Render**

Se quiser rodar GROBID/Qdrant/Redis no próprio Render:

1. **Crie serviços separados** no Render
2. **Use Docker Compose** ou **Background Workers**
3. **Configure URLs internas**: 
   - `GROBID_URL=https://resea-grobid.onrender.com`
   - `QDRANT_URL=https://resea-qdrant.onrender.com`

⚠️ **Desvantagens:**
- Custos adicionais (free tier limitado)
- Gerenciamento manual
- Sleep em inatividade (free tier)

---

## 📸 Screenshots de Exemplo

### 1. Painel de Environment Variables no Render

```
┌────────────────────────────────────────────────────┐
│ Environment Variables                              │
├────────────────────────────────────────────────────┤
│                                                    │
│ Key                        Value                   │
│ ─────────────────────────────────────────────     │
│ HUGGINGFACE_API_KEY        hf_xxxxx... [hidden]   │
│ QDRANT_URL                 https://xxxxx...        │
│ QDRANT_API_KEY             xxxxx... [hidden]       │
│ UNPAYWALL_EMAIL            you@example.com         │
│ GROBID_URL                 https://cloud.sci...    │
│ REDIS_URL                  redis://default:... [h] │
│                                                    │
│ [+ Add Environment Variable]                       │
└────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de Configuração

### **Fase 0 (Extração de Texto Completo)**
- [ ] `HUGGINGFACE_API_KEY` ⭐ **CRÍTICO**
- [ ] `UNPAYWALL_EMAIL`
- [ ] `GROBID_URL`

### **Fase 1 (Busca Híbrida + Observability)**
- [ ] `QDRANT_URL` ⭐ **CRÍTICO**
- [ ] `QDRANT_API_KEY` (se usar Qdrant Cloud)
- [ ] `REDIS_URL` (opcional para cache)
- [ ] `VECTOR_WEIGHT` (opcional)
- [ ] `BM25_WEIGHT` (opcional)

### **Autenticação (Já configurado)**
- [ ] `MAIN_DOMAIN_API`
- [ ] `OAUTH_CLIENT_ID`
- [ ] `OAUTH_CLIENT_SECRET`

---

## 🧪 Teste de Configuração

Após adicionar todas as variáveis no Render:

### 1. Salvar e Fazer Redeploy

1. Clique em **"Save Changes"** no Render
2. O Render vai fazer **auto-redeploy**
3. Aguarde o deploy completar (~5 minutos)

### 2. Verificar Logs

No Render, vá em **"Logs"** e procure por:

```
✅ Coleção 'academic_papers' criada no Qdrant
✅ GROBID is alive
✅ Redis connected
```

### 3. Testar Endpoints

```bash
# Health check geral
curl https://seu-app.onrender.com/api/fulltext/health

# Métricas
curl https://seu-app.onrender.com/api/metrics/json

# Circuit breakers
curl https://seu-app.onrender.com/api/metrics/circuit-breakers

# Stats da busca
curl https://seu-app.onrender.com/api/search/stats
```

---

## 🔒 Segurança

### ✅ Boas Práticas Implementadas

1. **Nenhuma senha no código**: Tudo em variáveis de ambiente
2. **Nenhum arquivo .env commitado**: `.env` está no `.gitignore`
3. **Tokens rotacionáveis**: Pode trocar no Render sem redeployar código
4. **Acesso restrito**: Apenas você vê os valores no dashboard

### 🚨 Nunca Faça

- ❌ Commitar arquivo `.env` no Git
- ❌ Compartilhar `HUGGINGFACE_API_KEY` publicamente
- ❌ Usar tokens de desenvolvimento em produção
- ❌ Logar variáveis secretas no console

---

## 🆘 Troubleshooting

### **Erro: "HUGGINGFACE_API_KEY not set"**

**Solução:**
1. Vá no Render → Environment
2. Adicione `HUGGINGFACE_API_KEY=hf_seu_token`
3. Salve e aguarde redeploy

### **Erro: "Qdrant connection failed"**

**Solução:**
1. Verifique se `QDRANT_URL` está correto
2. Se usar Qdrant Cloud, adicione `QDRANT_API_KEY`
3. Teste manualmente: `curl https://seu-qdrant-url/health`

### **Erro: "GROBID not available"**

**Solução:**
- Sistema usa **fallback automático** para pdf-parse
- Não é erro crítico, mas extração será menos precisa
- Configure GROBID Cloud ou aceite fallback

### **Verificar variáveis carregadas**

Adicione endpoint de debug (REMOVER EM PRODUÇÃO):

```typescript
// Apenas para debug - REMOVER depois
app.get('/api/debug/env', (req, res) => {
  res.json({
    hasHuggingface: !!process.env.HUGGINGFACE_API_KEY,
    hasQdrant: !!process.env.QDRANT_URL,
    hasGrobid: !!process.env.GROBID_URL,
    grobidUrl: process.env.GROBID_URL, // OK mostrar URL pública
  });
});
```

---

## 📚 Recursos Adicionais

### **HuggingFace**
- Dashboard: https://huggingface.co/settings/tokens
- Docs: https://huggingface.co/docs/api-inference/quicktour
- Rate Limits: 1000 requests/hora (free tier)

### **Qdrant Cloud**
- Dashboard: https://cloud.qdrant.io
- Docs: https://qdrant.tech/documentation/cloud/
- Free Tier: 1GB storage, 100K vetores

### **Redis Cloud**
- Dashboard: https://app.redislabs.com
- Docs: https://docs.redis.com/latest/rc/
- Free Tier: 30MB

### **GROBID Público**
- Service: https://cloud.science-miner.com/grobid
- Docs: https://grobid.readthedocs.io/
- Limite: ~10 requests/minuto

---

## 🎯 Próximos Passos

Após configurar tudo:

1. ✅ **Testar extração**: `POST /api/fulltext/extract`
2. ✅ **Inicializar Qdrant**: `POST /api/search/initialize`
3. ✅ **Indexar papers**: `POST /api/search/index`
4. ✅ **Buscar**: `POST /api/search/hybrid`
5. ✅ **Ver métricas**: `GET /api/metrics`

---

**🔐 Lembre-se: Variáveis no Render são a forma CORRETA e SEGURA de configurar produção!**
