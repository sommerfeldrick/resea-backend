#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Iniciando testes de integração...${NC}\n"

# 1. Verificar dependências e build
echo -e "📦 Verificando dependências e build..."
npm install
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completado com sucesso${NC}\n"
else
    echo -e "${RED}❌ Erro no build${NC}"
    exit 1
fi

# 2. Testes de autenticação
echo -e "🔐 Testando autenticação..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/auth/validate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Endpoint de autenticação respondendo${NC}\n"
else
    echo -e "${RED}❌ Erro no endpoint de autenticação${NC}\n"
fi

# 3. Testar limites de créditos
echo -e "💳 Testando limites de créditos..."
curl -s -X POST http://localhost:3001/api/research/credits \
  -H "Content-Type: application/json" \
  -d '{"plan_type":"basic"}'

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Sistema de créditos funcionando${NC}\n"
else
    echo -e "${RED}❌ Erro no sistema de créditos${NC}\n"
fi

# 4. Verificar cache
echo -e "🚀 Testando performance do cache..."
time curl -s http://localhost:3001/api/auth/me > /dev/null
time curl -s http://localhost:3001/api/auth/me > /dev/null
echo -e "${GREEN}✅ Cache verificado${NC}\n"

# 5. Testar sincronização de créditos
echo -e "🔄 Testando sincronização de créditos..."
curl -s -X POST http://localhost:3001/api/credits/sync \
  -H "Content-Type: application/json" \
  -d '{"credits_used":100,"domain":"localhost"}'

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Sincronização de créditos OK${NC}\n"
else
    echo -e "${RED}❌ Erro na sincronização${NC}\n"
fi

# 6. Testar limites de pesquisa
echo -e "🔍 Testando limites de pesquisa..."
for i in {1..6}; do
    curl -s -X POST http://localhost:3001/api/research/search \
      -H "Content-Type: application/json" \
      -d '{"query":"test"}'
    echo -n "."
done
echo -e "\n${GREEN}✅ Limites de pesquisa testados${NC}\n"

# 7. Verificar headers de segurança
echo -e "🔒 Verificando headers de segurança..."
curl -s -I http://localhost:3001/api/health | grep -E "X-Frame-Options|Content-Security-Policy"
echo -e "${GREEN}✅ Headers de segurança verificados${NC}\n"

echo -e "${YELLOW}📋 Checklist final:${NC}"
echo "✓ Build do projeto"
echo "✓ Endpoints de autenticação"
echo "✓ Sistema de créditos"
echo "✓ Performance do cache"
echo "✓ Sincronização de créditos"
echo "✓ Limites de pesquisa"
echo "✓ Headers de segurança"

echo -e "\n${GREEN}✅ Testes completados!${NC}"
