# 🎯 Estratégia de Seleção e Rotação de Modelos

## 📋 Resumo

Sistema inteligente que:
1. ✅ Seleciona **modelos GRATUITOS** de cada provider
2. ✅ Rotaciona automaticamente quando atinge limite
3. ✅ Rastreia sucesso/falha de cada modelo
4. ✅ Todas as chaves de API ficam no `.env` (Render)

---

## 🎯 Ponto 1: OLLAMA EM NUVEM (não local)

### Antes (Local)
```
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
```

### Depois (Nuvem - Ollama Cloud)
```
OLLAMA_API_KEY=sua_chave_aqui
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=mistral
```

**Como obter:**
1. Acesse https://ollama.com
2. Faça login / Create account
3. Crie uma API key
4. Configure no Render como variável de ambiente

---

## 🎯 Ponto 2: SELEÇÃO DE MODELOS GRATUITOS

### Modelos Recomendados (100% GRÁTIS)

```typescript
// RECOMENDAÇÃO POR PROVIDER:

Gemini → 'gemini-2.0-flash-exp'
  ✅ Melhor qualidade
  ✅ 1M tokens/dia grátis
  ✅ 250 requisições/dia

Groq → 'llama-3.1-70b-versatile' (QUALIDADE)
       'llama-3.1-8b-instruct' (VELOCIDADE)
  ✅ 100k tokens/dia grátis
  ✅ 30 req/minuto
  ✅ Muito rápido (276 tokens/s)

OpenRouter → 'meta-llama/llama-3.1-70b-instruct:free'
  ✅ $5-10 créditos iniciais
  ✅ Modelos free disponíveis
  ✅ Fallback para pagos (GPT, Claude)

Ollama Cloud → 'mistral' ou 'llama2'
  ✅ 1M tokens/dia grátis
  ✅ 100% na nuvem
  ✅ Sem instalação local
```

### Como Usar

```typescript
import { generateText } from './services/ai/index.js';
import { recommendedModels } from './services/ai/config/ModelSelection.js';

// AUTOMÁTICO - usa melhor modelo gratuito
const response = await generateText('Seu prompt');

// COM OPÇÃO DE QUALIDADE
const response = await generateText(prompt, {
  quality: 'quality'  // 'quality' | 'balanced' | 'fast'
});

// FORÇAR PROVIDER
const response = await generateText(prompt, {
  provider: 'gemini'  // Força Gemini
});
```

---

## 🎯 Ponto 3: ROTAÇÃO DE MODELOS

### Como Funciona

```
Requisição 1
  ↓
Tenta: Gemini 2.0 Flash
  ├→ Sucesso! ✅ Registra

Requisição 2-5
  ↓
Mesmo padrão...

Requisição 6 (Gemini atingiu limite de 250 req/dia)
  ↓
Sistema detecta limite atingido
  ↓
Rotaciona para: Groq (Llama 3.1 70B)
  ├→ Sucesso! ✅ Registra

Requisição 7
  ↓
Groq atingiu limite de 100k tokens/dia?
  ↓
Rotaciona para: OpenRouter (Llama 3.1 70B)
  ├→ Sucesso! ✅

E assim por diante...
```

### Implementação

```typescript
import { rotationStrategy } from './config/ModelSelection.js';

// Marcar uso bem-sucedido
rotationStrategy.markUsage('gemini-2.0-flash-exp', true);

// Marcar falha
rotationStrategy.markUsage('gemini-2.0-flash-exp', false);

// Verificar se precisa rotacionar
const rotation = rotationStrategy.rotateIfNeeded(
  currentModel,
  ['groq-model', 'openrouter-model']
);

if (rotation.reason) {
  console.log(`Rotacionando: ${rotation.reason}`);
  // Usar rotation.model como próximo
}

// Métricas
console.log(rotationStrategy.getSuccessRate('gemini-2.0-flash-exp'));
console.log(rotationStrategy.getFailureCount('gemini-2.0-flash-exp', 60));
```

---

## 🎯 Ponto 4: CHAVES DE API NO RENDER (Seguro)

### NUNCA deixar hardcoded no código! ❌

```typescript
// ❌ ERRADO - NÃO FAÇA ISTO
const GEMINI_KEY = 'sk-abc123...'; // Exposto no GitHub!

// ✅ CORRETO - Use variáveis de ambiente
const GEMINI_KEY = process.env.GEMINI_API_KEY;
```

### Setup Seguro no Render

**1. No seu `.env.example` (comitar no Git)**
```bash
# API Keys - Configure no Render
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
OLLAMA_API_KEY=your_key_here
```

**2. No seu `.env` (NÃO comitar!)**
```bash
# Nunca fazer commit disto!
GEMINI_API_KEY=AIzaSyD...actual_key
GROQ_API_KEY=gsk-proj_...actual_key
```

