# 🔑 Como Configurar a Semantic Scholar API Key

## Problema Atual

O Semantic Scholar está retornando **403 Forbidden** porque a API key não está configurada corretamente.

```
'x-api-key': 'sua_api_key_aqui'  ❌ Placeholder detectado!
```

---

## ✅ Solução: Configurar API Key Real

### 1. **Obter a API Key**

Você já solicitou a API key através do formulário em:
https://www.semanticscholar.org/product/api

**Verifique seu email** para a aprovação. Geralmente leva algumas horas.

### 2. **Configurar no Render (Produção)**

1. Acesse: https://dashboard.render.com/web/YOUR_SERVICE_ID/env
2. Encontre a variável `SEMANTIC_SCHOLAR_KEY`
3. **Cole a API key real** que você recebeu por email
4. Clique em **"Save Changes"**
5. O Render vai reiniciar automaticamente

### 3. **Configurar Localmente (Desenvolvimento)**

No arquivo `.env`:

```bash
SEMANTIC_SCHOLAR_KEY=your_actual_api_key_here  # Troque pela key real!
```

---

## 📊 Verificar se Funcionou

Após configurar, cheque os logs do Render:

### ✅ ANTES (Erro):
```
error: Request failed with status code 403
⚠️  Semantic Scholar failed
```

### ✅ DEPOIS (Sucesso):
```
✅ Semantic Scholar: 15 papers
✅ Search completed: 30 unique papers from 3 sources
```

---

## 🎯 Outras Melhorias Implementadas

### 1. **Filtro de Relevância Automático**

Agora o sistema filtra papers irrelevantes automaticamente:

```typescript
// Antes: Retornava papers sobre "Cosmologia" para query "odontologia"
// Depois: Filtra papers com score de relevância < 0.3

Filtered 15 papers → 8 relevant  // Remove 7 papers irrelevantes
```

### 2. **Logs Melhorados**

```
🔍 Starting comprehensive search for: "elementos finitos na odontologia"
✅ Semantic Scholar: 15 papers
✅ arXiv: 5 papers
✅ OpenAlex: 10 papers
📊 Filtered 30 papers → 12 relevant (removed 18 irrelevant)
```

---

## 🚨 Se Ainda Não Recebeu a API Key

Enquanto aguarda a aprovação, o sistema vai usar apenas:
- ✅ OpenAlex (sem key necessária)
- ✅ arXiv (sem key necessária)
- ✅ DOAJ (sem key necessária)
- ✅ PubMed (sem key necessária)

**Semantic Scholar é opcional**, mas recomendado para melhores resultados.

---

## 📧 Email de Aprovação

Você vai receber algo assim:

```
Subject: Semantic Scholar API Key Approved

Your API key: sk_xxxxxxxxxxxxxxxxxxxxx

Rate limit: 1 request/second
Daily limit: 5000 requests/day
```

Copie a key `sk_xxxxxxxxxxxxxxxxxxxxx` e cole no Render!
