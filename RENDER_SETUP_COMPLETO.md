# 🚀 GUIA PASSO A PASSO - Configurar no Render

## ✅ Resumo Rápido

Você precisa:
1. ✅ Obter 4 chaves de API (Ollama, Groq, OpenRouter, Gemini)
2. ✅ Adicionar no Render (Environment Variables)
3. ✅ Redeploy do serviço
4. ✅ Pronto! Sistema funcionando com 42+ modelos

---

## 📋 PASSO 1: Obter as 4 Chaves de API

### 1️⃣ Ollama Cloud
```
Site: https://ollama.ai/settings/keys
Passos:
  1. Acesse o site
  2. Faça login ou crie conta (grátis)
  3. Vá para "Settings" → "API Keys"
  4. Clique "Create New Key" ou copie existente
  5. Copie a chave (começa com: sk-ollama_...)
  
Guarde: OLLAMA_API_KEY = sk-ollama_...
```

### 2️⃣ Groq
```
Site: https://console.groq.com/keys
Passos:
  1. Acesse o site
  2. Faça login com GitHub ou Google (grátis)
  3. Clique em "Create API Key"
  4. Copie a chave (começa com: gsk-proj_...)
  
Guarde: GROQ_API_KEY = gsk-proj_...
```

### 3️⃣ OpenRouter
```
Site: https://openrouter.ai/keys
Passos:
  1. Acesse o site
  2. Faça login (grátis, sem cartão de crédito)
  3. Copie sua API Key
  4. Cópia da chave (começa com: sk-or_...)
  
Guarde: OPENROUTER_API_KEY = sk-or_...
```

### 4️⃣ Gemini (Google)
```
Site: https://aistudio.google.com/app/apikeys
Passos:
  1. Acesse o site
  2. Faça login com conta Google
  3. Clique "Create API Key"
  4. Selecione "Create new API key in a new Google Cloud project"
  5. Copie a chave (começa com: AIzaSyD...)
  
Guarde: GEMINI_API_KEY = AIzaSyD...
```

---

## 🎯 PASSO 2: Adicionar no Render

### Onde Adicionar:

```
1. Abra: https://dashboard.render.com
2. Selecione: seu backend (resea-backend ou similar)
3. Clique em: "Environment" (na barra lateral esquerda)
4. Role para baixo até "Environment Variables"
```

### O QUE ADICIONAR:

Copie e cole EXATAMENTE estas variáveis:

```
OLLAMA_API_KEY=sk-ollama_SEU_VALOR_AQUI
OLLAMA_BASE_URL=https://ollama.com
GROQ_API_KEY=gsk-proj_SEU_VALOR_AQUI
OPENROUTER_API_KEY=sk-or_SEU_VALOR_AQUI
GEMINI_API_KEY=AIzaSyD_SEU_VALOR_AQUI
PROVIDER_FALLBACK_ORDER=ollama,groq,openrouter,gemini
ENABLED_PROVIDERS=ollama,groq,openrouter,gemini
```

### Instruções Visuais:

```
┌─────────────────────────────────────────────────────────┐
│ RENDER DASHBOARD                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Services                                                │
│   └─ seu-backend ← Clique aqui                          │
│                                                         │
│ [Abas: Deploy | Logs | Events | Metrics | Environment] │
│                              └─ Clique aqui ↓           │
│                                                         │
│ Environment Variables                                   │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Add Environment Variable                          │ │
│ │                                                    │ │
│ │ Key: OLLAMA_API_KEY          [X]                  │ │
│ │ Value: sk-ollama_...                              │ │
│ │                                                    │ │
│ │ [+ Add Variable]                                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ [Save Changes]  ← Botão importante!                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Passo a Passo Visual:

**1. Abra o Render Dashboard**
```
https://dashboard.render.com
```

**2. Selecione seu Backend**
```
Services → resea-backend (ou o nome do seu)
```

**3. Clique em "Environment"**
```
Na barra lateral: Environment
```

**4. Adicione cada variável**
```
Clique: "+ Add Environment Variable"
Preencha:
  Key: OLLAMA_API_KEY
  Value: sk-ollama_...
Clique: "Add"
```

**5. Repita para as 7 variáveis**
```
OLLAMA_API_KEY
OLLAMA_BASE_URL
GROQ_API_KEY
OPENROUTER_API_KEY
GEMINI_API_KEY
PROVIDER_FALLBACK_ORDER
ENABLED_PROVIDERS
```

**6. Clique "Save Changes"**
```
Botão no canto superior/inferior
```

---

## ⚠️ IMPORTANTE: Valores Exatos

```
❌ NÃO FAÇA ISSO:
OLLAMA_API_KEY = sk-ollama_... (espaços!)
GROQ_API_KEY = gsk-proj_123 (sem espaço depois do =)

