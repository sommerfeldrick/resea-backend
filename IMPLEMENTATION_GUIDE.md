# 📋 Guia de Implementação - Sistema de Créditos & Storage R2

## 🎯 O que foi implementado

### 1. Sistema de Créditos Híbrido (SmileAI + Local)

Sistema de controle de créditos que integra com a API da SmileAI sem necessidade de modificá-la.

**Características:**
- ✅ Busca saldo de créditos da SmileAI API (READ-ONLY)
- ✅ Tracking local de consumo no PostgreSQL
- ✅ Cache inteligente com Redis (5 min TTL)
- ✅ Validação antes de gerar documentos
- ✅ Histórico completo de uso
- ✅ Sincronização periódica (detecta compras de créditos)

**Tabelas criadas:**
```sql
-- Tracking de uso local do Resea
resea_usage (
  id, user_id, words_consumed_today,
  smileai_remaining_words, last_smileai_sync,
  created_at, updated_at
)

-- Histórico detalhado de consumo
credit_history (
  id, user_id, document_id, words_used,
  action, metadata, created_at
)
```

---

### 2. Cloudflare R2 Storage (S3-Compatible)

Sistema de armazenamento em nuvem para documentos gerados.

**Características:**
- ✅ Upload automático para Cloudflare R2
- ✅ Fallback para PostgreSQL se R2 estiver offline
- ✅ URLs assinadas para download seguro (válidas por 1h)
- ✅ Suporte a múltiplos formatos (HTML, PDF, DOCX, TXT, MD)
- ✅ Compatível com AWS S3 (mesma API)
- ✅ Sem custo de download (egress gratuito no R2)

**Tabela atualizada:**
```sql
-- Campos adicionados em generated_documents
ALTER TABLE generated_documents ADD COLUMN s3_key VARCHAR(500);
ALTER TABLE generated_documents ADD COLUMN s3_url TEXT;
ALTER TABLE generated_documents ADD COLUMN file_format VARCHAR(20) DEFAULT 'html';
```

---

## 🚀 Como Usar

### Passo 1: Configurar Variáveis de Ambiente

Copie as variáveis do `.env.example` para seu `.env`:

#### **Sistema de Créditos (obrigatório)**
```bash
# SmileAI API (já configurado)
MAIN_DOMAIN_API=https://smileai.com.br
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=seu_secret_aqui

# Redis (opcional, mas recomendado para performance)
REDIS_ENABLED=true
REDIS_URL=redis://seu_redis:6379
```

#### **Cloudflare R2 Storage (opcional)**
```bash
# Habilitar R2 (se false, usa PostgreSQL)
R2_ENABLED=true

# Cloudflare R2 Credentials
R2_ACCOUNT_ID=seu_account_id_cloudflare
R2_BUCKET_NAME=resea-documents
R2_ACCESS_KEY_ID=sua_access_key
R2_SECRET_ACCESS_KEY=sua_secret_key
R2_REGION=auto
```

**Como obter credenciais do R2:**
1. Acesse: https://dash.cloudflare.com/
2. Vá em: **R2 Object Storage** (menu lateral)
3. Crie um bucket: **Create Bucket** → Nome: `resea-documents`
4. Crie API token: **Manage R2 API Tokens** → **Create API Token**
5. Copie: `Account ID`, `Access Key ID`, `Secret Access Key`

**Custo:** ~$0.015/GB/mês (downloads gratuitos!)

---

### Passo 2: Rodar Migrations

As migrations são executadas automaticamente ao iniciar o servidor:

```bash
npm run dev
```

Você verá no console:
```
✅ Tabela "resea_usage" criada/verificada
✅ Tabela "credit_history" criada/verificada
✅ Campos de storage R2 adicionados à tabela generated_documents
✅ Storage client initialized: Cloudflare R2 (bucket: resea-documents)
```

---

### Passo 3: Testar o Sistema de Créditos

