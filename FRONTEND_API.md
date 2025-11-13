# 📡 API do Backend - Documentação para Frontend

Este documento lista todos os endpoints disponíveis para integração com o frontend.

---

## 🔐 Autenticação

Todos os endpoints requerem autenticação via **Bearer Token** (OAuth da SmileAI):

```bash
Authorization: Bearer {access_token}
```

O token é obtido através do fluxo OAuth2 da SmileAI.

---

## 💳 Sistema de Créditos

### 1. Obter Estatísticas de Créditos

**Endpoint:** `GET /api/research/credits`

**Descrição:** Retorna informações sobre o plano do usuário e documentos disponíveis.

**Request:**
```bash
GET /api/research/credits
Authorization: Bearer {access_token}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "plan": "standard",
  "limit": 10,
  "consumed": 3,
  "remaining": 7,
  "percentage": 30,
  "is_active": true,
  "next_reset": "26 dias",
  "purchase_date": "2024-01-15T10:00:00Z",
  "message": "Você pode gerar mais 7 documentos este mês."
}
```

**Campos:**
- `plan`: Nome do plano (básico, standard, premium, enterprise)
- `limit`: Limite mensal de documentos do plano
- `consumed`: Documentos já gerados este mês
- `remaining`: Documentos restantes
- `percentage`: Porcentagem consumida (0-100)
- `is_active`: Se o plano está ativo
- `next_reset`: Tempo até próxima renovação (em dias)

**Uso no Frontend:**
- **Header/Navbar Badge**: Exibir `remaining` documentos disponíveis
- **Tooltip**: Mostrar detalhes completos (plano, limite, renovação)
- **Progresso**: Barra de progresso usando `percentage`

---

### 2. Histórico de Uso de Créditos

**Endpoint:** `GET /api/research/credits/history`

**Descrição:** Retorna histórico detalhado de documentos gerados.

**Request:**
```bash
GET /api/research/credits/history?limit=50
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `limit` (opcional): Número máximo de itens (padrão: 50)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 123,
      "words_used": 1500,
      "action": "document_generation",
      "document_title": "Machine Learning em Saúde",
      "document_type": "research",
      "created_at": "2024-01-20T15:30:00Z"
    },
    {
      "id": 122,
      "words_used": 800,
      "action": "document_generation",
      "document_title": "Análise de Dados",
      "document_type": "article",
      "created_at": "2024-01-18T10:00:00Z"
    }
  ],
  "count": 2
}
```

**Uso no Frontend:**
- **Página de Histórico**: Tabela com lista de documentos gerados
- **Dashboard**: Gráficos de uso ao longo do tempo

---

## 📄 Documentos

### 3. Listar Documentos (Histórico)

**Endpoint:** `GET /api/documents`

**Descrição:** Retorna lista de documentos do usuário (para sidebar/histórico).

**Request:**
```bash
GET /api/documents?limit=50&offset=0
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `limit` (opcional): Número de documentos por página (máx: 100, padrão: 50)
- `offset` (opcional): Paginação - número de documentos para pular (padrão: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "title": "Machine Learning em Saúde",
      "document_type": "research",
      "template_id": "template_001",
      "word_count": 1500,
      "status": "completed",
      "created_at": "2024-01-20T15:30:00Z"
    },
    {
      "id": 455,
      "title": "Análise de Dados com Python",
      "document_type": "article",
      "template_id": null,
      "word_count": 800,
      "status": "completed",
      "created_at": "2024-01-18T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

**Uso no Frontend:**
- **Sidebar**: Lista de documentos agrupados por data (Hoje, Ontem, Esta Semana, Mais Antigos)
- **Paginação**: Carregar mais documentos ao rolar (infinite scroll)

**Exemplo de Agrupamento:**
```typescript
function groupDocumentsByDate(documents: Document[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);

  return {
    today: documents.filter(d => new Date(d.created_at) >= today),
    yesterday: documents.filter(d => {
      const date = new Date(d.created_at);
      return date >= yesterday && date < today;
    }),
    thisWeek: documents.filter(d => {
      const date = new Date(d.created_at);
      return date >= thisWeek && date < yesterday;
    }),
    older: documents.filter(d => new Date(d.created_at) < thisWeek)
  };
}
```

---

### 4. Obter Documento Específico

**Endpoint:** `GET /api/documents/:id`

**Descrição:** Retorna metadados do documento + URL de download R2 (se armazenado em nuvem).

**Request:**
```bash
GET /api/documents/456
Authorization: Bearer {access_token}
```

**Response (Documento no R2):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "user_id": 123,
    "title": "Machine Learning em Saúde",
    "content": "",
    "document_type": "research",
    "template_id": "template_001",
    "research_query": "Machine Learning aplicado à saúde",
    "status": "completed",
    "word_count": 1500,
    "s3_key": "documents/123/456.html",
    "s3_url": "https://resea-documents.r2.cloudflarestorage.com/...",
    "file_format": "html",
    "download_url": "https://...presigned-url...?expires=3600",
    "storage_type": "r2",
    "created_at": "2024-01-20T15:30:00Z",
    "updated_at": "2024-01-20T15:30:00Z"
  }
}
```

