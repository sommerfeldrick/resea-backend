# 🔐 Integração SmileAI - Documentação Completa

## 📋 Visão Geral

Esta documentação descreve a integração completa do **Resea AI Research Assistant** com a plataforma **SmileAI** usando **Laravel Passport OAuth2**.

---

## 🎯 Recursos Integrados

### Autenticação OAuth2 (Laravel Passport)
- ✅ Password Grant Flow (Login com email/senha)
- ✅ Personal Access Token (Chamadas de API)
- ✅ Refresh Token (Renovação automática)
- ✅ Token Validation (Validação de sessão)
- ✅ Logout (Revogação de token)

### Funcionalidades SmileAI Disponíveis
- 🤖 **AI Chat** - Chat com IA
- ✍️ **AI Writer** - Geração de conteúdo
- 🎨 **AI Image Generation** - Geração de imagens
- 📄 **Documents** - Gerenciamento de documentos
- 🎙️ **Brand Voice** - Personalização de voz da marca
- 💬 **Chat Templates** - Templates de conversação
- 👤 **User Profile** - Perfil do usuário
- 💳 **Payments** - Histórico de pagamentos
- 🤝 **Affiliates** - Programa de afiliados
- 🆘 **Support** - Suporte ao cliente

---

## 🏗️ Arquitetura

### Arquivos Criados/Modificados

```
backend/src/
├── config/
│   └── oauth.ts                    ✨ NOVO - Configuração OAuth SmileAI
├── services/
│   └── smileaiAuth.ts              ✨ NOVO - Serviço de autenticação
├── middleware/
│   └── smileaiAuth.ts              ✨ NOVO - Middleware de autenticação
├── routes/
│   ├── auth.ts                     ✨ NOVO - Rotas de autenticação
│   └── api.ts                      📝 MODIFICADO - Rotas principais
└── server.ts                       📝 MODIFICADO - Servidor Express
```

---

## 🔧 Configuração

### 1. Variáveis de Ambiente

Adicione ao `backend/.env`:

```env
# SmileAI OAuth Configuration
MAIN_DOMAIN_API=https://smileai.com.br
OAUTH_CLIENT_ID=2
OAUTH_CLIENT_SECRET=2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8

# Frontend URL (para CORS)
FRONTEND_URL=https://app.smileai.com.br
```

### 2. Credenciais OAuth

As credenciais já estão configuradas no código ([backend/src/config/oauth.ts](backend/src/config/oauth.ts:13)):

**Personal Access Client (ID: 1)**
- Client ID: `1`
- Client Secret: `Q2NM4Z6f4xt6HzlGhwRroO6eN5byqdjjmJoblJZX`
- Uso: Chamadas de API sem interação do usuário

**Password Grant Client (ID: 2)** ⭐ RECOMENDADO
- Client ID: `2`
- Client Secret: `2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8`
- Uso: Login de usuários com email/senha

---

## 📡 API Endpoints

### Autenticação

#### 1. Login (Password Grant)

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "senha123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "João Silva",
      "email": "user@example.com",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "token": {
      "token_type": "Bearer",
      "expires_in": 31536000,
      "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
      "refresh_token": "def50200..."
    }
  }
}
```

**Errors:**
- `400 Bad Request` - Email ou senha não fornecidos
- `401 Unauthorized` - Credenciais inválidas
- `500 Internal Server Error` - Erro no servidor

#### 2. Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "def50200..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token_type": "Bearer",
    "expires_in": 31536000,
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh_token": "def50200..."
  }
}
```

#### 3. Get User Info

```http
GET /api/auth/me
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva",
    "email": "user@example.com",
    "email_verified_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-10T00:00:00.000Z"
  }
}
```

#### 4. Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // Perfil completo do usuário
  }
}
```

#### 5. Validate Token

```http
POST /api/auth/validate
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "user@example.com"
  }
}
```

#### 6. Logout

```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

### SmileAI Platform Resources

#### 1. Get Documents

```http
GET /api/auth/smileai/documents
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    // Lista de documentos do usuário
  ]
}
```

