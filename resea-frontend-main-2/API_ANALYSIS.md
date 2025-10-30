# 📚 Análise da API SmileAI - OpenAPI 3.0.0

## 📋 Visão Geral

**Versão**: 1.0.0  
**Autenticação**: OAuth2 (Laravel Passport)  
**Base URL**: `https://smileai.com.br/`

---

## 🔐 Autenticação

### Security Scheme
- **Tipo**: OAuth2 (Password Flow)
- **Endpoints**:
  - Autorização: `http://localhost:8000/oauth/authorize`
  - Token: `http://localhost:8000/oauth/token`
  - Refresh: `http://localhost:8000/token/refresh`

---

## 📡 Endpoints Principais por Categoria

### 1️⃣ **AI Chats (Conversações)**

#### GET `/api/aichat/history/{cat_slug}`
- **Descrição**: Obter conversas de chatbot por categoria
- **Parâmetros**: `cat_slug` (string, obrigatório)
- **Respostas**: 200 (sucesso), 404 (não encontrado)

#### GET `/api/aichat/recent-chats`
- **Descrição**: Obter últimas 20 conversas recentes
- **Autenticação**: Requerida (Passport)

#### POST `/api/aichat/search-recent-chats`
- **Descrição**: Buscar e retornar últimas 20 conversas

#### POST `/api/aichat/new-chat`
- **Descrição**: Criar nova conversa
- **Parâmetros**: `category_id` (obrigatório)
- **Respostas**: 200 (sucesso), 401 (não autenticado), 412 (precondição falhou)

#### DELETE `/api/aichat/history`
- **Descrição**: Deletar uma conversa
- **Parâmetros**: `conver_id` (obrigatório)
- **Respostas**: 204 (deletado), 401, 403, 404, 412

#### PATCH `/api/aichat/history`
- **Descrição**: Renomear uma conversa
- **Parâmetros**: `conver_id`, `title`

#### POST `/api/aichat/search-history`
- **Descrição**: Buscar conversas em categoria
- **Parâmetros**: `category_id`, `search_word`

#### GET `/api/aichat/chat/chat-send`
- **Descrição**: Recuperar detalhes do chat (streaming SSE)
- **Parâmetros**: `conver_id`, `message_id`
- **Content-Type**: `text/event-stream`

#### POST `/api/aichat/chat/chat-send`
- **Descrição**: Processar saída do chat
- **Parâmetros**: `conver_id`, `prompt`, `category_id`
- **Respostas**: 200 (sucesso), 419 (sem créditos), 500 (erro API)

#### GET `/api/aichat/chat/{conver_id}`
- **Descrição**: Obter detalhes da conversa
- **Parâmetros**: `conver_id` (path)

#### GET `/api/aichat/chat/{conver_id}/messages/{id?}`
- **Descrição**: Obter mensagens do chat
- **Parâmetros**: `conver_id` (path), `id` (path, opcional), `page`, `per_page` (query)

---

### 2️⃣ **AI Writer (Gerador de Conteúdo)**

#### POST `/api/aiwriter/generate`
- **Descrição**: Gerar conteúdo baseado em entrada do usuário
- **Parâmetros obrigatórios**:
  - `post_type` (enum com 25+ tipos: summarize_text, article_generator, etc)
  - `maximum_length` (inteiro)
  - `number_of_results` (inteiro)
  - `creativity` (0-1)
  - `tone_of_voice` (string)
  - `language` (código de idioma, ex: en-US)
  - `text_to_summary` (string)
- **Respostas**: 200 (sucesso), 400 (erro), 401 (não autenticado), 500 (erro servidor)

#### GET `/api/aiwriter/generator/{slug}`
- **Descrição**: Retorna info do gerador e docs do usuário
- **Parâmetros**: `slug` (path)

#### GET `/api/aiwriter/generator/{slug}/workbook`
- **Descrição**: Retorna info do workbook do gerador