**Response (Documento no PostgreSQL):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "title": "Machine Learning em Saúde",
    "content": "<html>...</html>",
    "storage_type": "postgresql",
    ...
  }
}
```

**Campos Importantes:**
- `download_url`: URL assinada válida por 1 hora (apenas R2)
- `storage_type`: `"r2"` ou `"postgresql"`
- `file_format`: Formato do arquivo (html, pdf, docx, txt, md)

**Uso no Frontend:**
- **Visualização de Documento**: Abrir modal com preview
- **Download Rápido**: Usar `download_url` para download direto (R2)

---

### 5. Obter Conteúdo Completo do Documento

**Endpoint:** `GET /api/documents/:id/content`

**Descrição:** Retorna o conteúdo completo do documento (HTML/texto).
Faz download do R2 automaticamente se necessário.

**Request:**
```bash
GET /api/documents/456/content
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "content": "<html><head><title>Machine Learning em Saúde</title></head><body>...</body></html>",
  "message": "Conteúdo recuperado com sucesso"
}
```

**Uso no Frontend:**
- **Preview Modal**: Exibir conteúdo HTML em iframe ou div
- **Editor**: Carregar conteúdo para edição
- **Copy to Clipboard**: Copiar texto completo

---

### 6. Download Direto do Documento

**Endpoint:** `GET /api/documents/:id/download`

**Descrição:** Faz download do documento como arquivo (com headers apropriados).

**Request:**
```bash
GET /api/documents/456/download
Authorization: Bearer {access_token}
```

**Response:**
```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Disposition: attachment; filename="Machine_Learning_em_Saude.html"
Cache-Control: no-cache

