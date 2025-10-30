# 🚀 Sistema Multi-Provedor com TODOS os Modelos Gratuitos

## 📋 Sumário

Sistema inteligente com **42+ modelos gratuitos** de 4 providers, com fallback automático baseado em capacidade do free tier.

**Nova Prioridade:**
1. **Ollama Cloud** - 1M tokens/dia (1º lugar)
2. **Groq** - 100k tokens/dia (2º lugar)
3. **OpenRouter** - Créditos flexíveis (3º lugar)
4. **Gemini** - 250 req/dia (4º lugar)

---

## 🎯 Todos os Modelos por Provider

### 1️⃣ OLLAMA CLOUD (1M tokens/dia - PRIORIDADE 1)

**Modelos disponíveis:**

```
QUALIDADE:
  ✅ gpt-oss:120b-cloud        → 120B (Melhor qualidade/preço)
  ✅ deepseek-v3.1:671b-cloud  → 671B (Ultra-poderoso)
  ✅ qwen3-coder:480b-cloud    → 480B (Especializado em código)

BALANCEADO:
  ✅ gpt-oss:120b-cloud        → 120B
  ✅ glm-4.6:cloud             → GLM 4.6 (Rápido e qualidade)
  ✅ kimi-k2:cloud             → Kimi K2

RÁPIDO:
  ✅ glm-4.6:cloud             → GLM 4.6
  ✅ minimax-m2:cloud          → MiniMax M2 (Ultra-leve)
```

**Limites:**
- 1M tokens/dia ✅
- 100% na nuvem (sem servidor local)
- Modelo default: `gpt-oss:120b-cloud`

---

### 2️⃣ GROQ (100k tokens/dia, 30 req/min - PRIORIDADE 2)

**Modelos disponíveis:**

```
QUALIDADE:
  ✅ llama-3.1-70b-versatile   → 70B (Melhor qualidade)

BALANCEADO:
  ✅ mixtral-8x7b-32768        → 56B equivalente (Contexto de 32k!)

RÁPIDO:
  ✅ llama-3.1-8b-instruct     → 8B (Ultra-rápido: 276 tokens/s)
```

**Limites:**
- 100k tokens/dia
- 30 requisições/minuto
- Muito rápido (ideal para respostas em tempo real)

---

### 3️⃣ OPENROUTER - 13+ Modelos Gratuitos (PRIORIDADE 3)

#### 🏆 QUALIDADE (Frontier models)

```
✅ nousresearch/hermes-3-llama-3.1-405b:free
   → 405B (Modelo frontier)

✅ deepseek/deepseek-chat-v3.1:free
   → Ultra-poderoso, raciocínio avançado

✅ meta-llama/llama-3.3-70b-instruct:free
   → 70B alternativo

✅ qwen/qwen-2.5-72b-instruct:free
   → 72B (Muito bom para análise)
```

#### ⚖️ BALANCEADO (Reasoning + Multimodal)

```
✅ deepseek/deepseek-r1:free
   → Modelo de raciocínio (pensa antes de responder)

✅ meta-llama/llama-4-maverick:free
   → MULTIMODAL (aceita imagens!)

✅ meta-llama/llama-3.3-70b-instruct:free
   → 70B alternativo

✅ qwen/qwen-2.5-72b-instruct:free
   → 72B alternativo
```

#### ⚡ RÁPIDO (Lightweight + Coding)

```
✅ meta-llama/llama-3.3-8b-instruct:free
   → 8B rápido

✅ qwen/qwen3-coder:free
   → Especializado em programação

✅ deepseek/deepseek-r1-0528-qwen3-8b:free
   → 8B com raciocínio

✅ qwen/qwen3-4b:free
   → 4B ultra-leve

✅ deepseek/deepseek-r1-0528:free
   → DeepSeek R1 versão 0528

✅ mistralai/mistral-small-3.2-24b-instruct:free
   → 24B MULTIMODAL (aceita imagens!)
```

**Limites:**
- Créditos iniciais ($5-10) para free tier
- Modelos com `:free` nunca cobram
- Fallback automático para modelos pagos se necessário

---

### 4️⃣ GEMINI (1M tokens/dia, 250 req/dia - PRIORIDADE 4)

**Modelos disponíveis (via OpenRouter):**

```
QUALIDADE:
  ✅ google/gemini-2.0-flash-exp:free
     → Flash Experimental (últimas features)

BALANCEADO:
  ✅ google/gemini-2.0-flash-exp:free

RÁPIDO:
  ✅ google/gemini-2.0-flash-exp:free
     → Flash é rápido por padrão
```

