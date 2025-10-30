# 🔐 Integração SSO com smileai.com.br

## 📋 Documentação de Integração

Este documento detalha como integrar o **Resea AI Research Assistant** com o sistema de autenticação existente em `smileai.com.br`.

---

## 🎯 Objetivo

Permitir que usuários logados em `smileai.com.br` acessem `app.smileai.com.br` sem novo login, usando tokens JWT compartilhados.

---

## 🏗️ Arquitetura SSO

```
┌──────────────────────────────────────────────────────────┐
│              smileai.com.br (Domínio Principal)          │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Sistema de Autenticação Existente                │  │
│  │                                                     │  │
│  │  POST /api/auth/login                             │  │
│  │  → Gera JWT Token                                 │  │
│  │  → Salva em Cookie (httpOnly, secure, SameSite)  │  │
│  │                                                     │  │
│  │  POST /api/auth/validate                          │  │
│  │  → Valida JWT Token                               │  │
│  │  → Retorna dados do usuário                       │  │
│  │                                                     │  │
│  │  GET /api/auth/me                                 │  │
│  │  → Retorna usuário logado                         │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ Cookie: auth_token=JWT
                        │ (Compartilhado entre domínios)
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│           app.smileai.com.br (Subdomínio - App)          │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Frontend (React)                                  │  │
│  │                                                     │  │
│  │  1. Verifica cookie auth_token                    │  │
│  │  2. Se não existe → redirect para login           │  │
│  │  3. Se existe → chama backend                     │  │
│  └──────────────────┬─────────────────────────────────┘  │
│                     │                                     │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Backend (Node.js)                                │  │
│  │                                                     │  │
│  │  Middleware SSO:                                   │  │
│  │  1. Extrai token do cookie/header                 │  │
│  │  2. Valida via smileai.com.br/api/auth/validate  │  │
│  │  3. Se válido → permite acesso                    │  │
│  │  4. Se inválido → retorna 401                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 📡 Endpoints Necessários no smileai.com.br

### 1. POST /api/auth/validate

**Descrição:** Valida um JWT token e retorna dados do usuário.

**Request:**
```http
POST https://smileai.com.br/api/auth/validate
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Response (Sucesso):**
```json
{
  "valid": true,
  "user": {
    "id": "user_123",
    "email": "usuario@example.com",
    "name": "João Silva",
    "avatar": "https://smileai.com.br/avatars/user_123.jpg",
    "plan": "premium",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

**Response (Falha):**
```json
{
  "valid": false,
  "error": "Token expirado"
}
```

---

### 2. GET /api/auth/me

**Descrição:** Retorna dados do usuário autenticado via cookie.

**Request:**
```http
GET https://smileai.com.br/api/auth/me
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "usuario@example.com",
    "name": "João Silva",
    "avatar": "https://smileai.com.br/avatars/user_123.jpg",
    "plan": "premium"
  }
}
```

---

### 3. POST /api/auth/logout

**Descrição:** Invalida token e faz logout.

**Request:**
```http
POST https://smileai.com.br/api/auth/logout
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

## 🍪 Configuração de Cookies

### Requisitos para Compartilhamento entre Domínios

Para que o cookie `auth_token` seja compartilhado entre `smileai.com.br` e `app.smileai.com.br`:

```javascript
// No backend de smileai.com.br (quando criar o cookie)
res.cookie('auth_token', token, {
  domain: '.smileai.com.br',  // ← Importante: ponto inicial para incluir subdomínios
  httpOnly: true,              // Segurança: não acessível via JavaScript
  secure: true,                // HTTPS obrigatório
  sameSite: 'lax',            // Permite envio para subdomínios
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 dias
});
```

### Exemplo de Set-Cookie Header

```
Set-Cookie: auth_token=eyJhbGci...;
            Domain=.smileai.com.br;
            Path=/;
            HttpOnly;
            Secure;
            SameSite=Lax;
            Max-Age=604800
```

---

## 🔧 Implementação no Backend (app.smileai.com.br)

### Arquivo: `backend/src/middleware/ssoAuth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { logger } from '../config/logger.js';

