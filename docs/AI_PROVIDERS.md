# 🤖 Múltiplos Provedores de IA - Guia Completo

## ❓ Por que apenas Gemini funciona?

**Resposta:** Apenas o Gemini está configurado no Render. Os outros providers precisam de API keys.

---

## 📊 Status Atual dos Providers

### ✅ Gemini (Funcionando)
- **Status:** Configurado e ativo
- **Modelo:** `gemini-2.0-flash`
- **Custo:** Free tier generoso (1500 requests/dia)
- **Velocidade:** Rápida
- **Qualidade:** Excelente para textos acadêmicos

### ❌ Groq (Não Configurado)
- **Status:** API key não definida
- **Modelo:** `llama-3.1-70b-versatile`
- **Custo:** **GRÁTIS** (14,400 tokens/min)
- **Velocidade:** **MUITO RÁPIDA** (18x mais rápido que OpenAI)
- **Qualidade:** Boa
- **Como obter:** https://console.groq.com/keys

### ❌ OpenAI (Não Configurado)
- **Status:** API key não definida
- **Modelo:** `gpt-4o-mini`
- **Custo:** Pago ($0.15/1M tokens input, $0.60/1M tokens output)
- **Velocidade:** Média
- **Qualidade:** Excelente
- **Como obter:** https://platform.openai.com/api-keys

### ❌ Claude (Não Configurado)
- **Status:** API key não definida
- **Modelo:** `claude-3-5-haiku-20241022`
- **Custo:** Pago ($0.25/1M tokens input, $1.25/1M tokens output)
- **Velocidade:** Rápida
- **Qualidade:** Excelente (melhor para textos longos)
- **Como obter:** https://console.anthropic.com/settings/keys

### ❌ Ollama (Não Configurado)
- **Status:** Desabilitado (requer servidor local)
- **Modelo:** `llama3.2`
- **Custo:** **GRÁTIS** (100% local)
- **Velocidade:** Depende do hardware
- **Qualidade:** Boa
- **Como usar:** Instalar Ollama localmente

---

## 🎯 Recomendação de Configuração

### Para Uso Gratuito:
```bash
# No Render, adicione:
GROQ_API_KEY=gsk_xxxxxxxxxxxxx  # Obtenha em console.groq.com
GEMINI_API_KEY=AIzaSyxxxxxxxxx  # Já configurada ✅
```

### Para Máxima Qualidade (Pago):
```bash
CLAUDE_API_KEY=sk-ant-xxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxx
```

---

## 🔄 Como o Sistema Escolhe o Provider

### Ordem de Prioridade (do mais barato para o mais caro):
1. **Ollama** (local, grátis) - Se `OLLAMA_ENABLED=true`
2. **Groq** (grátis, rápido) - Se `GROQ_API_KEY` configurada
3. **Gemini** (free tier) - Se `GEMINI_API_KEY` configurada ✅
4. **OpenAI** (pago) - Se `OPENAI_API_KEY` configurada
5. **Claude** (pago) - Se `CLAUDE_API_KEY` configurada

### Fallback Automático:
```typescript
// Se Groq falhar → tenta Gemini
// Se Gemini falhar → tenta OpenAI
// Se OpenAI falhar → tenta Claude
// Se todos falharem → erro
```

**Atualmente:** Como apenas Gemini está configurada, não há fallback.

---

## ⚙️ Como Configurar Múltiplos Providers

### 1. **Groq (RECOMENDADO - Grátis e Rápido)**

```bash
# 1. Obtenha a API key
https://console.groq.com/keys

# 2. Adicione no Render
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# 3. (Opcional) Defina como preferencial
AI_PROVIDER=groq
```

### 2. **OpenAI (Pago, mas Poderoso)**

```bash
# 1. Obtenha a API key
https://platform.openai.com/api-keys

# 2. Adicione no Render
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini  # Ou gpt-4o para melhor qualidade
```

### 3. **Claude (Pago, Excelente para Textos Longos)**

```bash
# 1. Obtenha a API key
https://console.anthropic.com/settings/keys

# 2. Adicione no Render
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
CLAUDE_MODEL=claude-3-5-haiku-20241022  # Ou claude-3-5-sonnet para melhor qualidade
```

