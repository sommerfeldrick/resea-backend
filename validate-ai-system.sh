#!/bin/bash

# ============================================================
# Script de Validação - Multi-AI Provider System
# ============================================================

echo "🚀 Iniciando validação do sistema Multi-AI Provider..."
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# 1. Verificar estrutura de diretórios
# ============================================================

echo -e "${BLUE}📁 Verificando estrutura de diretórios...${NC}"

REQUIRED_DIRS=(
  "src/services/ai"
  "src/services/ai/config"
  "src/services/ai/providers"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅ $dir${NC}"
  else
    echo -e "${RED}❌ $dir não encontrado${NC}"
    exit 1
  fi
done

# ============================================================
# 2. Verificar arquivos principais
# ============================================================

echo ""
echo -e "${BLUE}📄 Verificando arquivos principais...${NC}"

REQUIRED_FILES=(
  "src/services/ai/aiService.ts"
  "src/services/ai/AIStrategyRouter.ts"
  "src/services/ai/types.ts"
  "src/services/ai/index.ts"
  "src/services/ai/config/providers.config.ts"
  "src/services/ai/providers/BaseAIProvider.ts"
  "src/services/ai/providers/GeminiProvider.ts"
  "src/services/ai/providers/GroqProvider.ts"
  "src/services/ai/providers/OpenRouterProvider.ts"
  "src/services/ai/providers/OllamaProvider.ts"
  "src/services/ai/providers/ProviderFactory.ts"
  "src/routes/ai.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $file${NC}"
  else
    echo -e "${RED}❌ $file não encontrado${NC}"
    exit 1
  fi
done

# ============================================================
# 3. Verificar dependências npm
# ============================================================

echo ""
echo -e "${BLUE}📦 Verificando dependências npm...${NC}"

REQUIRED_PACKAGES=(
  "groq-sdk"
  "openai"
  "ollama"
  "@google/generative-ai"
)

for package in "${REQUIRED_PACKAGES[@]}"; do
  if npm list "$package" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ $package${NC}"
  else
    echo -e "${YELLOW}⚠️  $package não instalado${NC}"
  fi
done

# ============================================================
# 4. Verificar TypeScript
# ============================================================

echo ""
echo -e "${BLUE}🔍 Compilando TypeScript...${NC}"

if npm run lint > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Nenhum erro de TypeScript${NC}"
else
  echo -e "${RED}❌ Erros de TypeScript encontrados${NC}"
  npm run lint
  exit 1
fi

# ============================================================
# 5. Verificar variáveis de ambiente
# ============================================================

echo ""
echo -e "${BLUE}🔐 Verificando variáveis de ambiente...${NC}"

if [ -f ".env" ]; then
  if grep -q "GEMINI_API_KEY" .env; then
    echo -e "${GREEN}✅ GEMINI_API_KEY configurada${NC}"
  else
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY não encontrada${NC}"
  fi

  if grep -q "GROQ_API_KEY" .env; then
    echo -e "${GREEN}✅ GROQ_API_KEY configurada${NC}"
  else
    echo -e "${YELLOW}⚠️  GROQ_API_KEY não encontrada${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
  echo -e "${YELLOW}   Copie .env.example para .env e configure as chaves de API${NC}"
fi

# ============================================================
# 6. Verificar documentação
# ============================================================

echo ""
echo -e "${BLUE}📚 Verificando documentação...${NC}"

DOCS=(
  "AI_PROVIDERS_SETUP.md"
  "IMPLEMENTATION_COMPLETE.md"
  "MIGRATION_GUIDE.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo -e "${GREEN}✅ $doc${NC}"
  else
    echo -e "${RED}❌ $doc não encontrado${NC}"
  fi
done

# ============================================================
# 7. Resumo Final
# ============================================================

echo ""
echo "============================================================"
echo -e "${GREEN}✅ VALIDAÇÃO COMPLETA!${NC}"
echo "============================================================"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configure as chaves de API no arquivo .env:"
echo "   - GEMINI_API_KEY (recomendado)"
echo "   - GROQ_API_KEY (recomendado)"
echo "   - OPENROUTER_API_KEY (opcional)"
echo ""
echo "2. Inicie o servidor:"
echo "   ${BLUE}npm run dev${NC}"
echo ""
echo "3. Teste a saúde do sistema:"
echo "   ${BLUE}curl http://localhost:3001/api/ai/health${NC}"
echo ""
echo "4. Veja a documentação:"
echo "   ${BLUE}cat AI_PROVIDERS_SETUP.md${NC}"
echo ""
echo "============================================================"
echo ""
