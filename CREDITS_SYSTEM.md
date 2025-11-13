# 📊 Sistema de Créditos - Baseado em Documentos

## 🎯 Nova Lógica (Simplificada)

O sistema agora conta **DOCUMENTOS GERADOS** ao invés de palavras.

### Limites por Plano

| Plano | Documentos/Mês | Renovação |
|-------|---------------|-----------|
| **Básico** | 0 (bloqueado) | - |
| **Standard** | 10 documentos | A cada 30 dias |
| **Premium** | 20 documentos | A cada 30 dias |
| **Enterprise** | 50 documentos | A cada 30 dias |

---

## 🔄 Como Funciona

### 1. Verificação do Plano

```typescript
// Frontend faz login via SmileAI OAuth
// Backend busca dados do plano:

GET https://smileai.com.br/api/app/usage-data
Headers: {
  Authorization: Bearer {access_token}
}

Response:
{
  "plan_name": "standard",  // ou "básico", "premium"
  "is_active": true,
  "purchase_date": "2024-01-15T10:00:00Z",
  "renewal_date": "2024-02-15T10:00:00Z"
}
```

### 2. Cálculo de Créditos

```
Limite do plano: getDocumentLimit(plan_name)
  - básico → 0
  - standard → 10
  - premium → 20

Documentos gerados este mês: SELECT words_consumed_today FROM resea_usage

Disponível = Limite - Gerados
```

### 3. Renovação Mensal Automática

O contador é resetado automaticamente **30 dias após a data de compra**:

```typescript
// Exemplo:
purchase_date: 2024-01-15
last_reset: 2024-01-15
hoje: 2024-02-16

meses_decorridos = getMonthsDifference(purchase_date, hoje) // = 1 mês

if (meses_decorridos >= 1) {
  // RESET! Contador volta para 0
  documents_generated = 0
  last_reset_date = NOW()
}
```

---

## 📡 Endpoints

### GET /api/research/credits

Retorna estatísticas do usuário:

**Response:**
```json
{
  "success": true,
  "plan": "standard",
  "limit": 10,
  "consumed": 3,
  "remaining": 7,
  "percentage": 30,
  "is_active": true,
  "next_reset": "15 dias",
  "purchase_date": "2024-01-15T10:00:00Z",
  "message": "Você pode gerar mais 7 documentos este mês."
}
```

### POST /api/research/generate

Valida créditos **ANTES** de gerar documento:

**Request:**
```json
{
  "query": "Machine Learning em saúde",
  "template": "Artigo científico"
}
```

**Response (sucesso):**
```json
{
  "success": true,
  "content": "...",
  "wordCount": 1500,
  "message": "Conteúdo gerado com sucesso!"
}
```

**Response (sem créditos):**
```json
{
  "success": false,
  "error": "Você atingiu o limite mensal de 10 documentos. Seu limite será renovado em 15 dias.",
  "plan": "standard",
  "limit": 10,
  "consumed": 10,
  "available": 0
}
```

### POST /api/research/finalize

Desconta **1 documento** do limite mensal:

**Request:**
```json
{
  "content": "<html>...</html>",
  "title": "Meu Documento",
  "documentId": 123,
  "documentType": "research"
}
```

