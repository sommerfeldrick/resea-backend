#!/usr/bin/env bash

echo "🔨 Building backend..."

# Garantir que estamos na raiz
cd /opt/render/project

# Instalar dependências
echo "📦 Installing dependencies..."
npm install

# Build
echo "🏗️ Building..."
npm run build

echo "✅ Build completed!"
