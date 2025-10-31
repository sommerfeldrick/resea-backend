# 🌐 Configuração Ollama Cloud no Render

## ✅ Variáveis de Ambiente para Render

Configure estas variáveis no **Dashboard do Render → Environment**:

---

## 📋 Lista Completa de Variáveis

### 🔑 OBRIGATÓRIAS (Sistema não funciona sem)

```bash
# 1. Ollama Cloud API (IA - Embeddings + Reranking)
OLLAMA_API_KEY=ollama_sua_chave_aqui
```
**Como obter:**
1. Acesse: https://ollama.com/
2. Faça login/cadastro (GitHub, Google ou email)
3. Vá em: **Settings → API Keys**
4. Clique em **"Create API Key"**
5. Copie a chave (formato: `ollama_xxxxxxxxxxxxx`)

**Limite:** 1.000.000 tokens/dia (GRÁTIS) ✅

---

```bash
# 2. Qdrant Cloud (Vector Database)
QDRANT_URL=https://seu-cluster.cloud.qdrant.io
QDRANT_API_KEY=sua_chave_qdrant
```
**Como obter:**
1. Acesse: https://cloud.qdrant.io/
2. Crie conta gratuita
3. Clique em **"Create Cluster"** (Free tier - 1GB)
4. Após criar, copie:
   - **Cluster URL** (ex: `https://abc123.cloud.qdrant.io`)
   - **API Key** (no painel do cluster)

**Limite:** 1GB storage, ilimitadas requests (GRÁTIS) ✅

---

```bash
# 3. Unpaywall Email (para descobrir PDFs Open Access)
UNPAYWALL_EMAIL=seu-email@exemplo.com
```
**Como obter:** Use seu email real (qualquer email válido)

**Limite:** Ilimitado (GRÁTIS) ✅

---

### ⚙️ OPCIONAIS (Têm valores padrão)

```bash
# URLs dos serviços (já configuradas, pode deixar assim)
OLLAMA_URL=https://api.ollama.com
GROBID_URL=https://cloud.science-miner.com/grobid

# Modelos de IA (já otimizados)
EMBEDDING_MODEL=nomic-embed-text
RERANKER_MODEL=llama3.2

# Pesos da busca híbrida (Vector + BM25)
VECTOR_WEIGHT=0.7
BM25_WEIGHT=0.3

# Redis (Cache - OPCIONAL)
REDIS_URL=redis://seu-redis-cloud.com:6379
```

---

## 🎯 Resumo: O que adicionar no Render

### ✅ MÍNIMO NECESSÁRIO (3 variáveis):

```
OLLAMA_API_KEY=ollama_xxxxx
QDRANT_URL=https://xxxxx.cloud.qdrant.io
QDRANT_API_KEY=xxxxx
UNPAYWALL_EMAIL=seu@email.com
```

### 🌟 RECOMENDADO (5 variáveis):

```
OLLAMA_API_KEY=ollama_xxxxx
OLLAMA_URL=https://api.ollama.com
QDRANT_URL=https://xxxxx.cloud.qdrant.io
QDRANT_API_KEY=xxxxx
UNPAYWALL_EMAIL=seu@email.com
```

---

## 📝 Passo a Passo no Render

### 1️⃣ Acesse seu serviço
```
Dashboard Render → Seu Backend → Environment (aba lateral)
```

### 2️⃣ Adicione cada variável
```
Clique em "Add Environment Variable"
Key: OLLAMA_API_KEY
Value: ollama_sua_chave_aqui
Clique em "Save Changes"
```

### 3️⃣ Repita para todas as variáveis
- `OLLAMA_API_KEY`
- `OLLAMA_URL`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `UNPAYWALL_EMAIL`

### 4️⃣ Deploy automático
Após salvar, o Render **redeploya automaticamente** (~5 minutos)

---

## 🧪 Verificar se funcionou

### Após deploy, teste os endpoints:

```bash
# 1. Health Check
curl https://seu-app.onrender.com/api/fulltext/health

# 2. Métricas
curl https://seu-app.onrender.com/api/metrics/json

# 3. Status da busca
curl https://seu-app.onrender.com/api/search/stats
```

**Resposta esperada:** JSON com informações dos serviços ✅

---

## 🔐 Segurança

### ✅ Boas práticas no Render:
- Variáveis são **encriptadas** em repouso
- **Nunca aparecem** nos logs
- **Não são commitadas** no GitHub
- Só acessíveis pelo **seu serviço**

### ❌ NUNCA faça:
```bash
# ❌ NÃO commitar .env com chaves reais
git add .env

# ❌ NÃO colocar chaves no código
const apiKey = 'ollama_12345'; // NUNCA!

# ❌ NÃO expor em logs
console.log(process.env.OLLAMA_API_KEY); // NUNCA!
```

---

## 💰 Custos Totais

| Serviço | Plano | Custo Mensal |
|---------|-------|--------------|
| **Ollama Cloud** | Free (1M tok/dia) | **$0** ✅ |
| **Qdrant Cloud** | Free (1GB) | **$0** ✅ |
| **Unpaywall** | Grátis | **$0** ✅ |
| **GROBID Cloud** | Community | **$0** ✅ |
| **Render** | Free tier | **$0** ✅ |
| **TOTAL** | | **$0/mês** 🎉 |

---

## 🐛 Troubleshooting

### Erro: "OLLAMA_API_KEY not set"
```bash
# Verifique se adicionou no Render
# Verifique o nome exato (case-sensitive)
# Espere o redeploy terminar (~5 min)
```

### Erro: "Failed to connect to Qdrant"
```bash
# Verifique se a URL está correta
# Formato: https://xxx.cloud.qdrant.io (sem / no final)
# Verifique se API Key é do cluster correto
```

### Erro: "Model not found"
```bash
# Modelos suportados no Ollama Cloud:
# - nomic-embed-text ✅
# - mxbai-embed-large ✅
# - llama3.2 ✅
# - phi3 ✅
# - gemma2 ✅

# Verifique se o nome está correto em EMBEDDING_MODEL
```

---

## 📚 Links Úteis

- **Ollama Cloud**: https://ollama.com/settings/keys
- **Qdrant Cloud**: https://cloud.qdrant.io/
- **GROBID Cloud**: https://cloud.science-miner.com/grobid
- **Render Docs**: https://render.com/docs/environment-variables
- **Unpaywall API**: https://unpaywall.org/products/api

---

## ✅ Checklist Final

- [ ] Criei conta no Ollama Cloud
- [ ] Copiei `OLLAMA_API_KEY` no Render
- [ ] Criei cluster no Qdrant Cloud (Free)
- [ ] Copiei `QDRANT_URL` e `QDRANT_API_KEY` no Render
- [ ] Adicionei meu email em `UNPAYWALL_EMAIL`
- [ ] Salvei todas as variáveis no Render
- [ ] Aguardei redeploy terminar (5 min)
- [ ] Testei endpoint `/api/metrics/json`
- [ ] Sistema funcionando! 🎉

---

**Pronto! Agora seu backend tem IA 100% na nuvem sem custos!** ☁️🚀