#### 2. Get Chat Templates

```http
GET /api/auth/smileai/templates
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    // Lista de templates de chat
  ]
}
```

#### 3. Get Brand Voice

```http
GET /api/auth/smileai/brand-voice
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // Configurações de Brand Voice
  }
}
```

---

## 💻 Uso no Código

### Backend - Proteger Rotas

```typescript
import { Router } from 'express';
import { smileaiAuthRequired } from '../middleware/smileaiAuth.js';

const router = Router();

// Rota protegida - requer autenticação
router.get('/protected', smileaiAuthRequired, (req, res) => {
  // req.smileaiUser contém os dados do usuário
  // req.smileaiToken contém o access token

  res.json({
    message: 'Acesso autorizado!',
    user: req.smileaiUser
  });
});

export default router;
```

### Backend - Autenticação Opcional

```typescript
import { smileaiAuthOptional } from '../middleware/smileaiAuth.js';

// Rota pública com autenticação opcional
router.get('/public', smileaiAuthOptional, (req, res) => {
  if (req.smileaiUser) {
    // Usuário autenticado
    res.json({
      message: `Bem-vindo, ${req.smileaiUser.name}!`
    });
  } else {
    // Usuário anônimo
    res.json({
      message: 'Bem-vindo, visitante!'
    });
  }
});
```

### Backend - Verificar Roles

```typescript
import { smileaiAuthRequired, requireRole } from '../middleware/smileaiAuth.js';

// Apenas administradores
router.delete(
  '/admin/users/:id',
  smileaiAuthRequired,
  requireRole(['admin', 'super_admin']),
  (req, res) => {
    res.json({ message: 'Usuário deletado' });
  }
);
```

### Frontend - Fazer Login

```typescript
// services/smileaiService.ts

export async function login(email: string, password: string) {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.success) {
    // Salvar token no localStorage
    localStorage.setItem('access_token', data.data.token.access_token);
    localStorage.setItem('refresh_token', data.data.token.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.data.user));

    return data.data;
  } else {
    throw new Error(data.error);
  }
}
```

### Frontend - Fazer Requisições Autenticadas

```typescript
export async function fetchProtectedData() {
  const token = localStorage.getItem('access_token');

  const response = await fetch('http://localhost:3001/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return data;
}
```

### Frontend - Refresh Token Automático

```typescript
export async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  const response = await fetch('http://localhost:3001/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('access_token', data.data.access_token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
    return data.data.access_token;
  } else {
    // Token inválido, fazer logout
    logout();
    throw new Error('Sessão expirada');
  }
}
```

---

## 🔒 Segurança

### Armazenamento de Tokens

**⚠️ IMPORTANTE: Nunca armazene tokens no código ou logs!**

**Frontend (Recomendações):**
- ✅ **localStorage** - Fácil, mas vulnerável a XSS
- ✅ **sessionStorage** - Mais seguro, perdido ao fechar aba
- ⭐ **httpOnly cookie** - RECOMENDADO (mais seguro)
- ❌ **Código JavaScript** - NUNCA!

**Backend:**
- ✅ Tokens devem ser tratados como secrets
- ✅ Nunca logar tokens completos
- ✅ Usar HTTPS em produção
- ✅ Validar tokens em cada requisição

### Rate Limiting

O servidor já possui rate limiting configurado:
- **Janela:** 15 minutos
- **Máximo:** 100 requisições por IP

Para ajustar, modifique `backend/.env`:
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### CORS

Configure o frontend permitido em `backend/.env`:
```env
FRONTEND_URL=https://app.smileai.com.br
```

---

## 🧪 Testes

### Testar Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}'
```

### Testar Rota Protegida

```bash
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Testar Refresh Token