const MAIN_DOMAIN_API = process.env.MAIN_DOMAIN_API || 'https://smileai.com.br/api';
const SSO_TIMEOUT = 5000; // 5 segundos

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    plan: string;
  };
}

/**
 * Middleware de autenticação SSO
 */
export async function ssoAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // 1. Extrair token
    const token = extractToken(req);

    if (!token) {
      return respondUnauthorized(res, 'Token não fornecido', req.originalUrl);
    }

    // 2. Validar token via API principal
    const userData = await validateToken(token);

    if (!userData) {
      return respondUnauthorized(res, 'Token inválido ou expirado');
    }

    // 3. Anexar usuário à requisição
    req.user = userData;

    logger.info('SSO authentication successful', {
      userId: userData.id,
      email: userData.email
    });

    next();
  } catch (error: any) {
    logger.error('SSO authentication error', {
      error: error.message,
      stack: error.stack
    });

    return respondUnauthorized(res, 'Erro na autenticação');
  }
}

/**
 * Extrai token do cookie ou header
 */
function extractToken(req: Request): string | null {
  // Prioridade 1: Cookie (mais seguro)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }

  // Prioridade 2: Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Valida token via API principal
 */
async function validateToken(token: string): Promise<any | null> {
  try {
    const response = await axios.post(
      `${MAIN_DOMAIN_API}/auth/validate`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: SSO_TIMEOUT
      }
    );

    if (response.data.valid) {
      return response.data.user;
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token inválido/expirado
      return null;
    }

    // Erro de rede/servidor
    throw error;
  }
}

/**
 * Responde com 401 e informações de redirecionamento
 */
function respondUnauthorized(
  res: Response,
  message: string,
  redirectPath?: string
) {
  const redirectUrl = redirectPath
    ? `https://smileai.com.br/login?redirect=${encodeURIComponent(`https://app.smileai.com.br${redirectPath}`)}`
    : 'https://smileai.com.br/login';

  return res.status(401).json({
    success: false,
    error: message,
    redirectUrl
  });
}

/**
 * Middleware opcional - permite acesso sem autenticação
 */
export async function optionalSsoAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const userData = await validateToken(token);
    if (userData) {
      req.user = userData;
    }
  } catch (error) {
    // Ignora erro e continua sem autenticação
  }

  next();
}
```

---

## 🎨 Implementação no Frontend (app.smileai.com.br)

### Arquivo: `services/ssoService.ts`

```typescript
/**
 * SSO Service - Integração com smileai.com.br
 */

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'https://smileai.com.br';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: string;
}

/**
 * Verifica autenticação via cookie
 */
export async function checkAuth(): Promise<User | null> {
  try {
    const response = await fetch(`${MAIN_DOMAIN}/api/auth/me`, {
      method: 'GET',
      credentials: 'include', // Importante: envia cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Auth check failed', error);
    return null;
  }
}

/**
 * Redireciona para login com URL de retorno
 */
export function redirectToLogin(returnUrl?: string) {
  const redirect = returnUrl || window.location.href;
  window.location.href = `${MAIN_DOMAIN}/login?redirect=${encodeURIComponent(redirect)}`;
}

/**
 * Logout do sistema
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${MAIN_DOMAIN}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout failed', error);
  } finally {
    redirectToLogin();
  }
}

/**
 * Obtém informações do usuário
 */
export async function getUserInfo(): Promise<User | null> {
  return checkAuth();
}
```

---

### Hook React: `hooks/useAuth.ts`

```typescript
import { useState, useEffect } from 'react';
import { checkAuth, redirectToLogin, logout, type User } from '../services/ssoService';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await checkAuth();

        if (!userData) {
          // Não autenticado - redireciona
          redirectToLogin();
          return;
        }

        setUser(userData);
      } catch (err: any) {
        setError(err.message);
        redirectToLogin();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  return {
    user,
    loading,
    error,
    logout,
    isAuthenticated: !!user
  };
}
```

---

### Componente de Proteção: `components/ProtectedRoute.tsx`

```typescript
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="ml-4">Verificando autenticação...</p>
      </div>
    );
  }

  if (!user) {
    // O hook useAuth já redirecionou
    return null;
  }

  return <>{children}</>;
}
```

---

### Uso no App.tsx

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="app">
        {/* Sidebar com info do usuário */}
        <Sidebar user={user} onLogout={logout} />

        {/* Resto da aplicação */}
        <MainContent />
      </div>
    </ProtectedRoute>
  );
}
```