#### POST `/api/aiwriter/generate-output`
- **Descrição**: Streaming de texto (SSE)
- **Parâmetros**: `message_id`, `creativity`, `maximum_length`, `number_of_results` (query)

#### GET `/api/aiwriter/generate/lazyload`
- **Descrição**: Carregar imagens sob demanda
- **Parâmetros**: `post_type`, `offset`

#### POST `/api/aiwriter/generate/save`
- **Descrição**: Salvar resposta gerada
- **Parâmetros**: `message_id`, `response`

#### GET `/api/aiwriter/openai-list`
- **Descrição**: Obtém todos os geradores de IA relacionados a texto
- **Controla**: Acesso a geradores premium

#### GET `/api/aiwriter/favorite-openai-list`
- **Descrição**: Obtém lista de favoritos

#### POST `/api/aiwriter/favorite-openai-list-add`
- **Descrição**: Adicionar à favoritos
- **Parâmetros**: `openai_id` (query)

#### POST `/api/aiwriter/favorite-openai-list-remove`
- **Descrição**: Remover de favoritos
- **Parâmetros**: `openai_id` (query)

---

### 3️⃣ **AI Image Generation**

#### GET `/api/aiimage/versions`
- **Descrição**: Obter versões de modelos (DALL-E, Stable Diffusion)

#### GET `/api/aiimage/check-availability`
- **Descrição**: Verificar se geração de imagem está ativa
- **Respostas**: 200 (disponível), 409 (em progresso)

#### POST `/api/aiimage/generate-image`
- **Descrição**: Gerar imagem
- **Parâmetros**: DALL-E/Stable Diffusion params no request
- **Respostas**: 200, 409, retorna array `images` em JSON

---

### 4️⃣ **Geral (Helpers)**

#### GET `/api/general/favorite-openai`
- **Descrição**: Obter últimas 6 favoritos

#### GET `/api/general/recent-documents`
- **Descrição**: Obter últimos 6 documentos recentes (excluindo 'image')

#### POST `/api/general/search`
- **Descrição**: Buscar templates, workbooks, AI chats
- **Parâmetros**: `search` (string)
- **Retorna**: `template_search`, `workbook_search`, `ai_chat_search`

#### GET `/api/auth/logo`
- **Descrição**: Obter caminho do logo das settings

---

### 5️⃣ **Chat Templates**

#### GET `/api/aichat/chat-templates`
- **Descrição**: Listar templates de chat ou um específico
- **Ordenação**: Por nome (ascendente)

#### POST `/api/aichat/chat-templates`
- **Descrição**: Atualizar/Criar template de chat
- **Nota**: Usa `_method: PATCH` no payload para PATCH request
- **Parâmetros**:
  - `template_id` (opcional - null cria novo)
  - `name`, `short_name`, `description`
  - `role`, `human_name`, `helps_with`, `color`
  - `chat_completions`, `avatar` (jpg, jpeg, png, svg, webp; max 5MB)

#### DELETE `/api/aichat/chat-templates/{id}`
- **Descrição**: Remover template
- **Respostas**: 204, 404, 500

---

### 6️⃣ **Documentos**

#### GET `/api/documents/recent`
- **Descrição**: Últimos 10 documentos (excluindo 'image')

#### GET `/api/documents/all-openai`
- **Descrição**: Obter todos os geradores de IA

#### GET `/api/documents/openai-filters`
- **Descrição**: Obter todos os filtros de IA

#### GET `/api/documents/`
- **Descrição**: Listar documentos do usuário
- **Parâmetros**:
  - `search` (query)
  - `filter` (values: 'all' ou nome da coluna 'openai_filters')
  - `sort` (values: 'newest', 'oldest', 'az', 'za')

#### GET `/api/documents/doc/{id}`
- **Descrição**: Obter documento único
- **Respostas**: 200, 401, 404, 412

#### POST `/api/documents/doc/{id}`
- **Descrição**: Atualizar documento
- **Parâmetros**: `output` (HTML), `title`