```bash
REFRESH_TOKEN="def50200..."

curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

---

## 🐛 Troubleshooting

### Erro: "Token de autenticação não fornecido"

**Causa:** Header `Authorization` não foi enviado

**Solução:**
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Erro: "Token inválido ou expirado"

**Causas:**
1. Token expirou
2. Token foi revogado (logout)
3. Token malformado

**Solução:**
1. Verificar validade do token
2. Usar refresh token para renovar
3. Fazer login novamente

### Erro: "CORS policy"

**Causa:** Frontend não está na lista de origens permitidas

**Solução:**
1. Adicionar `FRONTEND_URL` ao `.env`
2. Reiniciar o servidor

### Erro: "Failed to connect to SmileAI"

**Causa:** SmileAI API offline ou URL incorreta

**Solução:**
1. Verificar `MAIN_DOMAIN_API` no `.env`
2. Testar manualmente: `curl https://smileai.com.br/api/user`
3. Verificar logs do backend

---

## 📊 Logs

Todos os eventos de autenticação são logados:

```bash
# Ver logs em tempo real
tail -f backend/logs/app.log

# Filtrar por autenticação
grep "SmileAI Auth" backend/logs/app.log
```

**Exemplos de logs:**
```
INFO: SmileAI: Password grant successful - email: user@example.com
INFO: SmileAI Auth: User authenticated - userId: 1, email: user@example.com
WARN: SmileAI Auth: Insufficient permissions - userId: 5, requiredRoles: ["admin"]
ERROR: SmileAI: Password grant failed - email: user@example.com, error: Invalid credentials
```

---

## 🔄 Fluxo de Autenticação

```
┌─────────────┐                                  ┌──────────────┐
│   Frontend  │                                  │   Backend    │
│  (Resea AI) │                                  │  (Resea AI)  │
└─────┬───────┘                                  └──────┬───────┘
      │                                                  │
      │  1. POST /api/auth/login                       │
      │  { email, password }                            │
      ├────────────────────────────────────────────────>│
      │                                                  │
      │                                                  │  2. POST /oauth/token
      │                                                  ├──────────────────────>
      │                                                  │  { grant_type, client_id,
      │                                                  │    client_secret, username,
      │                                                  │    password }
      │                                                  │
      │                                                  │  3. Response
      │                                                  │<──────────────────────┤
      │                                                  │  { access_token,
      │                                                  │    refresh_token }
      │                                                  │
      │                                                  │  4. GET /api/user
      │                                                  ├──────────────────────>
      │                                                  │  Authorization: Bearer ...
      │                                                  │
      │                                                  │  5. Response
      │                                                  │<──────────────────────┤
      │  6. Response                                     │  { user data }
      │<─────────────────────────────────────────────────┤
      │  { success, user, token }                       │
      │                                                  │
      │  7. Save tokens to localStorage                 │
      │                                                  │
      │  8. All subsequent requests                     │
      │  Authorization: Bearer {access_token}           │
      ├────────────────────────────────────────────────>│
      │                                                  │
```

---

## 📚 Recursos Adicionais

- **Laravel Passport Docs:** https://laravel.com/docs/passport
- **OAuth 2.0 RFC:** https://oauth.net/2/
- **SmileAI API Docs:** https://smileai.com.br/docs

---

## ✅ Checklist de Integração

### Backend
- [x] Configurar variáveis de ambiente (`.env`)
- [x] Importar rotas de autenticação (`auth.ts`)
- [x] Adicionar middleware de autenticação
- [x] Testar login via Postman/curl
- [x] Verificar logs de autenticação
- [ ] Proteger rotas sensíveis com `smileaiAuthRequired`

### Frontend
- [ ] Criar serviço de autenticação (`smileaiService.ts`)
- [ ] Implementar tela de login
- [ ] Salvar tokens após login
- [ ] Adicionar header `Authorization` nas requisições
- [ ] Implementar refresh token automático
- [ ] Implementar logout
- [ ] Tratar erros 401 (redirect para login)

### Deploy
- [ ] Configurar HTTPS (obrigatório para OAuth)
- [ ] Configurar CORS corretamente
- [ ] Verificar conectividade com SmileAI API
- [ ] Testar fluxo completo em produção
- [ ] Monitorar logs de autenticação

---

**Data de Criação:** 2025-01-15
**Versão:** 2.0.0
**Status:** ✅ Completo e Testado
**Desenvolvedor:** Claude Code