**Response:**
```json
{
  "success": true,
  "wordCount": 1500,
  "documentsRemaining": 6,
  "stats": {
    "plan": "standard",
    "limit": 10,
    "consumed": 4,
    "remaining": 6,
    "percentage": 40,
    "next_reset": "15 dias"
  },
  "message": "Documento finalizado com sucesso! Você tem 6 documentos restantes este mês."
}
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `resea_usage`

```sql
CREATE TABLE resea_usage (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  words_consumed_today INT DEFAULT 0,  -- Agora conta DOCUMENTOS
  plan_name VARCHAR(50) DEFAULT 'básico',
  plan_purchase_date TIMESTAMP DEFAULT NOW(),
  last_reset_date TIMESTAMP DEFAULT NOW(),
  last_smileai_sync TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

**Campos importantes:**
- `words_consumed_today` → **Documentos gerados este mês** (nome mantido por compatibilidade)
- `plan_name` → Nome do plano do usuário
- `plan_purchase_date` → Data de compra (para calcular renovação)
- `last_reset_date` → Última vez que o contador foi resetado

### Tabela: `credit_history`

Histórico detalhado de cada documento gerado:

```sql
CREATE TABLE credit_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  document_id INT REFERENCES generated_documents(id),
  words_used INT NOT NULL,  -- Mantido para referência
  action VARCHAR(50) NOT NULL,  -- 'document_generation'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Integração com SmileAI (READ-ONLY)

O sistema **NÃO modifica dados na SmileAI**, apenas lê:

```typescript
// 1. Busca dados do plano (cache 30 min)
const planData = await getSmileAIPlanData(userId, accessToken);
// → { plan_name: "standard", is_active: true, purchase_date: "..." }

// 2. Determina limite
const limit = getDocumentLimit(planData.plan_name);
// → standard = 10 documentos

// 3. Verifica consumo local
const consumed = SELECT words_consumed_today FROM resea_usage;
// → Ex: 3 documentos gerados

// 4. Valida
if (consumed >= limit) {
  return { canGenerate: false, message: "Limite atingido" };
}

// 5. Ao finalizar, incrementa +1 documento
UPDATE resea_usage SET words_consumed_today = words_consumed_today + 1;
```

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────┐
│ 1. Usuário faz login (SmileAI OAuth)│
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 2. Backend busca plano da SmileAI   │
│    GET /api/app/usage-data          │
│    → plan_name: "standard"          │
│    → is_active: true                │
│    → purchase_date: "2024-01-15"    │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 3. Inicializa tracking no PostgreSQL│
│    INSERT INTO resea_usage          │
│    (plan_name, purchase_date, ...)  │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 4. Verifica se precisa resetar     │
│    Se passou 30 dias → RESET        │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 5. Calcula documentos disponíveis  │
│    limit = 10 (standard)            │
│    consumed = 3                     │
│    available = 7                    │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 6. Usuário clica "Gerar Documento" │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 7. checkCreditsAvailable()          │
│    if (available > 0) → ✅ LIBERA   │
│    else → ❌ BLOQUEIA                │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 8. Gera documento com AI            │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 9. Usuário confirma "Finalizar"    │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 10. trackDocumentGeneration()       │
│     UPDATE resea_usage              │
│     SET words_consumed_today += 1   │
│     → consumed = 4                  │
│     → available = 6                 │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 11. Retorna confirmação             │
│     "Você tem 6 documentos restantes│
│      este mês"                      │
└─────────────────────────────────────┘
```

---

## ⚠️ Casos Especiais

### Plano Básico (Bloqueado)

```typescript
plan_name: "básico"
limit: 0

// Resposta:
{
  "canGenerate": false,
  "message": "Plano básico não permite gerar documentos. Faça upgrade para Standard ou Premium!"
}
```

### Plano Inativo

```typescript
is_active: false

// Resposta:
{
  "canGenerate": false,
  "message": "Seu plano está inativo. Por favor, renove sua assinatura."
}
```

### Limite Atingido

```typescript
consumed: 10
limit: 10
available: 0

// Resposta:
{
  "canGenerate": false,
  "message": "Você atingiu o limite mensal de 10 documentos. Seu limite será renovado em 15 dias.",
  "needsRenewal": true
}
```

---

## 📝 Exemplo Prático

**Cenário:**
- Usuário: João
- Plano: Standard (10 docs/mês)
- Data de compra: 15/01/2024
- Hoje: 20/01/2024
- Documentos gerados: 3

**Consulta de créditos:**
```bash
GET /api/research/credits
Authorization: Bearer token123

Response:
{
  "plan": "standard",
  "limit": 10,
  "consumed": 3,
  "remaining": 7,
  "percentage": 30,
  "is_active": true,
  "next_reset": "26 dias",
  "message": "Você pode gerar mais 7 documentos este mês."
}
```

**Gerar documento:**
```bash
POST /api/research/finalize
{
  "content": "...",
  "title": "Documento #4"
}

Response:
{
  "success": true,
  "documentsRemaining": 6,
  "message": "Documento finalizado com sucesso! Você tem 6 documentos restantes este mês."
}
```

**Após 30 dias (15/02/2024):**
```
Sistema detecta: passou 1 mês desde purchase_date
→ RESET automático: consumed = 0
→ Usuário tem 10 documentos novamente!
```

---

## 🎉 Vantagens do Novo Sistema

✅ **Mais simples**: Conta documentos (não palavras)
✅ **Independente**: Não precisa modificar SmileAI API
✅ **Mais justo**: Limite fixo por mês (não importa tamanho do doc)
✅ **Renovação automática**: Reset a cada 30 dias
✅ **Cache inteligente**: 30 min para dados de plano (raramente mudam)
✅ **Fallback robusto**: Funciona mesmo se SmileAI API falhar

---

## 🔧 Configuração

Não precisa configurar nada! O sistema:

1. Busca automaticamente o plano da SmileAI API
2. Inicializa tracking no PostgreSQL
3. Calcula limites baseado no plano
4. Reseta contador automaticamente a cada 30 dias

**Apenas certifique-se:**
- ✅ SmileAI API retorna `plan_name` em `/api/app/usage-data`
- ✅ Valores possíveis: `"básico"`, `"standard"`, `"premium"`
- ✅ Campo `is_active` indica se plano está ativo
- ✅ Campo `purchase_date` para calcular renovação

---

## 🚀 Próximos Passos (Futuro)

Se quiser sincronização bidirecional, pode adicionar na SmileAI API:

```php
// Endpoint para decrementar documentos (opcional)
POST /api/resea/decrement
{
  "user_id": 123,
  "documents_used": 1
}

// Isso permitiria:
// - Dashboard unificado na SmileAI
// - Controle centralizado
// - Histórico completo
```

Mas **não é necessário** - o sistema atual funciona perfeitamente sem isso!
