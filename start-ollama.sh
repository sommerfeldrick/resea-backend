#!/bin/bash

echo "🚀 Iniciando Ollama e todos os serviços..."
echo ""

# 1. Verifica se Docker está rodando
echo "🔍 Verificando Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando!"
    echo "💡 Iniciando Docker Desktop..."
    open -a Docker
    echo "⏳ Aguardando Docker inicializar (30 segundos)..."
    sleep 30
fi

# 2. Sobe os containers
echo ""
echo "🐳 Subindo containers..."
docker-compose up -d

# 3. Aguarda containers ficarem saudáveis
echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 10

# 4. Verifica status
echo ""
echo "📊 Status dos containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 5. Verifica Ollama
echo ""
echo "🤖 Verificando Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama está respondendo!"
else
    echo "⚠️ Ollama ainda não está pronto, aguarde mais um momento"
    exit 1
fi

# 6. Baixa modelos
echo ""
echo "📥 Baixando modelos de IA..."
echo "   Isso pode levar 5-10 minutos na primeira vez"
echo ""

echo "1/2 📦 Baixando nomic-embed-text (~274MB)..."
docker exec resea-ollama ollama pull nomic-embed-text

echo ""
echo "2/2 📦 Baixando llama3.2:3b (~2GB)..."
docker exec resea-ollama ollama pull llama3.2:3b

# 7. Lista modelos instalados
echo ""
echo "✅ Modelos disponíveis:"
docker exec resea-ollama ollama list

echo ""
echo "============================================================"
echo "🎉 Ollama está pronto!"
echo "============================================================"
echo ""
echo "💡 Próximo passo: npm run dev"
echo ""