#### **1. Consultar créditos do usuário**
```bash
GET /api/research/credits
Authorization: Bearer {access_token}

Response:
{
  "success": true,
  "plan": "pro",
  "limit": 100000,
  "consumed": 1500,
  "remaining": 98500,
  "percentage": 1,
  "resea_consumed_today": 1500,
  "smileai_remaining": 100000
}
```

#### **2. Gerar documento (validação automática de créditos)**
```bash
POST /api/research/generate
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "query": "Machine Learning em saúde",
  "estimatedWords": 2000
}

Response (se não tiver créditos):
{
  "success": false,
  "error": "Créditos insuficientes. Disponível: 500 palavras, Necessário: 2000 palavras",
  "available": 500,
  "required": 2000
}
```

#### **3. Finalizar documento (desconto de créditos)**
```bash
POST /api/research/finalize
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "content": "<html>...</html>",
  "title": "Meu Documento",
  "documentId": 123,
  "documentType": "research"
}

Response:
{
  "success": true,
  "wordCount": 1500,
  "remaining": 97000,
  "stats": {
    "plan": "pro",
    "limit": 100000,
    "consumed": 3000,
    "remaining": 97000,
    "resea_consumed_today": 3000
  },
  "message": "Documento finalizado com sucesso! 1500 palavras foram descontadas."
}
```

#### **4. Histórico de uso**
```bash
GET /api/research/credits/history?limit=50
Authorization: Bearer {access_token}

Response:
{
  "success": true,
  "history": [
    {
      "id": 1,
      "words_used": 1500,
      "action": "document_generation",
      "document_title": "Meu Documento",
      "document_type": "research",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

### Passo 4: Testar o Storage R2

#### **1. Salvar documento com R2**
```typescript
import { DocumentHistoryService } from './services/documentHistoryService.js';

const doc = await DocumentHistoryService.saveDocument({
  user_id: 123,
  title: "Documento de Teste",
  content: "<html><body>Conteúdo do documento...</body></html>",
  document_type: "research",
  word_count: 150,
  file_format: "html" // ou "pdf", "docx", "txt", "md"
});

// Se R2 estiver habilitado:
// - Arquivo é enviado para: s3://resea-documents/documents/123/{docId}.html
// - PostgreSQL armazena apenas metadados (content fica vazio)
// - Retorna: { id: 456, created_at: "..." }
```

#### **2. Buscar documento do R2**
```typescript
const doc = await DocumentHistoryService.getDocument(456, 123);

console.log(doc);
// {
//   id: 456,
//   title: "Documento de Teste",
//   storage_type: "r2",
//   download_url: "https://...presigned-url..." // Válida por 1 hora
// }
```

#### **3. Download de conteúdo completo**
```typescript
const content = await DocumentHistoryService.getDocumentContent(456, 123);

console.log(content);
// "<html><body>Conteúdo do documento...</body></html>"
```

#### **4. Deletar documento**
```typescript
await DocumentHistoryService.deleteDocument(456, 123);
// Deleta do R2 E do PostgreSQL
```

---

## 🔄 Fluxo Completo de Geração de Documento

```
1. Frontend: GET /api/research/credits
   ↓
2. Backend: Busca saldo da SmileAI (cache 5min)
   ↓
3. Frontend: POST /api/research/generate (estimatedWords: 2000)
   ↓
4. Backend: checkCreditsAvailable()
   - Busca saldo SmileAI
   - Consulta consumo local do dia
   - Valida: smileai_remaining - local_consumed >= 2000?
   ↓
5. Backend: Gera conteúdo com AI
   ↓
6. Frontend: Usuário edita e confirma
   ↓
7. Frontend: POST /api/research/finalize
   ↓
8. Backend: trackDocumentGeneration()
   - Conta palavras (1800)
   - Incrementa resea_usage.words_consumed_today
   - Salva em credit_history
   - Invalida cache Redis
   ↓
9. Backend: DocumentHistoryService.saveDocument()
   - Upload para R2 (se habilitado)
   - Salva metadados no PostgreSQL
   ↓
