# 🆓 Guia: APIs de IA Grátis e Baratas

## 🎯 Resumo Executivo

| Provedor | Custo | Velocidade | Qualidade | Recomendação |
|----------|-------|------------|-----------|--------------|
| **Groq** | 🟢 GRÁTIS | ⚡ Muito rápido | ⭐⭐⭐⭐ | **MELHOR CUSTO-BENEFÍCIO** |
| **Ollama** | 🟢 GRÁTIS (local) | ⚡ Rápido | ⭐⭐⭐ | Privacidade total |
| **Gemini** | 💰 Free tier | ⚡ Rápido | ⭐⭐⭐⭐⭐ | Melhor grátis online |
| **OpenAI** | 💰 Pago | 🐌 Médio | ⭐⭐⭐⭐⭐ | Mais caro |
| **Claude** | 💰 Pago | 🐌 Médio | ⭐⭐⭐⭐⭐ | Caro mas excelente |

---

## 🥇 OPÇÃO 1: Groq (RECOMENDADO) - COMPLETAMENTE GRÁTIS

### Por que Groq?
- ✅ **100% GRÁTIS** (sem cartão de crédito)
- ✅ **Extremamente rápido** (até 10x mais que GPT-4)
- ✅ Modelos poderosos (Llama 3.1, Mixtral, Gemma)
- ✅ Sem limite de requisições (apenas rate limit razoável)

### Como Obter:

1. **Acesse:** https://console.groq.com/

2. **Criar conta:**
   - Clique em "Sign Up"
   - Use Google/GitHub ou email

3. **Obter API Key:**
   - Após login, vá em "API Keys"
   - Clique em "Create API Key"
   - Copie a chave (começa com `gsk_...`)

4. **Configurar no .env:**
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave_aqui
GROQ_MODEL=llama-3.1-70b-versatile
```

### Modelos Disponíveis (GRÁTIS):
```
llama-3.1-70b-versatile    - Recomendado! Muito bom
llama-3.1-8b-instant       - Mais rápido
mixtral-8x7b-32768         - Bom contexto
gemma-7b-it                - Alternativa
```

### Limites:
- **Llama 3.1 70B:** 30 req/min, 6.000 tokens/min
- **Llama 3.1 8B:** 30 req/min, 20.000 tokens/min
- **Sem cobrança!**

---

## 🥈 OPÇÃO 2: Ollama - 100% LOCAL E GRÁTIS

### Por que Ollama?
- ✅ **Completamente grátis**
- ✅ **Privacidade total** (roda no seu computador)
- ✅ Sem limites de requisições
- ✅ Funciona offline

### Como Instalar:

#### **macOS:**
```bash
# Instalar Ollama
brew install ollama

# Iniciar serviço
ollama serve

# Baixar modelo (em outro terminal)
ollama pull llama3.2

# Ou modelo maior e melhor:
ollama pull llama3.1:70b
```

#### **Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull llama3.2
```

#### **Windows:**
1. Baixe: https://ollama.com/download
2. Instale o executável
3. Abra terminal e rode: `ollama pull llama3.2`

### Configurar no .env:
```env
AI_PROVIDER=ollama
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Modelos Recomendados:
```bash
# Leve e rápido (3GB RAM)
ollama pull llama3.2

# Médio (8GB RAM)
ollama pull llama3.1

# Poderoso (16GB+ RAM)
ollama pull llama3.1:70b

# Especialista em código
ollama pull codellama

# Brasileiro!
ollama pull maritaca
```

### Requisitos:
- **Mínimo:** 8GB RAM
- **Recomendado:** 16GB RAM
- **Ideal:** 32GB RAM + GPU

---

## 🥉 OPÇÃO 3: Google Gemini - Free Tier Generoso

### Por que Gemini?
- ✅ **Free tier muito generoso**
- ✅ Qualidade excelente
- ✅ Multimodal (texto, imagem, vídeo)
- ✅ API oficial do Google

### Como Obter:

1. **Acesse:** https://makersuite.google.com/app/apikey

2. **Login com Google**

3. **Criar API Key:**
   - Clique em "Get API key"
   - Clique em "Create API key"
   - Copie a chave

4. **Configurar no .env:**
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...sua_chave_aqui
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Modelos Disponíveis:
```
gemini-2.0-flash-exp       - GRÁTIS! Mais rápido
gemini-1.5-flash           - GRÁTIS! Bom custo-benefício
gemini-1.5-pro             - Pago, mas poderoso
```

### Limites Gratuitos:
- **15 requisições por minuto**
- **1 milhão de tokens por minuto**
- **1.500 requisições por dia**

### Preços (quando exceder free tier):
- Flash: $0.075 / 1M tokens input
- Pro: $1.25 / 1M tokens input

---

## 💰 OPÇÃO 4: OpenAI (GPT) - Pago mas Poderoso

### Por que OpenAI?
- ✅ Qualidade top
- ✅ Muito conhecido
- ❌ **PAGO** (mas tem créditos iniciais)

### Como Obter:

1. **Acesse:** https://platform.openai.com/signup

2. **Criar conta** (precisa cartão de crédito)

3. **Obter API Key:**
   - Vá em "API Keys"
   - Clique em "Create new secret key"
   - Copie (começa com `sk-...`)

4. **Configurar:**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-sua_chave_aqui
OPENAI_MODEL=gpt-4o-mini
```

### Modelos e Preços:
```
gpt-4o-mini          - $0.15 / 1M input  ⭐ MAIS BARATO
gpt-4o               - $2.50 / 1M input
gpt-4-turbo          - $10.00 / 1M input
```