#### DELETE `/api/documents/doc/{id}`
- **Descrição**: Deletar documento

---

### 7️⃣ **Pagamentos**

#### GET `/api/payment/`
- **Descrição**: Plano de subscrição atual do usuário

#### GET `/api/payment/subscriptions/cancel-current`
- **Descrição**: Cancelar subscrição atual

#### GET `/api/payment/plans/{plan_id?}`
- **Descrição**: Obter todos os planos
- **Parâmetros**: `plan_id` (path, opcional)

#### GET `/api/payment/orders/{order_id?}`
- **Descrição**: Obter todos os pedidos
- **Parâmetros**: `order_id` (path, opcional)

#### GET `/api/payment/check-revenue-cat`
- **Descrição**: Disparar RevenueCat para verificar status
- **Respostas**: 200, 401, 403, 404, 412, 500

---

### 8️⃣ **Configurações da App**

#### GET `/api/app/email-confirmation-setting`
- **Descrição**: Obter setting de confirmação de email
- **Retorna**: `{ emailconfirmation: boolean }`

#### GET `/api/app/get-setting`
- **Descrição**: Obter configurações gerais da aplicação

#### GET `/api/app/usage-data`
- **Descrição**: Obter dados de uso e plano de subscrição do usuário
- **⭐ Importante**: Este é o endpoint que você está usando para obter `words_left`

#### GET `/api/app/currency/{id?}`
- **Descrição**: Obter moeda padrão
- **Parâmetros**: `id` (null=padrão, 'all'=todas)

---

### 9️⃣ **Autenticação**

#### POST `/api/auth/register`
- **Descrição**: Registrar novo usuário
- **Parâmetros**: `name`, `surname`, `email`, `password`, `password_confirmation`, `affiliate_code` (opcional)

#### POST `/api/auth/logout`
- **Descrição**: Fazer logout

#### POST `/api/auth/forgot-password`
- **Descrição**: Iniciar reset de senha

#### GET `/api/auth/email/verify`
- **Descrição**: Verificar email
- **Parâmetros**: `email_confirmation_code`

#### POST `/api/auth/email/verify/resend`
- **Descrição**: Reenviar email de confirmação

#### GET `/api/auth/social-login`
- **Descrição**: Obter métodos de login suportados
- **Retorna**: Array com strings (ex: ['github', 'google'])

#### POST `/api/auth/google-login`
- **Descrição**: Login social com Google
- **Parâmetros**: `google_token`, `google_id`

#### POST `/api/auth/apple-login`
- **Descrição**: Login social com Apple
- **Parâmetros**: `apple_token`, `apple_id`

#### GET `/api/auth/profile`
- **Descrição**: Obter perfil do usuário autenticado

#### POST `/api/auth/profile`
- **Descrição**: Atualizar perfil (PATCH via `_method`)
- **Parâmetros**: `name`, `surname`, `phone`, `country`, `old_password`, `new_password`, `new_password_confirmation`, `avatar`

#### DELETE `/api/auth/profile`
- **Descrição**: Deletar conta do usuário

---

### 🔟 **Brand Voice**

#### GET `/api/brandvoice`
- **Descrição**: Listar empresas de Brand Voice
- **Parâmetros**: `id` (path, opcional)

#### POST `/api/brandvoice`
- **Descrição**: Atualizar/Criar empresa

#### DELETE `/api/brandvoice/{id}`
- **Descrição**: Deletar empresa

---

### 1️⃣1️⃣ **Afiliados**

#### GET `/api/affiliates/`
- **Descrição**: Obter totais de afiliado (earnings, withdrawals)

#### GET `/api/affiliates/withdrawals`
- **Descrição**: Listar saques de afiliado

#### POST `/api/affiliates/request-withdrawal`
- **Descrição**: Solicitar saque
- **Parâmetros**: `affiliate_bank_account`, `amount`