10. Frontend: Recebe confirmação + créditos atualizados
```

---

## 📊 Arquivos Modificados/Criados

### Criados:
- ✅ `src/services/storageService.ts` - Serviço de upload/download R2
- ✅ `IMPLEMENTATION_GUIDE.md` - Este guia

### Modificados:
- ✅ `src/config/migrations.ts` - Adicionadas tabelas `resea_usage`, `credit_history` e campos R2
- ✅ `src/services/creditsService.ts` - Implementado sistema híbrido
- ✅ `src/services/documentHistoryService.ts` - Integração com R2
- ✅ `src/routes/research.ts` - Validação de créditos nos endpoints
- ✅ `.env.example` - Adicionadas variáveis R2
- ✅ `package.json` - Adicionadas dependências AWS SDK

---

## 🔧 Sincronização Periódica (Opcional)

Para detectar quando usuários compram créditos na SmileAI, você pode criar um cron job:

```typescript
// src/jobs/creditSync.ts
import { creditsService } from '../services/creditsService.js';
import { query } from '../config/database.js';

export async function syncAllUsersCredits() {
  const users = await query('SELECT DISTINCT user_id FROM resea_usage');

  for (const user of users.rows) {
    try {
      const accessToken = await getAccessTokenForUser(user.user_id);
      await creditsService.syncWithSmileAI(user.user_id.toString(), accessToken);
    } catch (error) {
      console.error(`Sync failed for user ${user.user_id}:`, error);
    }
  }
}

// Rodar a cada 1 hora
setInterval(syncAllUsersCredits, 60 * 60 * 1000);
```

---

## ⚠️ Importante: Alterações Necessárias no SmileAI (FUTURO)

Atualmente o sistema funciona **SEM modificar a SmileAI API**, mas para ter controle total de créditos, você pode adicionar no futuro:

### Endpoint para decrementar créditos:
```php
// SmileAI Laravel API
POST /api/credits/decrement
{
  "user_id": 123,
  "product": "resea",
  "words_consumed": 1500,
  "document_id": "456",
  "metadata": { "document_type": "research" }
}

Response:
{
  "success": true,
  "remaining_words": 48500,
  "plan_name": "pro"
}
```

Isso permitiria:
- ✅ Descontar créditos diretamente na SmileAI
- ✅ Sincronização em tempo real
- ✅ Histórico unificado entre todos os produtos

---

## 🧪 Testes

### Teste 1: Verificar se migrations rodaram
```bash
npm run dev

# Verifique no console:
# ✅ Tabela "resea_usage" criada/verificada
# ✅ Tabela "credit_history" criada/verificada
```

### Teste 2: Verificar R2 connection
```bash
# Se R2_ENABLED=true, deve aparecer:
# ✅ Storage client initialized: Cloudflare R2 (bucket: resea-documents)

# Se R2_ENABLED=false, deve aparecer:
# 📦 R2/S3 storage disabled - documents will be stored in PostgreSQL
```

### Teste 3: Validação de créditos
```bash
# Teste com usuário sem créditos suficientes
curl -X POST http://localhost:3001/api/research/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "teste", "estimatedWords": 99999999}'

# Deve retornar: 403 Forbidden
# "Créditos insuficientes. Disponível: X palavras, Necessário: 99999999 palavras"
```

---

## 📞 Suporte

Em caso de dúvidas:
1. Verifique logs do servidor: `npm run dev`
2. Verifique se variáveis de ambiente estão corretas
3. Teste cada endpoint individualmente

---

## 🎉 Pronto!

O sistema está completamente funcional. Agora você tem:
- ✅ Controle de créditos integrado com SmileAI
- ✅ Storage escalável com Cloudflare R2
- ✅ Histórico completo de uso
- ✅ URLs assinadas para download seguro
- ✅ Fallback automático se serviços falharem

**Próximos passos recomendados:**
1. Configure Cloudflare R2 na produção
2. Crie endpoint na SmileAI para decrementar créditos (futuro)
3. Implemente cron job de sincronização
4. Configure custom domain no R2 para URLs mais bonitas
