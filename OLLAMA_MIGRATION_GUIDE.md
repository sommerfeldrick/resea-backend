# 🤖 Guia de Migração: HuggingFace → Ollama

## Por que migrar para Ollama?

### ✅ Vantagens do Ollama
- **100% Gratuito**: Sem limites de API, sem custos
- **Privacidade Total**: Seus dados nunca saem do seu servidor
- **Baixa Latência**: Modelos rodando localmente
- **Sem Dependências Externas**: Não precisa de internet para funcionar
- **Controle Total**: Escolha qualquer modelo da biblioteca Ollama

### ❌ Desvantagens do HuggingFace
- **Limites de Rate**: 1000 requests/dia na API gratuita
- **Latência de Rede**: Depende de internet e servidores externos
- **Privacidade**: Seus dados são enviados para servidores da HuggingFace
- **Custo**: Pode gerar custos se ultrapassar o free tier

---

## 📦 O que foi mudado?

### 1. **Serviços Modificados**
- ✅ `src/services/embeddings.service.ts` - Agora usa Ollama API
- ✅ `src/services/reranker.service.ts` - Agora usa Ollama para reranking
- ✅ `docker-compose.yml` - Adicionado container Ollama
- ✅ `.env.example` - Removidas variáveis do HuggingFace

### 2. **Novos Modelos**
| Função | Modelo Anterior (HF) | Modelo Novo (Ollama) |
|--------|----------------------|----------------------|
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (384 dims) | `nomic-embed-text` (768 dims) |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | `llama3.2:3b` |

### 3. **Dependências Removidas**
```bash
# ANTES:
npm install @huggingface/inference

# DEPOIS:
# Nada! Usa apenas axios (já instalado)
```

---

## 🚀 Como usar?

### Passo 1: Subir o Ollama
```bash
# Inicia todos os containers (incluindo Ollama)
docker-compose up -d

# Verifica se Ollama está rodando
curl http://localhost:11434/api/tags
```

### Passo 2: Baixar os modelos
```bash
# Executa script automático
./scripts/init-ollama.sh

# OU manualmente:
docker exec -it resea-ollama ollama pull nomic-embed-text
docker exec -it resea-ollama ollama pull llama3.2:3b
```

**Tempo estimado**: 5-10 minutos (depende da internet)  
**Espaço em disco**: ~2.5GB total

### Passo 3: Atualizar variáveis de ambiente
```bash
# .env
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
RERANKER_MODEL=llama3.2:3b

# REMOVER (não precisa mais):
# HUGGINGFACE_API_KEY=xxx
```

### Passo 4: Iniciar o backend
```bash
npm run dev
```

---

## 🔧 Modelos Alternativos

### Embeddings
| Modelo | Dimensões | Contexto | Tamanho | Recomendação |
|--------|-----------|----------|---------|--------------|
| `nomic-embed-text` | 768 | 8192 | 274MB | ⭐ **Recomendado** (melhor qualidade) |
| `mxbai-embed-large` | 1024 | 512 | 669MB | Para textos curtos |
| `all-minilm` | 384 | 256 | 45MB | Mais rápido, menos preciso |

### Reranking
| Modelo | Parâmetros | Tamanho | Velocidade | Recomendação |
|--------|-----------|---------|------------|--------------|
| `llama3.2:3b` | 3B | 2GB | Rápido | ⭐ **Recomendado** (melhor custo-benefício) |
| `phi3:mini` | 3.8B | 2.3GB | Médio | Mais preciso |
| `gemma2:2b` | 2B | 1.6GB | Muito rápido | Para servidores pequenos |
| `qwen2.5:3b` | 3B | 1.9GB | Rápido | Boa alternativa |

**Como trocar:**
```bash
# Baixar novo modelo
docker exec -it resea-ollama ollama pull phi3:mini

# Atualizar .env
RERANKER_MODEL=phi3:mini

# Reiniciar backend
npm run dev
```

---

## 🖥️ Requisitos de Hardware

### Mínimo (Development)
- **CPU**: 4 cores
- **RAM**: 8GB
- **Disco**: 5GB livres
- **GPU**: Não obrigatória (roda em CPU)

### Recomendado (Production)
- **CPU**: 8+ cores
- **RAM**: 16GB
- **Disco**: 10GB livres
- **GPU**: NVIDIA com 4GB+ VRAM (opcional, acelera 10x)

### Com GPU NVIDIA
```yaml
# docker-compose.yml (já configurado)
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

---

## 📊 Performance Comparison

### Latência (avg)
| Operação | HuggingFace API | Ollama (CPU) | Ollama (GPU) |
|----------|-----------------|--------------|--------------|
| Embeddings (1 texto) | 200-500ms | 50-100ms | 10-20ms |
| Reranking (100 docs) | 5-10s | 2-4s | 500ms-1s |
| Batch (10 textos) | 2-4s | 500ms-1s | 100-200ms |

### Throughput
| Métrica | HuggingFace | Ollama |
|---------|-------------|---------|
| Requests/hora | 1000 (limite) | **Ilimitado** ✅ |
| Custo/1M tokens | $0.05+ | **$0** ✅ |
| Privacidade | ⚠️ Dados enviados | ✅ 100% local |

---

## 🐛 Troubleshooting

### Erro: "Ollama não está acessível"
```bash
# Verificar se container está rodando
docker ps | grep ollama

# Ver logs
docker logs resea-ollama

# Reiniciar
docker-compose restart ollama
```

### Erro: "Model not found"
```bash
# Listar modelos instalados
docker exec -it resea-ollama ollama list

# Baixar modelo faltando
docker exec -it resea-ollama ollama pull nomic-embed-text
```

### Performance lenta
```bash
# Verificar uso de recursos
docker stats resea-ollama

# Aumentar memória (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 8G
```

### Quer usar GPU mas não detecta
```bash
# Verificar NVIDIA Docker runtime
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Instalar nvidia-container-toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
```

---

## 🌐 Deploy em Produção (Render.com)

### Opção 1: Ollama no mesmo container (simples)
```dockerfile
# Dockerfile
FROM node:20-alpine

# Instalar Ollama
RUN apk add --no-cache curl bash
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Iniciar Ollama em background
CMD ollama serve & npm start
```

**Limitações**: Requer Render Pro ($25/mês) para 4GB+ RAM

### Opção 2: Ollama externo (recomendado)
1. Hospede Ollama em outro servidor (AWS EC2, DigitalOcean, etc)
2. Configure `OLLAMA_URL=https://seu-ollama.exemplo.com`
3. Use Render Free tier para backend

### Opção 3: Voltar para HuggingFace (fallback)
Se não conseguir rodar Ollama em produção:
```bash
# Reverta o commit
git revert HEAD

# Configure HuggingFace
HUGGINGFACE_API_KEY=your_key_here
```

---

## 🎯 Próximos Passos

- [ ] Subir containers: `docker-compose up -d`
- [ ] Baixar modelos: `./scripts/init-ollama.sh`
- [ ] Testar embeddings: `curl -X POST http://localhost:3001/api/search/hybrid`
- [ ] Monitorar performance: `docker stats resea-ollama`
- [ ] (Opcional) Configurar GPU para acelerar

---

## 📚 Recursos Úteis

- **Ollama Library**: https://ollama.ai/library
- **Embedding Models**: https://ollama.ai/search?c=embedding
- **Ollama Docker**: https://hub.docker.com/r/ollama/ollama
- **Nomic Embed Text**: https://ollama.ai/library/nomic-embed-text
- **Llama 3.2**: https://ollama.ai/library/llama3.2

---

**Dúvidas?** Abra uma issue ou consulte a documentação do Ollama.