### Créditos Gratuitos:
- **$5 USD** de crédito inicial (novos usuários)
- Expira em 3 meses

---

## 💎 OPÇÃO 5: Anthropic Claude - Excelente mas Caro

### Por que Claude?
- ✅ Qualidade excepcional
- ✅ Muito bom para textos longos
- ❌ **PAGO**

### Como Obter:

1. **Acesse:** https://console.anthropic.com/

2. **Criar conta**

3. **Obter API Key:**
   - Vá em "API Keys"
   - Clique em "Create Key"

4. **Configurar:**
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-sua_chave_aqui
CLAUDE_MODEL=claude-3-5-haiku-20241022
```

### Modelos e Preços:
```
claude-3-5-haiku     - $0.25 / 1M input  ⭐ MAIS BARATO
claude-3-5-sonnet    - $3.00 / 1M input
claude-3-opus        - $15.00 / 1M input
```

---

## 🎯 RECOMENDAÇÃO POR CENÁRIO

### Para Começar (Sem Gastar Nada):
```env
# Use Groq - totalmente grátis e rápido
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave_aqui
GROQ_MODEL=llama-3.1-70b-versatile
```

### Para Privacidade Total:
```env
# Use Ollama - local, sem internet
AI_PROVIDER=ollama
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.2
```

### Para Máxima Qualidade (Grátis):
```env
# Use Gemini - free tier generoso
AI_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Para Produção (Orçamento Baixo):
```env
# Use Groq ou Gemini Flash
AI_PROVIDER=groq  # ou gemini
```

### Para Máxima Qualidade (Com Orçamento):
```env
# Use GPT-4o-mini ou Claude Haiku
AI_PROVIDER=openai  # ou claude
OPENAI_MODEL=gpt-4o-mini
```

---

## 💡 DICAS PARA ECONOMIZAR

### 1. Use Web Scraping
```env
# Ative scraping para reduzir tokens em 70%
ENABLE_WEB_SCRAPING=true
```

### 2. Configure Fallback
O sistema já tem fallback automático! Se uma API falhar, tenta a próxima:
```
ollama → groq → gemini → openai → claude
```

### 3. Use Cache
```env
# Cache reduz chamadas repetidas
REDIS_ENABLED=false  # Memória já economiza muito
```

### 4. Escolha Modelos Menores
```env
# Modelos menores = mais barato
GEMINI_MODEL=gemini-2.0-flash-exp  # Não use Pro
OPENAI_MODEL=gpt-4o-mini           # Não use GPT-4
GROQ_MODEL=llama-3.1-8b-instant    # Mais rápido e grátis
```

---

## 📊 Comparação de Custos (1M tokens)

| Provedor | Modelo | Input | Output | Total* |
|----------|--------|-------|--------|--------|
| **Groq** | Llama 3.1 70B | **$0.00** | **$0.00** | **GRÁTIS** |
| **Ollama** | Llama 3.2 | **$0.00** | **$0.00** | **GRÁTIS** |
| **Gemini** | Flash | $0.075 | $0.30 | ~$0.15 |
| OpenAI | GPT-4o-mini | $0.15 | $0.60 | ~$0.30 |
| Claude | Haiku | $0.25 | $1.25 | ~$0.60 |
| OpenAI | GPT-4o | $2.50 | $10.00 | ~$5.00 |
| Claude | Opus | $15.00 | $75.00 | ~$35.00 |

*Média considerando 40% input + 60% output

---

## 🚀 Setup Rápido - Groq (GRÁTIS)

```bash
# 1. Obter chave em: https://console.groq.com/

# 2. Configurar .env
cat > backend/.env << 'EOF'
AI_PROVIDER=groq
GROQ_API_KEY=gsk_sua_chave_aqui
GROQ_MODEL=llama-3.1-70b-versatile
ENABLE_WEB_SCRAPING=true
EOF

# 3. Pronto! Totalmente grátis!
```

---

## 🔄 Como Trocar de Provedor

É super fácil! Apenas mude a variável:

```env
# Usar Groq
AI_PROVIDER=groq

# Ou Gemini
AI_PROVIDER=gemini

# Ou Ollama
AI_PROVIDER=ollama

# Etc...
```

O sistema detecta automaticamente qual está configurado!

---

## ❓ FAQ

### Posso usar múltiplos ao mesmo tempo?
Sim! O sistema tem fallback automático. Configure vários e se um falhar, usa o próximo.

### Qual o mais barato?
**Groq** e **Ollama** são 100% grátis!

### Qual o mais rápido?
**Groq** é incrivelmente rápido (até 10x mais que GPT-4).

### Qual tem melhor qualidade?
**Claude Opus** e **GPT-4** são os melhores, mas caros.
Para grátis: **Groq Llama 3.1 70B** é excelente!

### Preciso de cartão de crédito?
- **Groq:** NÃO
- **Ollama:** NÃO (roda local)
- **Gemini:** NÃO (free tier sem cartão)
- **OpenAI:** SIM
- **Claude:** SIM

---

## 📞 Links Úteis

- **Groq:** https://console.groq.com/
- **Ollama:** https://ollama.com/
- **Gemini:** https://makersuite.google.com/
- **OpenAI:** https://platform.openai.com/
- **Claude:** https://console.anthropic.com/

---

**💡 RECOMENDAÇÃO FINAL:**

**Comece com Groq (grátis) e depois teste Ollama se tiver um bom computador. Só pague se realmente precisar!**

🎉 Economia garantida com web scraping + IA grátis!