---

## 🔍 Verificar Qual Provider Está Ativo

### Nos Logs do Render:
```
✅ Busque por:
"Generating text" → mostra qual provider foi usado

Exemplo:
2025-10-31 19:54:09 [info]: Generating text
  {
    "provider": "gemini",  ← Aqui!
    "promptLength": 3263
  }
```

### Via Health Check:
```bash
curl https://api.smileai.com.br/api/health/ai
```

Retorna:
```json
{
  "health": {
    "gemini": { "available": true, "latency": 234 },
    "groq": { "available": false, "error": "API key not configured" },
    "openai": { "available": false, "error": "API key not configured" }
  }
}
```

---

## 🛡️ Circuit Breakers (Níveis de Criticidade)

### ❌ NÃO Existe Sistema de Criticidade Crítico/Médio/Baixo

O que existe são **circuit breakers por SERVIÇO**, não por criticidade:

```typescript
// Circuit breakers existentes:
- grobidBreaker (timeout: 60s, threshold: 60%)
- huggingfaceBreaker (timeout: 30s, threshold: 50%)
- qdrantBreaker (timeout: 5s, threshold: 40%)
- unpaywallBreaker (timeout: 10s, threshold: 70%)
```

### ✅ Como Funciona:

```typescript
// Exemplo: Qdrant breaker
- Timeout: 5 segundos
- Error threshold: 40% (se 40% das chamadas falharem, abre o circuito)
- Reset timeout: 30 segundos (tenta reconectar após 30s)

Estados:
🟢 CLOSED: Tudo funcionando normalmente
🟡 HALF-OPEN: Testando se o serviço voltou
🔴 OPEN: Serviço offline, bloqueando chamadas
```

### Se Você Quer Implementar Criticidade:

Podemos criar 3 níveis:

```typescript
// CRÍTICO: Serviços essenciais (ex: AI, Database)
{
  timeout: 5000,
  errorThresholdPercentage: 30,  // Mais sensível
  resetTimeout: 60000
}

// MÉDIO: Serviços importantes mas não críticos (ex: PDF scraping)
{
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
}

// BAIXO: Serviços opcionais (ex: métricas, cache)
{
  timeout: 15000,
  errorThresholdPercentage: 70,  // Mais tolerante
  resetTimeout: 20000
}
```

---

## 📈 Métricas e Monitoramento

### Ver Status dos Circuit Breakers:
```bash
curl https://api.smileai.com.br/api/health
```

Retorna:
```json
{
  "stats": {
    "circuitBreakers": {
      "grobid": {
        "state": "CLOSED",
        "stats": {
          "fires": 150,
          "successes": 148,
          "failures": 2,
          "timeouts": 0
        }
      }
    }
  }
}
```

---

## 🎯 Resumo: O Que Você Deve Fazer

### Opção 1: Ficar Apenas com Gemini (Atual)
✅ Já funciona
✅ Free tier generoso
❌ Sem fallback se Gemini falhar
❌ Pode atingir rate limit

### Opção 2: Adicionar Groq (RECOMENDADO)
✅ Grátis
✅ Muito rápido
✅ Fallback automático se Gemini falhar
⚙️ Configurar `GROQ_API_KEY` no Render

### Opção 3: Usar Múltiplos Providers (Máxima Resiliência)
✅ Fallback em cascata
✅ Distribuição de carga
✅ Maior uptime
💰 Custo variável
⚙️ Configurar múltiplas API keys

---

## 🔧 Checklist de Configuração

```bash
# Mínimo (atual):
☑ GEMINI_API_KEY

# Recomendado (grátis):
☑ GEMINI_API_KEY
☐ GROQ_API_KEY  ← Adicione isso!

# Máxima qualidade (pago):
☑ GEMINI_API_KEY
☐ GROQ_API_KEY
☐ OPENAI_API_KEY
☐ CLAUDE_API_KEY
```

---

## 📞 Links Úteis

- **Groq Console:** https://console.groq.com
- **Gemini Studio:** https://aistudio.google.com/app/apikey
- **OpenAI Platform:** https://platform.openai.com
- **Claude Console:** https://console.anthropic.com
- **Ollama:** https://ollama.com