**3. No Render (Dashboard)**

Acesse seu serviço no Render:
```
Services → Seu Backend → Environment
```

Adicione as variáveis:
```
GEMINI_API_KEY = AIzaSyD...sua_chave
GROQ_API_KEY = gsk-proj_...sua_chave
OPENROUTER_API_KEY = sk-or_...sua_chave (opcional)
OLLAMA_API_KEY = sk-ollama_...sua_chave (opcional)
```

**4. Código (seguro)**
```typescript
// Sempre ler do environment
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY não configurada!');
}

// Usar a chave
```

### ✅ Checklist de Segurança

- [ ] `.env` no `.gitignore`
- [ ] `.env.example` com valores fake no Git
- [ ] Chaves de verdade APENAS no Render
- [ ] Nunca comitar chaves
- [ ] Rotar chaves regularmente

---

## 📊 Fluxo Completo de Seleção e Rotação

```
generateText(prompt, { quality: 'balanced' })
    ↓
AIStrategyRouter.generate()
    ↓
[1] Verificar Gemini
    ├→ Disponível? ✅
    ├→ Dentro do limite diário? ✅
    ├→ Usar: 'gemini-2.0-flash-exp'
    ├→ Sucesso! markUsage('gemini', true)
    └→ Retornar resposta
    
    Se falhar:
    ├→ markUsage('gemini', false)
    ├→ Falhas > 5 no último minuto?
    └→ SIM → Rotacionar!

[2] Rotacionar para Groq
    ├→ Disponível? ✅
    ├→ Selecionar modelo: 'llama-3.1-70b-versatile'
    ├→ Dentro do limite? ✅
    ├→ Executar
    └→ Retornar resposta

[3] Se Groq também falhar
    ├→ Rotacionar para OpenRouter
    ├→ Modelo: 'meta-llama/llama-3.1-70b-instruct:free'
    └→ ...e assim por diante

[4] Se todos falharem
    ├→ Registrar erro
    ├→ Retornar erro ao usuário
    └→ Alertar para revisão manual
```

---

## 💡 Exemplo Prático Completo

### Setup no Render

```bash
GEMINI_API_KEY = AIzaSyDxxxxxxxxx
GROQ_API_KEY = gsk-proj_xxxxxxxxx
OPENROUTER_API_KEY = sk-or_xxxxxxxxx
OLLAMA_API_KEY = sk-ollama_xxxxxxxxx
OLLAMA_BASE_URL = https://ollama.com
```

### No Código

```typescript
import { generateText } from './services/ai/index.js';

// Usar automaticamente o melhor modelo gratuito
async function gerar_resumo_academico(query: string) {
  try {
    const response = await generateText(
      `Gere um resumo acadêmico: ${query}`,
      {
        quality: 'quality',      // Melhor qualidade
        systemPrompt: 'Você é um professor universitário',
        temperature: 0.5,
        maxTokens: 1000
      }
    );

    console.log(`✅ Gerado com: ${response.provider}`);
    console.log(`📊 Tokens: ${response.tokensUsed}`);
    console.log(`💰 Custo: $${response.cost}`);
    console.log(`📝 Texto: ${response.text}`);

    return response.text;
  } catch (error) {
    console.error('❌ Todos os providers falharam:', error);
    throw error;
  }
}

await gerar_resumo_academico('Inteligência Artificial na educação');
```

---

## 🛠️ Arquivos Relevantes

| Arquivo | Descrição |
|---------|-----------|
| `providers.config.ts` | Configuração com OLLAMA em NUVEM |
| `ModelSelection.ts` | Estratégia de seleção e rotação |
| `AIStrategyRouter.ts` | Implementa a rotação |
| `.env.example` | Template (no Git) |
| `.env` | Suas chaves (NÃO no Git) |

---

## 📊 Estatísticas e Monitoramento

```typescript
import { rotationStrategy } from './config/ModelSelection.js';

// Ver histórico de uso
console.log(rotationStrategy.getHistory(100));

// Taxa de sucesso
console.log(
  rotationStrategy.getSuccessRate('gemini-2.0-flash-exp', 60)
);

// Falhas no último minuto
console.log(
  rotationStrategy.getFailureCount('gemini-2.0-flash-exp', 1)
);

// Resetar (diariamente via cron)
rotationStrategy.reset();
```

---

## ✅ Checklist Final

- [x] Ollama configurado em NUVEM (não local)
- [x] Modelos gratuitos identificados
- [x] Estratégia de rotação implementada
- [x] Chaves de API no Render (seguro)
- [x] Logging de rotação
- [x] Métricas de sucesso/falha

---

**Status**: ✅ PRONTO PARA USAR

Próximo passo: Configure suas chaves no Render e teste! 🚀
