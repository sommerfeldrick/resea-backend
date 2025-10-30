# 🤖 Guia de Configuração - Multi-AI Provider

Esse documento explica como configurar o novo sistema multi-provider de IA.

## 📊 Arquitetura

```
AIService (Interface Simples)
    ↓
AIStrategyRouter (Seleção Inteligente)
    ↓
ProviderFactory (Criação de Instâncias)
    ↓
Providers Específicos (Implementação)
    ├── GeminiProvider (Google Gemini 2.5)
    ├── GroqProvider (Groq - Llama 3)
    ├── OpenRouterProvider (OpenRouter)
    └── OllamaProvider (Modelos Locais)
```

## 🎯 Prioridade dos Providers

1. **Gemini** (Primeira opção)
   - Melhor qualidade
   - Quase grátis (free tier generoso)
   - 250 requisições/dia grátis

2. **Groq** (Segunda opção)
   - Muito rápido (276 tokens/seg)
   - Grátis até 100k tokens/dia
   - Excelente para tarefas rápidas

3. **OpenRouter** (Terceira opção)
   - Acesso a múltiplos modelos
   - Créditos iniciais grátis (~$5-10)
   - Fallback com flexibilidade

4. **Ollama** (Última opção)
   - 100% local e offline
   - 100% grátis
   - Para backup/dados sensíveis

## 🔧 Configuração de Variáveis de Ambiente

### Google Gemini 2.5 Flash (RECOMENDADO)

```bash
# 1. Acesse https://makersuite.google.com/app/apikey
# 2. Clique em "Create API Key"
# 3. Copie a chave
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Rate Limits (Free Tier):**
- 250 requisições/dia
- 1.000.000 tokens/dia entrada
- 30.000 tokens/minuto

### Groq (RECOMENDADO - Rápido)

```bash
# 1. Acesse https://console.groq.com/
# 2. Faça login (suporta GitHub)
# 3. Vá para API Keys
# 4. Copie a chave
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-70b-versatile
```

**Rate Limits (Free Tier):**
- 30 requisições/minuto
- 100.000 tokens/dia
- 12.000 tokens/minuto

### OpenRouter (Complementar)

```bash
# 1. Acesse https://openrouter.ai/
# 2. Faça login
# 3. Vá para Settings → API Keys
# 4. Copie a chave
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

**Créditos:**
- $5-$10 iniciais (grátis)
- Modelos free: Llama 3, Mixtral
- Modelos pagos: GPT-4o, Claude, Gemini

### Ollama (Local - Offline)

```bash
# 1. Baixe em https://ollama.ai/
# 2. Instale e abra
# 3. No terminal, rode: ollama pull llama2
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

**Características:**
- Roda localmente
- Sem limite de chamadas
- Sem conexão necessária
- Mais lento (GPU recomendada)

## 📝 Exemplo de Uso

### Simples (Automático - Melhor Provider)

```typescript
import { generateText } from './services/ai/index.js';

const response = await generateText(
  'Escreva um resumo sobre IA',
  { temperature: 0.7, maxTokens: 500 }
);

console.log(response.text);       // Conteúdo gerado
console.log(response.provider);   // Qual IA foi usada
console.log(response.cost);       // Custo em USD
```

### Com Opções

```typescript
import { generateText } from './services/ai/index.js';

// Forçar provider específico
const response = await generateText(
  'Escreva um resumo sobre IA',
  {
    provider: 'gemini',           // Força Gemini
    systemPrompt: 'Você é um professor',
    temperature: 0.5,
    maxTokens: 2000
  }
);
```

### Stream (Implementação Futura)

```typescript
import { generateTextStream } from './services/ai/index.js';