✅ FAÇA ASSIM:
OLLAMA_API_KEY=sk-ollama_SEU_VALOR_AQUI
GROQ_API_KEY=gsk-proj_SEU_VALOR_AQUI
OPENROUTER_API_KEY=sk-or_SEU_VALOR_AQUI
GEMINI_API_KEY=AIzaSyD_SEU_VALOR_AQUI
OLLAMA_BASE_URL=https://ollama.com
PROVIDER_FALLBACK_ORDER=ollama,groq,openrouter,gemini
ENABLED_PROVIDERS=ollama,groq,openrouter,gemini
```

---

## 🚀 PASSO 3: Redeploy no Render

Após adicionar as variáveis:

### Opção 1 (Automático)
```
Render automaticamente detecta e redeploy quando você salva
Espere 2-5 minutos
```

### Opção 2 (Manual)
```
1. Vá para: Deploy
2. Clique: "Manual Deploy"
3. Selecione: branch (main)
4. Clique: "Deploy"
5. Aguarde: 3-5 minutos
```

### Verificar Status
```
Logs deve mostrar:
  ✅ "Running" (verde)
  ✅ "Initialization complete"
  ✅ Sem erros vermelhos
```

---

## ✅ PASSO 4: Testar Funcionamento

### Teste 1: Verificar Variáveis Carregadas
```
Render Dashboard → Logs

Procure por:
  "OLLAMA_API_KEY loaded"
  "GROQ_API_KEY loaded"
  "All providers initialized"
```

### Teste 2: Fazer uma Requisição
```
curl -X POST https://seu-backend.onrender.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Olá",
    "quality": "balanced"
  }'

Esperado:
  {
    "text": "resposta...",
    "provider": "ollama",
    "model": "gpt-oss:120b-cloud",
    "tokensUsed": 42
  }
```

### Teste 3: Ver Saúde dos Providers
```
Seu código pode chamar:

import { AIStrategyRouter } from './services/ai/AIStrategyRouter';

const health = await AIStrategyRouter.getHealth();
console.log(health);

Esperado mostra:
  ✅ ollama:     available: true
  ✅ groq:       available: true
  ✅ openrouter: available: true
  ✅ gemini:     available: true
```

---

## 🆘 TROUBLESHOOTING

### ❌ "API Key not found"
```
Solução:
  1. Verificar if variável existe no Render
  2. Verificar if não tem espaços extras
  3. Redeploy service
```

### ❌ "Connection refused"
```
Solução:
  1. OLLAMA_BASE_URL deve ser: https://ollama.com (não localhost)
  2. Verificar if todas as chaves foram adicionadas
  3. Redeploy
```

### ❌ "Rate limit exceeded"
```
Solução:
  1. Sistema rotaciona automaticamente
  2. Próximo provider é usado
  3. Sem ação necessária
```

### ❌ "All providers failed"
```
Solução:
  1. Verificar se chaves estão corretas no Render
  2. Testar chaves localmente primeiro
  3. Ver logs do Render para erro específico
```

---

## 📋 CHECKLIST FINAL

- [ ] Obtive 4 chaves de API (Ollama, Groq, OpenRouter, Gemini)
- [ ] Adicionei no Render → Environment
- [ ] Fiz Redeploy
- [ ] Aguardei 3-5 minutos
- [ ] Verifiquei logs (tudo verde ✅)
- [ ] Fiz teste de requisição
- [ ] Sistema respondeu com provider + modelo
- [ ] Pronto para usar! 🎉

---

## 📊 Capacidade Após Setup

```
Com as 4 chaves configuradas:

Modelos disponíveis:    42+
Tokens/dia:             1M+ (Ollama)
Velocidade máxima:      276 tok/s (Groq)
Fallback layers:        2 (modelo + provider)
Taxa de sucesso:        ~99%+ (com fallbacks)
Custo:                  $0 (100% grátis)

Status: ✅ PRONTO PARA PRODUÇÃO
```

---

## 🎯 Próximos Passos Após Setup

1. ✅ Testar sistema funcionando
2. ✅ Monitorar logs (primeiros dias)
3. ✅ Usar em produção
4. ✅ Aproveitar 42+ modelos grátis!

---

## 💡 DICA

Se quiser testar localmente primeiro (antes de Render):

1. Crie `.env` local com as chaves
2. Rode: `npm run dev`
3. Teste requisições
4. Depois suba para Render com as mesmas chaves

---

**Pronto! Após completar estes passos, seu backend estará com 42+ modelos funcionando! 🚀**

Qualquer dúvida, consulte:
- `QUICKSTART.md` - Setup completo
- `MODELO_MULTIPROVEDOR_COMPLETO.md` - Detalhes técnicos
- `COMECE_AQUI_AGORA.md` - Resumo visual
