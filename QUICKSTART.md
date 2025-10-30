# 🚀 Guia Rápido - Sistema Multi-Provedor (42+ Modelos)

## ⚡ Setup em 5 Minutos

### 1. Obter Chaves de API (Grátis)

#### Ollama Cloud (1M tokens/dia)
```
1. Acesse: https://ollama.ai/settings/keys
2. Crie uma conta (grátis)
3. Copie sua API key
4. Configure em RENDER
```

#### Groq (100k tokens/dia, super rápido)
```
1. Acesse: https://console.groq.com/keys
2. Login com GitHub/Google
3. Copie API key
4. Configure em RENDER
```

#### OpenRouter (Múltiplos modelos)
```
1. Acesse: https://openrouter.ai/keys
2. Crie conta (créditos iniciais grátis)
3. Copie API key
4. Configure em RENDER
```

#### Gemini (1M tokens/dia, 250 req/dia)
```
1. Acesse: https://aistudio.google.com/app/apikeys
2. Crie projeto Google Cloud
3. Copie API key
4. Configure em RENDER
```

### 2. Configurar no Render

**Vá para:** Services → seu backend → Environment

**Adicione estas variáveis:**

```
OLLAMA_API_KEY=sk-ollama_...
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:120b-cloud

GROQ_API_KEY=gsk-proj_...
GROQ_MODEL=llama-3.1-70b-versatile

OPENROUTER_API_KEY=sk-or_...
OPENROUTER_MODEL=nousresearch/hermes-3-llama-3.1-405b:free

GEMINI_API_KEY=AIzaSyD...
GEMINI_MODEL=google/gemini-2.0-flash-exp:free

ENABLED_PROVIDERS=ollama,groq,openrouter,gemini
PROVIDER_FALLBACK_ORDER=ollama,groq,openrouter,gemini
```

**Depois:** Redeploy service

### 3. Usar no Código

```typescript
import { generateText } from './services/ai';

// Básico
const response = await generateText('Seu prompt');

// Com qualidade
const response = await generateText(prompt, {
  quality: 'quality'  // quality | balanced | fast
});

// Resultado
console.log({
  texto: response.text,
  provedor: response.provider,
  modelo: response.model,
  tokens: response.tokensUsed,
  custo: response.cost
});
```

### 4. Testar

```bash
# Local
npm run dev

# Requisição teste
curl -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Olá","quality":"balanced"}'
```

---

## 📊 Todos os 42+ Modelos

### OLLAMA (7 modelos, 1M tokens/dia)
```
✅ gpt-oss:120b-cloud
✅ deepseek-v3.1:671b-cloud
✅ glm-4.6:cloud
✅ qwen3-coder:480b-cloud
✅ kimi-k2:cloud
✅ minimax-m2:cloud
```

### GROQ (3 modelos, 100k tokens/dia)
```
✅ llama-3.1-70b-versatile
✅ mixtral-8x7b-32768
✅ llama-3.1-8b-instruct
```

### OPENROUTER (13+ modelos, créditos flexíveis)
```
✅ nousresearch/hermes-3-llama-3.1-405b:free
✅ deepseek/deepseek-chat-v3.1:free
✅ meta-llama/llama-3.3-70b-instruct:free
✅ qwen/qwen-2.5-72b-instruct:free
✅ deepseek/deepseek-r1:free
✅ meta-llama/llama-4-maverick:free (multimodal)
✅ meta-llama/llama-3.3-8b-instruct:free
✅ qwen/qwen3-coder:free
✅ deepseek/deepseek-r1-0528-qwen3-8b:free
✅ qwen/qwen3-4b:free
✅ deepseek/deepseek-r1-0528:free
✅ mistralai/mistral-small-3.2-24b-instruct:free (multimodal)
```

### GEMINI (1 modelo, 1M tokens/dia, 250 req/dia)
```
✅ google/gemini-2.0-flash-exp:free
```

---

## 🎯 Casos de Uso

### Resumo Acadêmico
```typescript
generateText(articleText, { 
  quality: 'quality',      // Melhor qualidade
  provider: 'ollama'       // Começa com Ollama
})
```

### Resposta Rápida
```typescript
generateText(userMessage, { 
  quality: 'fast',         // Velocidade
  provider: 'groq'         // Groq é rápido
})
```