for await (const chunk of generateTextStream(prompt)) {
  process.stdout.write(chunk);
}
```

## 🩺 Monitorar Saúde

### Health Check

```bash
GET /api/ai/health
```

Resposta:
```json
{
  "healthy": true,
  "providers": {
    "gemini": {
      "available": true,
      "usage": { "tokensUsedToday": 50000 },
      "config": { "rateLimits": {...} }
    },
    "groq": {
      "available": true,
      "usage": { "tokensUsedToday": 25000 }
    }
  },
  "stats": {...}
}
```

### Reset Stats

```bash
POST /api/ai/reset-stats
```

## 💰 Estimativa de Custos

### Cenário 1: Uso Leve (10 req/dia)
- **Gemini**: $0 (dentro free tier)
- **Groq**: $0 (dentro free tier)
- **Total/mês**: $0

### Cenário 2: Uso Moderado (100 req/dia)
- **Gemini**: $0 (250 req/dia grátis)
- **Groq**: $0 (100k tokens/dia grátis)
- **Total/mês**: $0-5

### Cenário 3: Uso Intenso (1000 req/dia)
- **Gemini**: $0 (até 250 req/dia, depois $0.15 input + $0.60 output)
- **Groq**: $0 (até 100k tokens/dia, depois $0.59 input + $0.79 output)
- **OpenRouter**: $5-20 (modelos livres + pagos)
- **Total/mês**: $50-200

## 🔄 Fluxo de Fallback

```
Requisição de IA
    ↓
[1] Gemini disponível? → USE
    ↓ (indisponível/limite)
[2] Groq disponível? → USE
    ↓ (indisponível/limite)
[3] OpenRouter disponível? → USE
    ↓ (indisponível/limite)
[4] Ollama disponível? → USE
    ↓ (indisponível)
[!] ERRO - Todas falharam
```

## 📊 Estrutura de Diretórios

```
src/
├── services/
│   ├── ai/
│   │   ├── aiService.ts (Interface Principal)
│   │   ├── AIStrategyRouter.ts (Seleção)
│   │   ├── types.ts (Types/Interfaces)
│   │   ├── index.ts (Exports)
│   │   ├── config/
│   │   │   └── providers.config.ts (Configuração)
│   │   └── providers/
│   │       ├── BaseAIProvider.ts (Abstração)
│   │       ├── GeminiProvider.ts
│   │       ├── GroqProvider.ts
│   │       ├── OpenRouterProvider.ts
│   │       ├── OllamaProvider.ts
│   │       └── ProviderFactory.ts (Factory)
│   └── ...outros services
└── routes/
    ├── ai.ts (Health checks)
    └── ...outros routes
```

## 🚀 Deploy no Render

No `render.yaml`, adicione as variáveis de ambiente:

```yaml
env:
  - key: GEMINI_API_KEY
    value: your_key_here
  - key: GROQ_API_KEY
    value: your_key_here
  - key: OPENROUTER_API_KEY
    value: your_key_here
  - key: OLLAMA_ENABLED
    value: "false"  # Desabilitado em produção (sem local)
```

## 📚 Referências

- [Google Gemini API](https://ai.google.dev/)
- [Groq API](https://console.groq.com/)
- [OpenRouter](https://openrouter.ai/)
- [Ollama](https://ollama.ai/)

## ❓ Troubleshooting

### "Nenhum provedor disponível"

**Causa**: Nenhuma chave de API configurada

**Solução**:
```bash
# Configure pelo menos uma:
GEMINI_API_KEY=key
# ou
GROQ_API_KEY=key
# ou
OLLAMA_ENABLED=true
```

### "Rate limit atingido"

**Causa**: Excedeu limite diário do provider

**Solução**: Sistema tenta automaticamente o próximo provider. Monitore com `/api/ai/health`

### Ollama não conecta

**Causa**: Servidor Ollama não está rodando

**Solução**:
```bash
# Mac/Linux/Windows:
ollama serve

# Depois em outro terminal:
ollama pull llama2
```

---

**Última atualização**: 30/10/2025
**Versão**: 2.0.0
**Status**: ✅ Produção
