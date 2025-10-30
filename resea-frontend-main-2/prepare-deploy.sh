#!/bin/bash

# ========================================
# Resea AI - Deployment Preparation Script
# ========================================
# Este script prepara o aplicativo para deploy no Hostinger
# Cria ZIPs otimizados do backend e frontend

set -e  # Exit on error

echo "🚀 Preparando aplicativo para deploy..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# 1. Verificações Iniciais
# ========================================

echo "📋 Verificando estrutura do projeto..."

if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Pasta 'backend' não encontrada!${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json do frontend não encontrado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Estrutura do projeto OK${NC}"
echo ""

# ========================================
# 2. Preparar Backend
# ========================================

echo "📦 Preparando Backend..."

cd backend

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Instalando dependências do backend...${NC}"
    npm install
fi

# Build TypeScript
echo "🔨 Compilando TypeScript..."
npm run build

# Verificar se dist foi criado
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build falhou! Pasta 'dist' não foi criada.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend compilado com sucesso${NC}"

# Criar .env.example atualizado se não existir
if [ ! -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  Criando .env.example...${NC}"
    cat > .env.example << 'EOF'
# Server Configuration
PORT=3001
FRONTEND_URL=https://app.smileai.com.br
NODE_ENV=production

# OAuth Configuration (smileai.com.br)
MAIN_DOMAIN_API=https://smileai.com.br/api
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8

# AI Provider (escolha UM)
AI_PROVIDER=groq

# Groq (GRÁTIS! Muito rápido) ⭐ RECOMENDADO
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-70b-versatile

# Ollama (Local, 100% grátis)
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Gemini (Free tier)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash-exp

# OpenAI (Pago)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Claude (Pago)
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-3-5-haiku-20241022

# Web Scraping - Economize tokens
ENABLE_WEB_SCRAPING=true

# Cache (Redis opcional)
REDIS_URL=redis://localhost:6379
CACHE_TYPE=memory

# Academic Search
MAX_SEARCH_RESULTS=20
ENABLE_CIRCUIT_BREAKER=true
EOF
fi

cd ..

echo -e "${GREEN}✅ Backend pronto${NC}"
echo ""

# ========================================
# 3. Preparar Frontend
# ========================================

echo "📦 Preparando Frontend..."

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Instalando dependências do frontend...${NC}"
    npm install
fi

# Build Vite
echo "🔨 Compilando Frontend (Vite)..."
npm run build

# Verificar se dist foi criado
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build do frontend falhou! Pasta 'dist' não foi criada.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend compilado com sucesso${NC}"

# Criar .env.example se não existir
if [ ! -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  Criando .env.example do frontend...${NC}"
    cat > .env.example << 'EOF'
VITE_API_URL=https://app.smileai.com.br/api
EOF
fi

echo ""

# ========================================
# 4. Criar ZIPs para Upload
# ========================================

echo "📦 Criando arquivos ZIP para deploy..."

# Criar pasta de deploy
mkdir -p deploy-package

# Backend ZIP
echo "  → Criando backend.zip..."
cd backend

# Incluir apenas arquivos necessários
zip -r ../deploy-package/backend.zip \
    dist/ \
    node_modules/ \
    package.json \
    package-lock.json \
    .env.example \
    -x "*.log" "*.env" "node_modules/.cache/*" \
    > /dev/null 2>&1

cd ..

# Frontend ZIP
echo "  → Criando frontend.zip..."
zip -r deploy-package/frontend.zip \
    dist/ \
    package.json \
    .env.example \
    -x "*.log" "*.env" \
    > /dev/null 2>&1

# Docs ZIP (opcional)
echo "  → Criando docs.zip..."
zip -r deploy-package/docs.zip \
    README.md \
    QUICKSTART.md \
    INTEGRATION_COMPLETE.md \
    NOVAS_FEATURES.md \
    GUIA_API_GRATIS.md \
    INSTALL_VIA_HOSTINGER_FILE_MANAGER.md \
    > /dev/null 2>&1

echo -e "${GREEN}✅ ZIPs criados em ./deploy-package/${NC}"
echo ""

# ========================================
# 5. Estatísticas
# ========================================

echo "📊 Estatísticas dos Pacotes:"
echo ""

du -h deploy-package/backend.zip | awk '{print "  Backend:  " $1}'
du -h deploy-package/frontend.zip | awk '{print "  Frontend: " $1}'
du -h deploy-package/docs.zip | awk '{print "  Docs:     " $1}'

echo ""
echo -e "${GREEN}✅ Preparação completa!${NC}"
echo ""

# ========================================
# 6. Próximos Passos
# ========================================

echo "📋 Próximos passos:"
echo ""
echo "1. Acesse o Gerenciador de Arquivos do Hostinger"
echo "   URL: https://hpanel.hostinger.com/file-manager"
echo ""
echo "2. Navegue até:"
echo "   /domains/app.smileai.com.br/public_html/"
echo ""
echo "3. Faça upload dos ZIPs:"
echo "   - backend.zip  → pasta raiz"
echo "   - frontend.zip → pasta raiz"
echo ""
echo "4. Extraia os ZIPs no Hostinger"
echo ""
echo "5. Configure o .env do backend:"
echo "   - Copie .env.example para .env"
echo "   - Configure pelo menos 1 API key de IA"
echo ""
echo "6. Via SSH, instale as dependências:"
echo "   cd /domains/app.smileai.com.br/public_html/backend"
echo "   npm install --production"
echo ""
echo "7. Inicie o backend com PM2:"
echo "   pm2 start dist/server.js --name resea-backend"
echo ""
echo "📁 Arquivos criados em: ./deploy-package/"
echo ""
echo -e "${GREEN}🎉 Pronto para deploy!${NC}"
echo ""
echo "📖 Leia: INSTALL_VIA_HOSTINGER_FILE_MANAGER.md para mais detalhes"
echo ""
