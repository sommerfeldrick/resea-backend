#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Iniciando testes de homologação...${NC}\n"

# 1. Verificar ambiente
echo -e "🔍 Verificando ambiente..."
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
    exit 1
fi

# 2. Instalar dependências
echo -e "\n📦 Instalando dependências..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao instalar dependências${NC}"
    exit 1
fi

# 3. Build do projeto
echo -e "\n🔨 Buildando o projeto..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no build${NC}"
    exit 1
fi

# 4. Rodar testes automatizados
echo -e "\n🧪 Rodando testes automatizados..."
npm test
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Falha nos testes automatizados${NC}"
    exit 1
fi

# 5. Rodar testes de integração
echo -e "\n🔄 Rodando testes de integração..."
bash scripts/test-integration.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Falha nos testes de integração${NC}"
    exit 1
fi

# 6. Verificar performance
echo -e "\n⚡ Testando performance..."
curl -w "\nTempo de resposta: %{time_total}s\n" -o /dev/null -s "http://localhost:3001/api/health"

# 7. Abrir checklist de testes manuais
echo -e "\n📋 Abrindo checklist de testes manuais..."
if command -v code &> /dev/null; then
    code scripts/manual-test-checklist.md
else
    echo "Por favor, abra manualmente: scripts/manual-test-checklist.md"
fi

echo -e "\n${GREEN}✅ Setup de testes completo!${NC}"
echo -e "${YELLOW}Por favor, complete o checklist de testes manuais antes de fazer deploy.${NC}"

# Instruções finais
echo -e "\n📝 Próximos passos:"
echo "1. Complete o checklist de testes manuais"
echo "2. Verifique os logs de erro"
echo "3. Valide a performance"
echo "4. Faça backup do banco de dados"
echo "5. Prepare o plano de rollback"

echo -e "\n${YELLOW}Quando terminar os testes, execute:${NC}"
echo "npm run build && npm run deploy"