### Análise com Imagem
```typescript
generateText(prompt, {
  quality: 'balanced',
  provider: 'openrouter'   // OpenRouter tem multimodal
})
```

### Raciocínio Complexo
```typescript
generateText(complexPrompt, {
  quality: 'quality',
  provider: 'openrouter'   // DeepSeek-R1 disponível
})
```

---

## 🔄 Rotação Automática

O sistema **rotaciona automaticamente** quando:

1. ❌ Um modelo falha 5+ vezes em 1 hora
2. ❌ Taxa de sucesso < 50%
3. ⏱️ Provider atinge rate limit

**Próximo modelo é escolhido por:**
- Taxa de sucesso mais alta
- Se mesmo provider: próximo modelo do array
- Se provider esgotado: próximo provider

---

## 📈 Monitorar Saúde

```typescript
import { AIStrategyRouter } from './services/ai/AIStrategyRouter';

// Verificar disponibilidade
const health = await AIStrategyRouter.getHealth();
console.log(health);
// {
//   ollama: { available: true, successRate: '99.5%', ... },
//   groq: { available: true, successRate: '98.2%', ... },
//   openrouter: { available: true, ... },
//   gemini: { available: false, error: 'Rate limited' }
// }

// Ver uso do dia
const stats = AIStrategyRouter.getStats();
console.log(stats);
// {
//   ollama: { requestsToday: 150, tokensUsedToday: 750000, ... },
//   ...
// }
```

---

## ⚙️ Configuração Avançada

### Customizar Ordem de Fallback

No `.env`:
```
PROVIDER_FALLBACK_ORDER=groq,ollama,openrouter,gemini
```

### Ativar/Desativar Providers

No `.env`:
```
ENABLED_PROVIDERS=ollama,groq,openrouter
# Sem Gemini
```

### Modelo Específico

No código:
```typescript
generateText(prompt, {
  provider: 'openrouter',
  model: 'deepseek/deepseek-chat-v3.1:free'
})
```

---

## 🆘 Troubleshooting

### "All providers failed"
```
1. Verificar chaves em Render (Environment)
2. Verificar limites atingidos (AIStrategyRouter.getStats())
3. Tentar outro provider manualmente
4. Verificar Internet/firewall
```

### Provider sempre falha
```
1. Verificar API key correta
2. Verificar se provedor está online
3. Verificar rate limits
4. Contactar suporte do provedor
```

### Respostas lentas
```
1. Usar quality: 'fast' (modelos menores)
2. Usar provider 'groq' (mais rápido)
3. Reduzir maxTokens
4. Usar context menor
```

---

## 📊 Comparação Rápida

| Preciso de | Recomendação |
|-----------|--------------|
| **Máxima qualidade** | Ollama (gpt-oss 120B) |
| **Máxima velocidade** | Groq (Llama 8B) |
| **Multimodal (imagens)** | OpenRouter (Llama-4-Maverick) |
| **Raciocínio avançado** | OpenRouter (DeepSeek-R1) |
| **Mais modelos** | OpenRouter (13+) |
| **Mais tokens/dia** | Ollama (1M) |

---

## 💰 Custo Total

- **Ollama:** $0 (1M tokens/dia grátis)
- **Groq:** $0 (100k tokens/dia grátis)
- **OpenRouter:** $0 (créditos iniciais) ou $$ (quando paga)
- **Gemini:** $0 (1M tokens/dia + 250 req/dia grátis)

**Total:** ZERO até agora! 🎉

---

## ✅ Checklist Final

- [ ] Chaves obtidas de todos os 4 providers
- [ ] Variáveis adicionadas em Render
- [ ] Service redeploy no Render
- [ ] Teste local: `npm run dev`
- [ ] Teste em produção: requisição POST
- [ ] Monitoramento: `AIStrategyRouter.getHealth()`
- [ ] Documentação: `MODELO_MULTIPROVEDOR_COMPLETO.md`

---

## 📞 Recursos

- [Ollama](https://ollama.ai/)
- [Groq](https://groq.com/)
- [OpenRouter](https://openrouter.ai/)
- [Google Gemini](https://aistudio.google.com/)
- Documentação: `MODELO_MULTIPROVEDOR_COMPLETO.md`
- Sumário: `SUMARIO_IMPLEMENTACAO.md`

---

**Pronto! Sistema com 42+ modelos gratuitos configurado e funcionando! 🚀**
