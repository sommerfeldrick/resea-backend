# 🌐 Guia: Ollama Cloud API

## ✅ Configuração Simplificada - Ollama Cloud

Agora seu backend usa **Ollama Cloud** em vez de rodar localmente! Muito mais simples! 🎉

---

## 🚀 Passo a Passo

### 1️⃣ Obter API Key (GRÁTIS - 1M tokens/dia)

1. Acesse: **https://ollama.com/**
2. Crie uma conta (GitHub, Google ou email)
3. Vá em: **Settings → API Keys**
4. Clique em **"Create API Key"**
5. Copie sua chave (ex: `ollama_xxxxxxxxxxxxx`)

---

### 2️⃣ Configurar no Render (Produção)

No dashboard do Render, vá em **Environment** e adicione:

```bash
OLLAMA_API_KEY=ollama_sua_chave_aqui
OLLAMA_URL=https://api.ollama.com
EMBEDDING_MODEL=nomic-embed-text
RERANKER_MODEL=llama3.2
```

---

### 3️⃣ Configurar Localmente (Development)

Crie/atualize o arquivo `.env`:

```bash
# Ollama Cloud
OLLAMA_API_KEY=ollama_sua_chave_aqui
OLLAMA_URL=https://api.ollama.com
EMBEDDING_MODEL=nomic-embed-text
RERANKER_MODEL=llama3.2
```

---

### 4️⃣ Subir apenas os serviços necessários

```bash
# Agora NÃO precisa mais do container Ollama!
docker-compose up -d

# Inicia o backend
npm run dev
```

---

## 📊 Comparação: Local vs Cloud

| Aspecto | 🖥️ Ollama Local | ☁️ Ollama Cloud |
|---------|-----------------|-----------------|
| **Setup** | Complexo (Docker, modelos) | **Simples (só API key)** ✅ |
| **Custo** | Grátis, mas usa seu hardware | **1M tokens/dia GRÁTIS** ✅ |
| **Latência** | 10-50ms (se tiver GPU) | 100-300ms |
| **Hardware** | GPU/CPU potente necessário | **Nenhum** ✅ |
| **Deploy** | Difícil (precisa GPU) | **Fácil (qualquer host)** ✅ |
| **Manutenção** | Updates manuais de modelos | **Zero** ✅ |
| **Privacidade** | 100% local | Dados enviados para Ollama |

---

## 🎯 Modelos Disponíveis

### Embeddings (Vetorização)
- ✅ `nomic-embed-text` (recomendado) - 768 dims, 8k context
- `mxbai-embed-large` - 1024 dims, 512 context
- `all-minilm` - 384 dims, 256 context

### Reranking (LLMs)
- ✅ `llama3.2` (recomendado) - 3B params
- `phi3` - 3.8B params, mais preciso
- `gemma2` - 2B params, mais rápido
- `qwen2.5` - 3B params, multilingual

---

## 🧪 Testar a API

### Teste de Embeddings
```bash
curl https://api.ollama.com/api/embeddings \
  -H "Authorization: Bearer ollama_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "neural networks for image classification"
  }'
```

### Teste de Reranking
```bash
curl https://api.ollama.com/api/generate \
  -H "Authorization: Bearer ollama_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "prompt": "Rate relevance 0-10: Query: machine learning, Document: Deep Learning Tutorial",
    "stream": false
  }'
```

---

## 📦 O que foi removido?

### ❌ Não precisa mais:
- Container Docker do Ollama
- Download de modelos (~2.5GB)
- GPU/CPU potente
- Script `init-ollama.sh`
- Script `start-ollama.sh`

### ✅ Agora só precisa:
- API Key do Ollama Cloud (grátis)
- Containers: GROBID, Redis, Qdrant
- Configurar 1 variável de ambiente: `OLLAMA_API_KEY`

---

## 🐛 Troubleshooting

### Erro: "401 Unauthorized"
```bash
# Verifique se a API key está correta
echo $OLLAMA_API_KEY

# Teste manualmente
curl https://api.ollama.com/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
```

### Erro: "Model not found"
```bash
# Modelos disponíveis no Cloud:
# - nomic-embed-text
# - mxbai-embed-large
# - llama3.2
# - phi3
# - gemma2
# - qwen2.5

# Verifique se o nome está correto no .env
```

### Mudar para HuggingFace (alternativa)
Se preferir usar HuggingFace em vez de Ollama Cloud:
```bash
# Reverter commit
git log --oneline  # Veja os commits
git revert <commit_hash>

# Configurar HuggingFace
HUGGINGFACE_API_KEY=hf_sua_chave
```

---

## 💰 Limites do Free Tier

| Provedor | Limite Diário | Limite por Minuto | Custo Excedente |
|----------|---------------|-------------------|-----------------|
| **Ollama Cloud** | 1M tokens | Sem limite | Não disponível (só free) |
| HuggingFace | 1k requests | 100 req/min | $0.0002/token |

**1M tokens = ~750k palavras = ~30k papers processados por dia**

---

## 🎓 Recursos

- **Ollama Cloud Docs**: https://ollama.com/docs/api
- **Pricing**: https://ollama.com/pricing (atualmente 100% gratuito)
- **Modelos**: https://ollama.com/library
- **Status**: https://status.ollama.com/

---

**Pronto! Agora seu backend usa IA na nuvem sem complicação!** ☁️🚀
