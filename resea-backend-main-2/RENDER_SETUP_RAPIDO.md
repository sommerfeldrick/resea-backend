# ⚡ SETUP RENDER - RESUMIDO (2 MINUTOS)

## 🎯 Em 3 Passos

### PASSO 1: Obter 4 Chaves

| Provider | Link | Chave |
|----------|------|-------|
| **Ollama** | https://ollama.ai/settings/keys | sk-ollama_... |
| **Groq** | https://console.groq.com/keys | gsk-proj_... |
| **OpenRouter** | https://openrouter.ai/keys | sk-or_... |
| **Gemini** | https://aistudio.google.com/app/apikeys | AIzaSyD... |

### PASSO 2: Adicionar no Render

```
1. https://dashboard.render.com
2. Selecione: seu backend
3. Clique: "Environment"
4. Adicione 7 variáveis (veja abaixo)
5. Clique: "Save Changes"
```

### PASSO 3: Redeploy

```
Deploy → Manual Deploy → Deploy
Aguarde 3-5 minutos
```

---

## 📝 As 7 Variáveis Exatas

```
OLLAMA_API_KEY=sk-ollama_SEU_VALOR
OLLAMA_BASE_URL=https://ollama.com
GROQ_API_KEY=gsk-proj_SEU_VALOR
OPENROUTER_API_KEY=sk-or_SEU_VALOR
GEMINI_API_KEY=AIzaSyD_SEU_VALOR
PROVIDER_FALLBACK_ORDER=ollama,groq,openrouter,gemini
ENABLED_PROVIDERS=ollama,groq,openrouter,gemini
```

---

## ✅ Pronto!

Sistema com 42+ modelos funcionando! 🚀

Teste:
```bash
curl -X POST https://seu-backend.onrender.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Olá","quality":"balanced"}'
```

---

**Próximo:** Ver logs do Render para confirmar tudo OK ✓
