#!/bin/bash

# ============================================================
# Script de Inicialização do Ollama
# Baixa os modelos necessários para embeddings e reranking
# ============================================================

set -e

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-nomic-embed-text}"
RERANKER_MODEL="${RERANKER_MODEL:-llama3.2:3b}"

echo "🤖 Inicializando Ollama..."
echo "📍 URL: $OLLAMA_URL"
echo ""

# Verifica se Ollama está rodando
echo "🔍 Verificando conexão com Ollama..."
if ! curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "❌ Ollama não está acessível em $OLLAMA_URL"
    echo ""
    echo "💡 Certifique-se de que o Ollama está rodando:"
    echo "   docker-compose up -d ollama"
    exit 1
fi

echo "✅ Ollama está rodando!"
echo ""

# Baixa modelo de embeddings
echo "📥 Baixando modelo de embeddings: $EMBEDDING_MODEL"
echo "   Tamanho aproximado: ~274MB"
echo ""

docker exec -it resea-ollama ollama pull "$EMBEDDING_MODEL"

if [ $? -eq 0 ]; then
    echo "✅ Modelo de embeddings baixado com sucesso!"
else
    echo "❌ Erro ao baixar modelo de embeddings"
    exit 1
fi

echo ""

# Baixa modelo de reranking
echo "📥 Baixando modelo de reranking: $RERANKER_MODEL"
echo "   Tamanho aproximado: ~2GB"
echo ""

docker exec -it resea-ollama ollama pull "$RERANKER_MODEL"

if [ $? -eq 0 ]; then
    echo "✅ Modelo de reranking baixado com sucesso!"
else
    echo "❌ Erro ao baixar modelo de reranking"
    exit 1
fi

echo ""
echo "============================================================"
echo "🎉 Ollama configurado com sucesso!"
echo "============================================================"
echo ""
echo "📊 Modelos disponíveis:"
docker exec -it resea-ollama ollama list
echo ""
echo "💾 Espaço em disco utilizado:"
docker exec -it resea-ollama du -sh /root/.ollama
echo ""
echo "✨ Pronto para uso! Inicie o backend com: npm run dev"
echo ""