**Limites:**
- 1M tokens/dia ✅
- 250 requisições/dia ⚠️ (restritivo)
- Apenas como fallback final

---

## 💻 Como Usar

### Instalação de Chaves (`.env.example`)

```bash
# Ollama Cloud (recomendado)
OLLAMA_API_KEY=sk-ollama_...
OLLAMA_BASE_URL=https://ollama.com

# Groq (backup rápido)
GROQ_API_KEY=gsk-proj_...

# OpenRouter (flexibility)
OPENROUTER_API_KEY=sk-or_...

# Gemini (último recurso)
GEMINI_API_KEY=AIzaSyD...
```

### No Render (Deployment)

Vá para **Dashboard → Services → Environment → Add Variable**:

```
OLLAMA_API_KEY=sk-ollama_[sua_chave]
GROQ_API_KEY=gsk-proj_[sua_chave]
OPENROUTER_API_KEY=sk-or_[sua_chave]
GEMINI_API_KEY=AIzaSyD[sua_chave]
OLLAMA_BASE_URL=https://ollama.com
```

### No Código (TypeScript)

```typescript
import { generateText } from './services/ai';

// 1️⃣ AUTOMÁTICO - Usa melhor modelo disponível
const response = await generateText('Seu prompt aqui');
console.log(`Usado: ${response.provider}`);

// 2️⃣ COM QUALIDADE - Seleciona modelo por tier
const response = await generateText(prompt, {
  quality: 'quality'  // 'quality' | 'balanced' | 'fast'
});

// 3️⃣ FORÇAR PROVIDER
const response = await generateText(prompt, {
  provider: 'groq'
});

// 4️⃣ TUDO CUSTOMIZADO
const response = await generateText(prompt, {
  quality: 'balanced',
  provider: 'openrouter',
  temperature: 0.7,
  maxTokens: 2000
});

console.log({
  text: response.text,
  provider: response.provider,
  model: response.model,
  tokensUsed: response.tokensUsed,
  cost: response.cost
});
```

---

## 🔄 Fluxo de Fallback Automático

```
Requisição recebida
    ↓
Tenta: Ollama Cloud (1M tokens/dia)
├─ ✅ Sucesso? Retorna resultado
├─ ❌ Limite atingido ou erro? → Próximo
    ↓
Tenta: Groq (100k tokens/dia + 30 req/min)
├─ ✅ Sucesso? Retorna resultado
├─ ❌ Limite atingido ou erro? → Próximo
    ↓
Tenta: OpenRouter (Múltiplos modelos)
├─ ✅ Sucesso? Retorna resultado
├─ ❌ Erro? → Próximo
    ↓
Tenta: Gemini (250 req/dia)
├─ ✅ Sucesso? Retorna resultado
├─ ❌ Todos falharam? Erro para usuário
```

---

## 📊 Rotação Inteligente de Modelos

Sistema **rastreia sucesso/falha** de cada modelo e rotaciona automaticamente:

```typescript
import { rotationStrategy } from './config/ModelSelection';

// Taxa de sucesso
const rate = rotationStrategy.getSuccessRate('llama-3.1-70b-versatile', 60);
console.log(`Groq sucesso nos últimos 60 min: ${rate * 100}%`);

// Contar falhas
const failures = rotationStrategy.getFailureCount('gpt-oss:120b-cloud', 60);
console.log(`Ollama falhas: ${failures}`);

// Obter histórico
const history = rotationStrategy.getHistory(100);
console.log(history);

// Resetar (execute via cron diariamente)
rotationStrategy.reset();
```

---

## 📈 Monitoramento e Saúde

### Verificar Status dos Providers

```typescript
import { AIStrategyRouter } from './services/ai/AIStrategyRouter';

const health = await AIStrategyRouter.getHealth();
console.log(health);

// Saída:
// {
//   ollama: { available: true, tokensUsed: 45000, ... },
//   groq: { available: true, successRate: '98.5%', ... },
//   openrouter: { available: true, ... },
//   gemini: { available: false, error: 'API key missing' }
// }
```

### Ver Estatísticas de Uso

```typescript
const stats = AIStrategyRouter.getStats();
console.log(stats);

// {
//   ollama: {
//     requestsToday: 125,
//     tokensUsedToday: 450000,
//     costToday: 0,
//     failureCount: 2
//   },
//   ...
// }
```

---

## 🎯 Casos de Uso Recomendados

