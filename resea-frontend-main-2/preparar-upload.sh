#!/bin/bash

# ============================================================
# Script de Preparação para Upload - Resea AI
# ============================================================
# Compila o frontend e prepara estrutura para upload

set -e

echo "🚀 Preparando arquivos para upload..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================
# 1. Criar estrutura
# ============================================================

echo "📁 Criando estrutura de pastas..."
mkdir -p PARA_UPLOAD/public_html/backend

# ============================================================
# 2. Compilar Frontend
# ============================================================

echo "📦 Compilando frontend..."

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Instalando dependências do frontend...${NC}"
    npm install
fi

echo "🔨 Compilando React (Vite)..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build do frontend falhou! Pasta 'dist' não foi criada.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend compilado com sucesso${NC}"

# ============================================================
# 3. Copiar Frontend
# ============================================================

echo "📋 Copiando frontend compilado..."
cp -r dist/* PARA_UPLOAD/public_html/

echo -e "${GREEN}✅ Frontend copiado${NC}"

# ============================================================
# 4. Copiar Backend
# ============================================================

echo "📋 Copiando backend..."
cp -r backend/src PARA_UPLOAD/public_html/backend/
cp backend/package.json PARA_UPLOAD/public_html/backend/
cp backend/tsconfig.json PARA_UPLOAD/public_html/backend/
cp backend/.env PARA_UPLOAD/public_html/backend/
cp backend/.env.production PARA_UPLOAD/public_html/backend/

echo -e "${GREEN}✅ Backend copiado${NC}"

# ============================================================
# 5. Criar README
# ============================================================

cat > PARA_UPLOAD/README.txt << 'EOF'
================================================================================
RESEA AI - PRONTO PARA UPLOAD
================================================================================

ESTRUTURA:
/public_html/
├── index.html              Frontend (React compilado)
├── assets/                 JS, CSS, imagens
└── backend/                API Node.js

================================================================================
UPLOAD:
================================================================================

1. Compactar:
   zip -r para_upload.zip public_html/

2. Upload para Hostinger:
   - File Manager → /domains/app.smileai.com.br/
   - Upload para_upload.zip
   - Extrair
   - Mover conteúdo de public_html/ extraído para public_html/ real

3. Via SSH:
   cd /domains/app.smileai.com.br/public_html/backend
   npm install --production
   npm run build
   nano .env (adicionar chave Groq na linha 20)
   pm2 start dist/server.js --name resea-backend
   pm2 save

================================================================================
OBTER CHAVE GROQ (GRÁTIS):
================================================================================

https://console.groq.com/

================================================================================
TESTAR:
================================================================================

curl http://localhost:3001/api/health

Deve retornar: {"status":"ok"}

================================================================================
PRONTO!
================================================================================

Acesse: https://app.smileai.com.br

EOF

echo -e "${GREEN}✅ README criado${NC}"

# ============================================================
# 6. Criar ZIP
# ============================================================

echo "📦 Criando arquivo ZIP..."
cd PARA_UPLOAD
zip -r ../para_upload.zip public_html/ README.txt > /dev/null 2>&1
cd ..

echo -e "${GREEN}✅ ZIP criado: para_upload.zip${NC}"

# ============================================================
# 7. Estatísticas
# ============================================================

echo ""
echo "📊 Estatísticas:"
echo ""
du -h para_upload.zip | awk '{print "  Tamanho do ZIP: " $1}'
echo "  Arquivos prontos em: PARA_UPLOAD/"
echo ""

# ============================================================
# 8. Instruções
# ============================================================

echo -e "${GREEN}✅ TUDO PRONTO!${NC}"
echo ""
echo "📤 Próximos passos:"
echo ""
echo "1. Arquivo criado: para_upload.zip"
echo "2. Fazer upload para Hostinger"
echo "3. Extrair em: /domains/app.smileai.com.br/"
echo "4. Via SSH:"
echo "   cd backend"
echo "   npm install --production"
echo "   npm run build"
echo "   nano .env (adicionar chave Groq)"
echo "   pm2 start dist/server.js --name resea-backend"
echo ""
echo "📖 Leia: PARA_UPLOAD/LEIA_ME_PRIMEIRO.md"
echo ""
echo -e "${GREEN}🎉 Sucesso!${NC}"
echo ""
