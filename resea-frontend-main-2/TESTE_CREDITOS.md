# 🧪 Guia de Teste - Créditos do SmileAI

## 📋 Resumo Executivo

A plataforma Resea agora tem uma **estratégia robusta de fallback** para buscar dados de créditos do SmileAI. Se um endpoint falhar, ela tenta outros automaticamente.

## 🔄 Fluxo de Fallback para Créditos

```
┌─────────────────────────────────────────────────┐
│  Início: usuário faz login                      │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Tentativa 1:        │
        │ /api/auth/usage-data│ ← PREFERIDO
        │ (endpoint primário) │
        └─────────┬──────────┘
                  │
         Funciona?└─NO──┐
           │            │
           SIM          │
           │            ▼
           │      ┌──────────────────┐
           │      │ Tentativa 2:     │
           │      │ /api/auth/profile│
           │      └──────┬───────────┘
           │             │
           │      Funciona?└─NO──┐
           │        │            │
           │        SIM          │
           │        │            ▼
           │        │      ┌──────────────────────┐
           │        │      │ Tentativa 3:         │
           │        │      │ entity_credits       │
           │        │      │ (extrair dados user) │
           │        │      └──────┬───────────────┘
           │        │             │
           │        │      Funciona?└─NO──┐
           │        │        │            │
           │        │        SIM          │
           │        │        │            ▼
           │        │        │     ┌──────────────────┐
           │        │        │     │ Tentativa 4:     │
           │        │        │     │ remaining_words  │
           │        │        │     │ (dados do user)  │
           │        │        │     └──────┬───────────┘
           │        │        │            │
           │        │        │     Funciona?└─NO──┐
           │        │        │        │           │
           │        │        │        SIM         │
           │        │        │        │           ▼
           │        │        │        │    ┌─────────────────┐
           │        │        │        │    │ Fallback Final: │
           │        │        │        │    │ 100 palavras    │
           │        │        │        │    │ padrão          │
           │        │        │        │    └────────┬────────┘
           │        │        │        │             │
           └────────┴────────┴────────┴─────────────┴──→ ✅ Créditos Display
```

## ✅ Como Testar

### Opção 1: Teste na Produção (Simples)

1. **Acesse a plataforma:**
   ```
   https://app.smileai.com.br
   ```

2. **Faça login com suas credenciais SmileAI**

3. **Verifique os créditos:**
   - Abra o DevTools (F12)
   - Vá para Console
   - Procure por logs como:
     ```
     ✅ RESULTADO FINAL (fonte: usage-data):
     {
       name: 'Seu Nome',
       plan: 'Premium',
       words_left: 5000,
       source: 'usage-data'
     }
     ```

4. **O que os logs dizem:**
   - `usage-data` = Endpoint `/api/auth/usage-data` respondeu ✅
   - `profile` = Fallback para `/api/auth/profile` (1º falhou)
   - `entity_credits` = Fallback para dados de entity_credits
   - `remaining_words` = Fallback para remaining_words
   - `fallback-padrão` = Nenhum endpoint funcionou (usando 100 words)

### Opção 2: Teste Endpoint de Debug (Avançado)

1. **Com token autorizado, chame:**
   ```bash
   curl -H "Authorization: Bearer SEU_TOKEN" \
     https://resea-backend.onrender.com/api/auth/debug/credits
   ```

2. **Resposta esperada:**
   ```json
   {
     "success": true,
     "debug": {
       "user": {
         "id": 1,
         "name": "Seu Nome",
         "email": "seu@email.com",
         "remaining_words": 5000,
         "entity_credits": "presente"
       },
       "usage_data": {
         "words_left": 5000,
         "total_words": 10000,
         "plan_name": "Premium",
         "plan_status": "active"
       },
       "timestamp": "2025-10-29T15:56:58.000Z"
     }
   }
   ```

### Opção 3: Teste Local com Environment

Se você quer testar localmente:

```bash
# 1. Configure o token
export TEST_ACCESS_TOKEN="seu_token_aqui"

# 2. Rode o frontend em dev
npm run dev

# 3. Abra http://localhost:5173
# 4. Faça login
# 5. Verifique os logs do console
```

## 🔍 O Que Procurar nos Logs

### ✅ Bom (Créditos Funcionando)

```
📍 Buscando dados do usuário...
📦 User data obtido: { id: 1, name: 'João Silva', ... }
🔍 Tentativa 1: Buscando /api/auth/usage-data...
✅ Dados de usage-data obtidos: { words_left: 5000, ... }
✅ RESULTADO FINAL (fonte: usage-data):
{ name: 'João Silva', plan: 'Premium', words_left: 5000, source: 'usage-data' }
```

**Significa:** Créditos vêm diretamente do endpoint `/api/auth/usage-data` da SmileAI ✅

### ⚠️ Fallback (Créditos Funcionando, Mas com Fallback)

```
🔍 Tentativa 1: Buscando /api/auth/usage-data...
⚠️ /api/auth/usage-data retornou status: 404
🔍 Tentativa 2: Buscando /api/auth/profile...
✅ Dados de profile obtidos: { words_left: 5000, ... }
✅ RESULTADO FINAL (fonte: profile):
```

**Significa:** `/api/auth/usage-data` não existe, mas `/api/auth/profile` tem os dados ✅

### ❌ Problema (Usando Fallback Padrão)

```
⚠️ /api/auth/usage-data retornou status: 404
⚠️ /api/auth/profile retornou status: 404
⚠️ Usando fallback padrão: 100 palavras
✅ RESULTADO FINAL (fonte: fallback-padrão):
{ name: 'João Silva', plan: 'Premium', words_left: 100, source: 'fallback-padrão' }
```

**Significa:** Nenhum endpoint SmileAI retornou dados. Usando valor padrão 100.

## 🛠️ O Que Fazer Se Não Funcionar

### 1. Verifique os Planos no SmileAI

- Acesse: https://smileai.com.br/dashboard
- Verifique se você tem um plano ativo
- Confirme se o plano tem créditos/palavras atribuídas

### 2. Confirme a Resposta da API SmileAI

```bash
# Substituir TOKEN pelo seu token de acesso
curl -H "Authorization: Bearer TOKEN" \
  https://smileai.com.br/api/app/usage-data
```

**Resposta esperada:**
```json
{
  "words_left": 5000,
  "total_words": 10000,
  "plan_name": "Premium",
  "plan_status": "active"
}
```

Se retornar 404 ou erro, o problema é no SmileAI backend, não em Resea.

### 3. Verifique no Sidebar

- O sidebar à esquerda deve mostrar:
  ```
  Plano: [seu plano]
  Créditos: [número]
  [Botão: Fazer Upgrade]
  ```

### 4. Verifique no Backend

Se suspeitar de problema no backend Resea:

```bash
curl https://resea-backend.onrender.com/api/auth/debug/credits \
  -H "Authorization: Bearer SEU_TOKEN"
```

Isso retornará EXATAMENTE o que o backend está vendo.

## 📊 Dados Esperados vs Reais

| Campo | Esperado | Teste |
|-------|----------|-------|
| `words_left` | > 0 | _____ |
| `total_words` | > 0 | _____ |
| `plan_name` | Básico/Standard/Premium | _____ |
| `plan_status` | active/inactive | _____ |

## 🚀 Próximos Passos

Se tudo funciona:
1. ✅ Créditos aparecem corretamente
2. ✅ Fallback está robusta
3. ⏭️ Próximo: Implementar consumo de créditos ao gerar conteúdo

Se tem problemas:
1. Colete os logs do console (F12 → Console)
2. Chame `/api/auth/debug/credits` e salve a resposta
3. Abra uma issue ou entre em contato com suporte

---

**Última atualização:** 29/10/2025  
**Versão:** 1.0.0 - Estratégia de Fallback Robusta
