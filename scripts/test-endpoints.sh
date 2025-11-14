#!/bin/bash

# Script de Teste de Endpoints do Resea AI
# Verifica o status de todos os endpoints principais

API_URL="${API_URL:-https://resea-backend.onrender.com}"
TOKEN="${TOKEN:-}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================================="
echo "🔍 DIAGNÓSTICO DE ENDPOINTS - RESEA AI"
echo "=================================================="
echo ""
echo "API URL: $API_URL"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local auth=$4
    local data=$5

    echo -n "Testing $method $endpoint... "

    if [ "$auth" == "true" ]; then
        if [ -z "$TOKEN" ]; then
            echo -e "${YELLOW}SKIP${NC} (sem token)"
            return
        fi
        headers="-H 'Authorization: Bearer $TOKEN'"
    else
        headers=""
    fi

    if [ -n "$data" ]; then
        headers="$headers -H 'Content-Type: application/json'"
        curl_cmd="curl -s -w '%{http_code}' -o /dev/null $headers -X $method -d '$data' $API_URL$endpoint"
    else
        curl_cmd="curl -s -w '%{http_code}' -o /dev/null $headers -X $method $API_URL$endpoint"
    fi

    http_code=$(eval $curl_cmd)

    case $http_code in
        200|201)
            echo -e "${GREEN}✓ $http_code${NC} - $description"
            ;;
        401|403)
            echo -e "${YELLOW}⚠ $http_code${NC} - Auth Required - $description"
            ;;
        404)
            echo -e "${RED}✗ $http_code${NC} - Not Found - $description"
            ;;
        500|502|503)
            echo -e "${RED}✗ $http_code${NC} - Server Error - $description"
            ;;
        000)
            echo -e "${RED}✗ OFFLINE${NC} - Cannot Connect - $description"
            ;;
        *)
            echo -e "${YELLOW}? $http_code${NC} - $description"
            ;;
    esac
}

echo "=================================================="
echo "📊 SISTEMA DE CRÉDITOS"
echo "=================================================="
test_endpoint "GET" "/api/user/credits" "Créditos do usuário (local)" "true"
test_endpoint "GET" "/api/research/credits" "Créditos híbrido (SmileAI + local)" "true"
test_endpoint "GET" "/api/research/credits/history" "Histórico de uso" "true"

echo ""
echo "=================================================="
echo "🔐 AUTENTICAÇÃO"
echo "=================================================="
test_endpoint "GET" "/api/health" "Health check (público)" "false"
test_endpoint "GET" "/api/auth/me" "Dados do usuário logado" "true"

echo ""
echo "=================================================="
echo "🎯 RESEARCH FLOW - 8 FASES"
echo "=================================================="

# Fase 2
test_endpoint "POST" "/api/research-flow/clarification/generate" "Fase 2: Gerar perguntas" "true" '{"query":"teste"}'
test_endpoint "POST" "/api/research-flow/clarification/process" "Fase 2: Processar respostas" "true" '{"sessionId":"test","answers":[]}'

# Fase 3
test_endpoint "POST" "/api/research-flow/strategy/generate" "Fase 3: Gerar estratégia" "true" '{"query":"teste","clarificationSummary":"teste"}'

# Fase 4
echo -n "Testing POST /api/research-flow/search/execute (SSE)... "
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}SKIP${NC} (sem token)"
else
    http_code=$(curl -s -w '%{http_code}' -o /dev/null \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -X POST \
        -d '{"strategy":{"topic":"teste","searchTerms":[],"databases":[]}}' \
        $API_URL/api/research-flow/search/execute)

    case $http_code in
        200|201) echo -e "${GREEN}✓ $http_code${NC} - Fase 4: Busca exaustiva (SSE)" ;;
        401|403) echo -e "${YELLOW}⚠ $http_code${NC} - Auth Required" ;;
        *) echo -e "${YELLOW}? $http_code${NC} - Fase 4: Busca exaustiva (SSE)" ;;
    esac
fi

# Fase 5
test_endpoint "POST" "/api/research-flow/analysis/analyze" "Fase 5: Análise de artigos" "true" '{"articles":[],"query":"teste"}'

# Fase 6
echo -n "Testing POST /api/research-flow/generation/generate (SSE)... "
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}SKIP${NC} (sem token)"
else
    http_code=$(curl -s -w '%{http_code}' -o /dev/null \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -X POST \
        -d '{"config":{"section":"Introdução"},"articles":[],"query":"teste"}' \
        $API_URL/api/research-flow/generation/generate)

    case $http_code in
        200|201) echo -e "${GREEN}✓ $http_code${NC} - Fase 6: Geração de conteúdo (SSE)" ;;
        401|403) echo -e "${YELLOW}⚠ $http_code${NC} - Auth Required" ;;
        *) echo -e "${YELLOW}? $http_code${NC} - Fase 6: Geração de conteúdo (SSE)" ;;
    esac
fi

echo -n "Testing POST /api/research-flow/generation/complete (SSE + CREDITS)... "
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}SKIP${NC} (sem token)"
else
    http_code=$(curl -s -w '%{http_code}' -o /dev/null \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -X POST \
        -d '{"config":{},"articles":[],"query":"teste"}' \
        $API_URL/api/research-flow/generation/complete)

    case $http_code in
        200|201) echo -e "${GREEN}✓ $http_code${NC} - Fase 6: Documento completo (SSE + DESCONTA CRÉDITOS)" ;;
        401|403) echo -e "${YELLOW}⚠ $http_code${NC} - Auth Required" ;;
        *) echo -e "${YELLOW}? $http_code${NC} - Fase 6: Documento completo (SSE + DESCONTA CRÉDITOS)" ;;
    esac
fi

# Fase 7
test_endpoint "POST" "/api/research-flow/editing/process" "Fase 7: Edição interativa" "true" '{"request":{},"currentContent":"teste","articles":[]}'

# Fase 8
test_endpoint "POST" "/api/research-flow/export/verify" "Fase 8: Verificação de qualidade" "true" '{"content":"teste","articles":[]}'

echo ""
echo "=================================================="
echo "📄 DOCUMENTOS"
echo "=================================================="
test_endpoint "GET" "/api/documents" "Listar documentos" "true"

echo ""
echo "=================================================="
echo "✅ RESUMO"
echo "=================================================="
echo ""
echo "Para executar com autenticação:"
echo "  export TOKEN='seu_token_aqui'"
echo "  ./scripts/test-endpoints.sh"
echo ""
echo "Para testar em outro ambiente:"
echo "  export API_URL='http://localhost:3001'"
echo "  export TOKEN='seu_token_aqui'"
echo "  ./scripts/test-endpoints.sh"
echo ""
echo "=================================================="