<html>...</html>
```

**Uso no Frontend:**
```typescript
// Botão de download
async function downloadDocument(documentId: number) {
  const response = await fetch(`/api/documents/${documentId}/download`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'document.html';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

---

### 7. Deletar Documento

**Endpoint:** `DELETE /api/documents/:id`

**Descrição:** Deleta documento (tanto do R2 quanto do PostgreSQL).

**Request:**
```bash
DELETE /api/documents/456
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Documento deletado com sucesso"
}
```

**Erro (Não Encontrado):**
```json
{
  "success": false,
  "error": "Documento não encontrado"
}
```

**Uso no Frontend:**
- **Botão Deletar**: Confirmar antes de deletar
- **Atualização de Lista**: Remover da sidebar após deletar

---

### 8. Estatísticas do Usuário

**Endpoint:** `GET /api/documents/stats/user`

**Descrição:** Retorna estatísticas gerais dos documentos do usuário.

**Request:**
```bash
GET /api/documents/stats/user
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_documents": 25,
    "total_words": 37500,
    "documents_this_month": 8,
    "most_used_type": "research",
    "storage_usage_mb": 12.5
  }
}
```

---

## 🔍 Histórico de Buscas

### 9. Salvar Busca Realizada

**Endpoint:** `POST /api/documents/search/save`

**Descrição:** Salva uma query de busca no histórico.

**Request:**
```bash
POST /api/documents/search/save
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "query": "Machine Learning em saúde",
  "results_count": 45
}
```

**Response:**
```json
{
  "success": true,
  "message": "Busca salva com sucesso"
}
```

---

### 10. Obter Histórico de Buscas

**Endpoint:** `GET /api/documents/search/history`

**Descrição:** Retorna histórico de buscas realizadas.

**Request:**
```bash
GET /api/documents/search/history?limit=20
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "query": "Machine Learning em saúde",
      "results_count": 45,
      "created_at": "2024-01-20T15:30:00Z"
    },
    {
      "id": 788,
      "query": "Deep Learning",
      "results_count": 120,
      "created_at": "2024-01-19T10:00:00Z"
    }
  ]
}
```

**Uso no Frontend:**
- **Sugestões de Busca**: Exibir buscas recentes
- **Auto-complete**: Sugerir queries anteriores

---

## 🎨 Exemplos de Componentes React

### CreditsBadge (Header)

```typescript
import { useEffect, useState } from 'react';

interface CreditStats {
  plan: string;
  limit: number;
  consumed: number;
  remaining: number;
  percentage: number;
  next_reset: string;
}

export function CreditsBadge() {
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/research/credits', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Erro ao carregar créditos:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();

    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchCredits, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) return <div>Carregando...</div>;

  return (
    <div className="credits-badge" title={`Plano ${stats.plan} - Renova em ${stats.next_reset}`}>
      <span className="icon">📄</span>
      <span className="count">{stats.remaining}</span>
      <span className="label">documentos</span>

      {/* Tooltip com detalhes */}
      <div className="tooltip">
        <p><strong>Plano:</strong> {stats.plan}</p>
        <p><strong>Limite mensal:</strong> {stats.limit} documentos</p>
        <p><strong>Consumidos:</strong> {stats.consumed}</p>
        <p><strong>Restantes:</strong> {stats.remaining}</p>
        <p><strong>Renova em:</strong> {stats.next_reset}</p>
        <div className="progress-bar">
          <div className="fill" style={{ width: `${stats.percentage}%` }} />
        </div>
      </div>
    </div>
  );
}
```

---

### DocumentsSidebar

```typescript
import { useEffect, useState } from 'react';

interface Document {
  id: number;
  title: string;
  document_type: string;
  word_count: number;
  created_at: string;
}

export function DocumentsSidebar() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch('/api/documents?limit=50', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        setDocuments(data.data);
      } catch (error) {
        console.error('Erro ao carregar documentos:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  // Agrupar por data
  const grouped = groupDocumentsByDate(documents);

  async function handleDelete(documentId: number) {
    if (!confirm('Deseja realmente deletar este documento?')) return;

    try {
      await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      // Atualizar lista
      setDocuments(docs => docs.filter(d => d.id !== documentId));
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
    }
  }

  async function handleDownload(documentId: number) {
    const response = await fetch(`/api/documents/${documentId}/download`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (loading) return <div>Carregando histórico...</div>;

  return (
    <div className="documents-sidebar">
      <h3>Documentos Gerados</h3>

      {/* Hoje */}
      {grouped.today.length > 0 && (
        <div className="group">
          <h4>Hoje</h4>
          {grouped.today.map(doc => (
            <DocumentItem
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Ontem */}
      {grouped.yesterday.length > 0 && (
        <div className="group">
          <h4>Ontem</h4>
          {grouped.yesterday.map(doc => (
            <DocumentItem
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Esta Semana */}
      {grouped.thisWeek.length > 0 && (
        <div className="group">
          <h4>Esta Semana</h4>
          {grouped.thisWeek.map(doc => (
            <DocumentItem
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Mais Antigos */}
      {grouped.older.length > 0 && (
        <div className="group">
          <h4>Mais Antigos</h4>
          {grouped.older.map(doc => (
            <DocumentItem
              key={doc.id}
              document={doc}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentItem({ document, onDelete, onDownload }: {
  document: Document;
  onDelete: (id: number) => void;
  onDownload: (id: number) => void;
}) {
  return (
    <div className="document-item">
      <div className="info">
        <h5>{document.title}</h5>
        <span className="meta">
          {document.word_count} palavras • {document.document_type}
        </span>
      </div>
      <div className="actions">
        <button onClick={() => onDownload(document.id)}>⬇️</button>
        <button onClick={() => onDelete(document.id)}>🗑️</button>
      </div>
    </div>
  );
}
```

---

## 🚨 Tratamento de Erros

Todos os endpoints retornam respostas padronizadas:

**Sucesso:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro descritiva"
}
```

**Códigos HTTP:**
- `200 OK` - Sucesso
- `201 Created` - Recurso criado com sucesso
- `400 Bad Request` - Requisição inválida
- `401 Unauthorized` - Não autenticado
- `403 Forbidden` - Sem créditos ou permissão
- `404 Not Found` - Recurso não encontrado
- `500 Internal Server Error` - Erro do servidor

---

## 📋 Resumo dos Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/research/credits` | Estatísticas de créditos |
| GET | `/api/research/credits/history` | Histórico de uso |
| GET | `/api/documents` | Listar documentos |
| GET | `/api/documents/:id` | Obter documento (metadados + URL R2) |
| GET | `/api/documents/:id/content` | Obter conteúdo completo |
| GET | `/api/documents/:id/download` | Download direto |
| DELETE | `/api/documents/:id` | Deletar documento |
| GET | `/api/documents/stats/user` | Estatísticas do usuário |
| POST | `/api/documents/search/save` | Salvar busca |
| GET | `/api/documents/search/history` | Histórico de buscas |

---

## 🎯 Próximos Passos

1. **Implementar componentes no frontend** usando os exemplos acima
2. **Testar integração** com tokens OAuth reais
3. **Configurar polling/refresh** para atualizar créditos automaticamente
4. **Adicionar animações** para melhor UX (loading states, transitions)
5. **Implementar cache no frontend** (React Query, SWR) para melhor performance

---

**Documentação criada em:** 2024-01-20
**Versão da API:** 1.0
**Backend:** Node.js + Express + TypeScript + PostgreSQL + Cloudflare R2
