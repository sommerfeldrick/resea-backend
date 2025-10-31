#!/bin/bash

###############################################################################
# API Key Rotation Script
# Automatiza a rotação de chaves de API para segurança
#
# Usage:
#   ./scripts/rotate-api-keys.sh [service_name]
#
# Supported services:
#   - semantic-scholar
#   - ollama
#   - groq
#   - openrouter
#   - gemini
#   - all (rotaciona todas)
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVICE="${1:-all}"

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}   API Key Rotation Tool${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Check if running on Render
if [ -n "$RENDER" ]; then
  echo -e "${YELLOW}⚠️  Running on Render - Use Render Dashboard to update keys${NC}"
  echo "Visit: https://dashboard.render.com/web/[your-service]/env"
  exit 1
fi

# Function to rotate a key
rotate_key() {
  local service_name=$1
  local env_var=$2
  local api_url=$3

  echo -e "${YELLOW}🔄 Rotating: ${service_name}${NC}"
  echo "   Environment variable: ${env_var}"
  echo "   Get new key at: ${api_url}"
  echo ""

  # Read current key (masked)
  current_key=$(grep "^${env_var}=" .env 2>/dev/null | cut -d '=' -f2-)
  if [ -n "$current_key" ]; then
    masked_key="${current_key:0:8}...${current_key: -4}"
    echo "   Current key: ${masked_key}"
  else
    echo "   Current key: Not set"
  fi

  # Prompt for new key
  echo ""
  read -p "   Enter new ${service_name} API key (or press Enter to skip): " new_key

  if [ -n "$new_key" ]; then
    # Backup .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

    # Update .env
    if grep -q "^${env_var}=" .env; then
      # Replace existing
      sed -i.bak "s|^${env_var}=.*|${env_var}=${new_key}|" .env
      rm .env.bak
    else
      # Add new
      echo "${env_var}=${new_key}" >> .env
    fi

    echo -e "   ${GREEN}✅ Updated ${env_var}${NC}"
    echo "   Backup saved: .env.backup.$(date +%Y%m%d_%H%M%S)"
  else
    echo -e "   ${YELLOW}⏭️  Skipped${NC}"
  fi

  echo ""
}

# Rotate based on service
case $SERVICE in
  semantic-scholar)
    rotate_key "Semantic Scholar" "SEMANTIC_SCHOLAR_KEY" "https://www.semanticscholar.org/product/api"
    ;;

  ollama)
    rotate_key "Ollama Cloud" "OLLAMA_API_KEY" "https://ollama.com/settings/keys"
    ;;

  groq)
    rotate_key "Groq" "GROQ_API_KEY" "https://console.groq.com/keys"
    ;;

  openrouter)
    rotate_key "OpenRouter" "OPENROUTER_API_KEY" "https://openrouter.ai/keys"
    ;;

  gemini)
    rotate_key "Google Gemini" "GEMINI_API_KEY" "https://aistudio.google.com/app/apikey"
    ;;

  all)
    echo -e "${BLUE}Rotating all API keys...${NC}"
    echo ""

    rotate_key "Semantic Scholar" "SEMANTIC_SCHOLAR_KEY" "https://www.semanticscholar.org/product/api"
    rotate_key "Ollama Cloud" "OLLAMA_API_KEY" "https://ollama.com/settings/keys"
    rotate_key "Groq" "GROQ_API_KEY" "https://console.groq.com/keys"
    rotate_key "OpenRouter" "OPENROUTER_API_KEY" "https://openrouter.ai/keys"
    rotate_key "Google Gemini" "GEMINI_API_KEY" "https://aistudio.google.com/app/apikey"
    ;;

  *)
    echo -e "${RED}❌ Unknown service: ${SERVICE}${NC}"
    echo ""
    echo "Supported services:"
    echo "  - semantic-scholar"
    echo "  - ollama"
    echo "  - groq"
    echo "  - openrouter"
    echo "  - gemini"
    echo "  - all"
    exit 1
    ;;
esac

# Summary
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Rotation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the application locally: npm run dev"
echo "2. Commit .env changes to secure storage (NOT git!)"
echo "3. Update keys on Render Dashboard if using production"
echo ""
echo -e "${YELLOW}⚠️  Remember: Never commit .env to git!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