---

## 🧪 Testes de Integração

### 1. Teste Manual

#### Cenário 1: Login Funcional
```
1. Acesse smileai.com.br
2. Faça login
3. Verifique cookie auth_token no DevTools
4. Acesse app.smileai.com.br
5. Deve entrar direto sem novo login
```

#### Cenário 2: Sem Login
```
1. Abra aba anônima
2. Acesse app.smileai.com.br
3. Deve redirecionar para smileai.com.br/login
4. Após login, deve voltar para app.smileai.com.br
```

#### Cenário 3: Token Expirado
```
1. Login em smileai.com.br
2. Aguarde expiração (ou force no backend)
3. Acesse app.smileai.com.br
4. Deve redirecionar para login
```

---

### 2. Teste com cURL

```bash
# 1. Login (obter token)
curl -X POST https://smileai.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@example.com","password":"senha123"}' \
  -c cookies.txt

# 2. Validar token
TOKEN=$(cat cookies.txt | grep auth_token | awk '{print $7}')
curl -X POST https://smileai.com.br/api/auth/validate \
  -H "Authorization: Bearer $TOKEN"

# 3. Acessar app com cookie
curl https://app.smileai.com.br/api/health \
  -b cookies.txt

# 4. Logout
curl -X POST https://smileai.com.br/api/auth/logout \
  -b cookies.txt
```

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] **HTTPS obrigatório** em ambos os domínios
- [ ] **Cookie httpOnly** - não acessível via JavaScript
- [ ] **Cookie secure** - apenas em HTTPS
- [ ] **SameSite=Lax** - proteção CSRF
- [ ] **Domain=.smileai.com.br** - compartilhamento correto
- [ ] **Token expiration** - tokens com validade limitada
- [ ] **Refresh tokens** - renovação automática
- [ ] **Rate limiting** - proteção contra brute force
- [ ] **CORS** - permitir apenas domínios confiáveis
- [ ] **Validação server-side** - sempre validar no backend

### Exemplo de CORS no Backend

```typescript
// backend/src/server.ts
app.use(cors({
  origin: [
    'https://smileai.com.br',
    'https://app.smileai.com.br'
  ],
  credentials: true, // Permite cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 📊 Monitoramento

### Métricas a Acompanhar

1. **Taxa de autenticação bem-sucedida**
2. **Tempo de validação de token**
3. **Falhas de validação** (tokens inválidos/expirados)
4. **Redirecionamentos para login**
5. **Erros de conexão com API principal**

### Logs Importantes

```typescript
// Sucesso
logger.info('SSO authentication successful', { userId, email });

// Falha
logger.warn('Invalid token', { token: token.substring(0, 10) + '...' });

// Erro
logger.error('SSO API unreachable', { error: error.message });
```

---

## 🚨 Troubleshooting

### Problema: Cookie não está sendo enviado

**Causa:** Domain incorreto ou SameSite muito restritivo

**Solução:**
```javascript
// Verificar configuração do cookie
res.cookie('auth_token', token, {
  domain: '.smileai.com.br',  // ✅ Com ponto inicial
  sameSite: 'lax'             // ✅ Não usar 'strict'
});
```

---

### Problema: CORS error ao validar token

**Causa:** Backend não permite origin do app

**Solução:**
```typescript
app.use(cors({
  origin: 'https://app.smileai.com.br',
  credentials: true
}));
```

---

### Problema: Token válido mas usuário não autenticado

**Causa:** Middleware não está sendo aplicado

**Solução:**
```typescript
// Aplicar em TODAS as rotas protegidas
router.use(ssoAuthMiddleware);
```

---

## 📞 Suporte

Para dúvidas sobre integração SSO:
1. Verifique logs: `pm2 logs resea-backend`
2. Teste endpoint: `curl https://smileai.com.br/api/auth/validate`
3. Consulte [DEPLOYMENT_HOSTINGER.md](DEPLOYMENT_HOSTINGER.md)

---

Documentação criada para integração com smileai.com.br 🔐
