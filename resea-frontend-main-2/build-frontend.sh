#!/bin/bash

# Script para fazer build do frontend Resea AI
# Execute: bash build-frontend.sh

echo "🚀 Iniciando build do frontend Resea AI..."
echo ""

# Navegar para o diretório do projeto
cd /Users/usuario/Downloads/resea-ai-research-assistant

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ NPM não encontrado!"
    echo ""
    echo "Por favor, instale o Node.js primeiro:"
    echo "https://nodejs.org/"
    exit 1
fi

echo "✅ NPM encontrado: $(npm --version)"
echo "✅ Node encontrado: $(node --version)"
echo ""

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências"
        exit 1
    fi
    echo ""
fi

# Fazer o build
echo "🔨 Fazendo build do frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build concluído com sucesso!"
    echo "📁 Arquivos gerados em: ./dist"
    echo ""
    echo "Próximo passo: fazer upload da pasta 'dist' para o servidor"
else
    echo ""
    echo "❌ Erro ao fazer build"
    exit 1
fi