---

### 1️⃣2️⃣ **Suporte**

#### GET `/api/support/`
- **Descrição**: Obter todas as requisições de suporte

#### GET `/api/support/ticket/{ticket_id}`
- **Descrição**: Obter mensagens de ticket
- **Nota**: Use IDs como 'QZDNGSIFPH', não inteiros

#### GET `/api/support/ticket/{ticket_id}/last-message`
- **Descrição**: Obter última mensagem do ticket

#### POST `/api/support/new-ticket`
- **Descrição**: Criar novo ticket
- **Parâmetros**:
  - `priority` (Low, Normal, High, Critical)
  - `category` (General Inquiry, Technical Issue, Improvement Idea, Feedback, Other)
  - `subject`, `message`

#### POST `/api/support/send-message`
- **Descrição**: Enviar mensagem para ticket
- **Parâmetros**: `ticket_id`, `message`

#### GET `/api/support/user/{ticket_id}`
- **Descrição**: Obter informações do usuário que criou ticket

---

## 🎯 Endpoints Críticos para seu App

### Para o Frontend (Resea):

1. **`GET /api/app/usage-data`** ⭐
   - Você está usando isto para `words_left`
   - Retorna: `words_left`, `total_words`, `plan_name`, `plan_status`

2. **`GET /api/auth/profile`**
   - Dados do usuário autenticado

3. **`POST /api/aiwriter/generate`**
   - Gerar conteúdo (seu core feature)

4. **`GET /api/documents/`**
   - Listar documentos gerados

5. **`DELETE /api/documents/doc/{id}`**
   - Deletar documento

6. **`GET /api/aichat/history/{cat_slug}`**
   - Obter conversas por categoria

---

## ⚠️ Códigos de Resposta Principais

| Código | Significado |
|--------|-------------|
| 200 | ✅ Sucesso |
| 201 | ✅ Criado |
| 204 | ✅ Deletado (sem conteúdo) |
| 400 | ❌ Requisição inválida |
| 401 | ❌ Não autenticado |
| 403 | ❌ Proibido (sem permissão) |
| 404 | ❌ Não encontrado |
| 412 | ⚠️ Precondição falhou (ex: sem créditos) |
| 419 | ⚠️ Sem créditos |
| 500 | ❌ Erro no servidor |

---

## 🔄 Headers Importantes

```
Authorization: Bearer {access_token}
Content-Type: application/json (ou multipart/form-data para uploads)
```

---

## 📝 Notas Importantes

1. **Streaming**: Alguns endpoints retornam `text/event-stream`:
   - `/api/aichat/chat/chat-send` (GET)
   - `/api/aiwriter/generate-output` (POST)

2. **Method Spoofing**: Alguns endpoints POST usam `_method: PATCH` ou `_method: DELETE` no payload (Laravel convention)

3. **Paginação**: Endpoints de lista suportam `page` e `per_page` em query params

4. **Upload de Arquivos**: Parâmetros com `type: string, format: binary` usam `multipart/form-data`

5. **Tipos Suportados**:
   - Imagem: jpg, jpeg, png, svg, webp (max 5MB)
   - Avatar: jpg, png (max 5MB)

---

## 🚀 Recomendações para Integração

1. ✅ Você já está usando `/api/app/usage-data` corretamente
2. ✅ Token refresh está implementado
3. ✅ Cache de 30s é bom para dados de uso
4. ✅ Fallback para 100 palavras se nenhum dado é inteligente

### Próximos Passos:
- Implementar geração de conteúdo (`/api/aiwriter/generate`)
- Integrar chat (`/api/aichat/new-chat`, `/api/aichat/chat/chat-send`)
- Listar documentos criados (`/api/documents/`)
- Sistema de favoritos (`/api/aiwriter/favorite-openai-list-add`)

---

**Última atualização**: 29/10/2025  
**Fonte**: OpenAPI 3.0.0 Documentation - SmileAI API