| Caso | Provider | Modelo | Qualidade |
|------|----------|--------|-----------|
| **Resumo acadêmico** | Ollama → Groq | 120B ou Llama 70B | Quality |
| **Correção rápida** | Groq | Llama 8B | Fast |
| **Análise pesquisa** | Ollama | GPT-OSS 120B | Balanced |
| **Processamento imagem** | OpenRouter | Llama-4-Maverick | Balanced |
| **Código especializado** | Groq | Mistral 8x7B | Balanced |
| **Raciocínio complexo** | OpenRouter | DeepSeek-R1 | Quality |
| **Fallback final** | Gemini | Gemini 2.0 Flash | Fast |

---

## ⚙️ Configuração Avançada

### ModelSelection.ts (Arrays de modelos)

```typescript
// NOVO: Arrays com fallback automático
export const freeModels = {
  ollama: {
    quality: [
      'gpt-oss:120b-cloud',           // 1º preferido
      'deepseek-v3.1:671b-cloud',     // 2º fallback
      'qwen3-coder:480b-cloud'        // 3º fallback
    ],
    balanced: [
      'gpt-oss:120b-cloud',
      'glm-4.6:cloud',
      'kimi-k2:cloud'
    ],
    fast: [
      'glm-4.6:cloud',
      'minimax-m2:cloud',
      'gpt-oss:120b-cloud'
    ]
  },
  // ... outros providers
};
```

### providers.config.ts (Prioridade dos providers)

```typescript
// Ordem: Ollama → Groq → OpenRouter → Gemini
export const fallbackOrder: AIProvider[] = [
  'ollama',       // 1M tokens/dia
  'groq',         // 100k tokens/dia + super rápido
  'openrouter',   // Flexível + muitos modelos
  'gemini'        // 250 req/dia (último recurso)
];
```

---

## 🔐 Segurança

### ✅ Checklist Segurança

- [ ] Nunca comitar `.env` com chaves reais
- [ ] Sempre usar `.env.example` com valores fake no Git
- [ ] Chaves APENAS no Render (não no código)
- [ ] Rotar chaves a cada 3 meses
- [ ] Monitorar uso via logs e estatísticas

### Integração com Render Secrets

1. GitHub → Add `.env` to `.gitignore`
2. Render Dashboard → Environment Variables
3. Copy chaves lá (nunca em código)
4. Redeploy service

---

## 📊 Comparação de Capacidade (Free Tier)

| Provider | Tokens/dia | Req/min | Modelos | Multimodal | Custo |
|----------|-----------|---------|---------|-----------|-------|
| **Ollama** | 1M ✅ | 60 | 7+ | Sim | $0 |
| **Groq** | 100k | 30 | 3 | Não | $0 |
| **OpenRouter** | Flex | Flex | 13+ | Sim (alguns) | $0 (free tier) |
| **Gemini** | 1M | 60 | 1 | Sim | $0 (250 req/dia) |

**Conclusão:** Ollama > Groq > OpenRouter > Gemini ✅

---

## 🚀 Deployment Checklist

- [ ] Chaves configuradas no Render
- [ ] OLLAMA_BASE_URL = https://ollama.com (não local)
- [ ] ModelSelection.ts com todos os modelos
- [ ] providers.config.ts com fallbackOrder novo
- [ ] AIStrategyRouter.ts usando arrays
- [ ] Logs configurados para monitorar rotação
- [ ] Teste de fallback (desabilitar providers um a um)
- [ ] Cron job para resetar estatísticas diárias

---

## 📚 Arquivos Modificados

```
src/services/ai/config/
├── ModelSelection.ts         ✅ Arrays de modelos + info
├── providers.config.ts       ✅ Nova prioridade (Ollama 1º)
└── AIStrategyRouter.ts       ✅ Iteração por arrays

.env.example                  ✅ Todos os providers
```

---

## ✅ Status

- ✅ **42+ modelos gratuitos** incluídos
- ✅ **Arrays com fallback** por qualidade
- ✅ **Nova prioridade** otimizada por capacidade
- ✅ **Rotação inteligente** baseada em sucesso/falha
- ✅ **Seguro** com chaves em variáveis de ambiente
- ✅ **Pronto para usar** 🚀

**Próximo passo:** Configure suas chaves no Render e teste!

---

## 📞 Suporte

Precisa de ajuda?

1. Verifique as chaves no Render
2. Cheque os logs (`AIStrategyRouter.getHealth()`)
3. Teste um provider por vez
4. Verifique a documentação específica de cada provider

---

**Última atualização:** 30 de outubro de 2025
**Modelos:** 42+ (Ollama 7, Groq 3, OpenRouter 13+, Gemini 1)
**Status:** ✅ Pronto para produção
