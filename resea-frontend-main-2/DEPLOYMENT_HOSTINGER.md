# 🚀 Deploy na Hostinger VPS - Resea AI Research Assistant

## 📋 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    smileai.com.br                            │
│              (Domínio Principal - Existente)                 │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Ferramentas IA Acadêmicas                           │   │
│  │  - Autenticação de Usuários                          │   │
│  │  - API de Autenticação (JWT)                         │   │
│  │  - Gerenciamento de Sessões                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          │ API                                │
│                          ▼                                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Token JWT / Session
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  app.smileai.com.br                          │
│              (Subdomínio - Novo App)                         │
│                  Hostinger VPS Linux                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Nginx (Reverse Proxy)                               │   │
│  │  - SSL/TLS (Let's Encrypt)                           │   │
│  │  - Port 80 → 3000 (Frontend)                         │   │
│  │  - /api → 3001 (Backend)                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                    │
│         ┌────────────────┴────────────────┐                 │
│         ▼                                  ▼                 │
│  ┌─────────────┐                   ┌─────────────┐          │
│  │  Frontend   │                   │   Backend   │          │
│  │  React      │                   │  Node.js    │          │
│  │  Port 3000  │◄─────────────────►│  Port 3001  │          │
│  │             │                   │             │          │
│  │  - UI       │                   │  - API      │          │
│  │  - SSO      │                   │  - SSO Auth │          │
│  │  - Storage  │                   │  - Gemini   │          │
│  └─────────────┘                   │  - Academic │          │
│                                     │    Search   │          │
│                                     └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Integração SSO com smileai.com.br

### Fluxo de Autenticação

```
1. Usuário → smileai.com.br/login
   ↓
2. Login bem-sucedido → JWT Token gerado
   ↓
3. Token armazenado em Cookie (httpOnly, secure)
   ↓
4. Usuário navega para app.smileai.com.br
   ↓
5. Frontend verifica presença do token
   ↓
6. Backend valida token via API do domínio principal
   ↓
7. Se válido → acesso permitido
   Se inválido → redirect para login
```

---

## 📦 Estrutura de Arquivos no Servidor

```
/var/www/app.smileai.com.br/
├── backend/
│   ├── src/
│   ├── dist/
│   ├── logs/
│   ├── node_modules/
│   ├── package.json
│   ├── .env
│   └── ecosystem.config.js  # PM2 config
├── frontend/
│   ├── dist/
│   └── index.html
├── nginx/
│   └── app.smileai.com.br.conf
└── scripts/
    ├── deploy.sh
    ├── start.sh
    └── backup.sh
```

---

## 🛠️ Passo a Passo de Deploy

### 1. Preparar VPS Hostinger

#### 1.1 Conectar via SSH

```bash
ssh root@seu-vps-ip
```

#### 1.2 Atualizar Sistema

```bash
apt update && apt upgrade -y
```

#### 1.3 Instalar Dependências

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Nginx
apt install -y nginx

# PM2 (Process Manager)
npm install -g pm2

# Git
apt install -y git

# Certbot (SSL)
apt install -y certbot python3-certbot-nginx
```

---

### 2. Configurar Domínio

#### 2.1 Criar Subdomínio na Hostinger

1. Acesse o painel da Hostinger
2. Vá em **Domínios** → `smileai.com.br`
3. Adicione subdomínio: `app.smileai.com.br`
4. Aponte para o IP da VPS

#### 2.2 Verificar DNS

```bash
# Aguarde propagação (pode levar até 48h)
nslookup app.smileai.com.br
```

---

### 3. Clonar e Configurar Aplicação

#### 3.1 Criar Diretório

```bash
mkdir -p /var/www/app.smileai.com.br
cd /var/www/app.smileai.com.br
```

#### 3.2 Clonar Repositório

```bash
git clone <seu-repositorio> .
# ou fazer upload via FTP/SFTP
```

#### 3.3 Configurar Backend

```bash
cd backend
npm install --production

# Criar arquivo .env
cat > .env << EOF
# Server
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.smileai.com.br

# API Keys
GEMINI_API_KEY=sua_chave_aqui

# SSO Integration
MAIN_DOMAIN_API=https://smileai.com.br/api
SSO_SECRET=sua_chave_secreta_compartilhada

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Cache
REDIS_ENABLED=false
EOF

# Build
npm run build
```

#### 3.4 Configurar Frontend

```bash
cd ../frontend
npm install

# Criar .env
cat > .env << EOF
VITE_API_URL=https://app.smileai.com.br/api
VITE_MAIN_DOMAIN=https://smileai.com.br
VITE_SSO_ENABLED=true
EOF

# Build
npm run build
```

---

### 4. Configurar Nginx

#### 4.1 Criar Configuração

```bash
cat > /etc/nginx/sites-available/app.smileai.com.br << 'EOF'
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name app.smileai.com.br;

    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.smileai.com.br;

    # SSL (será configurado pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/app.smileai.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.smileai.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (React App)
    root /var/www/app.smileai.com.br/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_comp_level 6;

    # Frontend Routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout for streaming
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Logs
    access_log /var/log/nginx/app.smileai.access.log;
    error_log /var/log/nginx/app.smileai.error.log;
}
EOF
```

#### 4.2 Habilitar Site

```bash
ln -s /etc/nginx/sites-available/app.smileai.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

### 5. Configurar SSL (Let's Encrypt)

```bash
certbot --nginx -d app.smileai.com.br

# Responda as perguntas:
# Email: seu@email.com
# Termos: Agree
# Redirect HTTP to HTTPS: Yes

# Renovação automática (já configurado)
certbot renew --dry-run
```

---

### 6. Configurar PM2 (Process Manager)

#### 6.1 Criar ecosystem.config.js

```bash
cat > /var/www/app.smileai.com.br/backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'resea-backend',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '500M',
    watch: false,
    autorestart: true
  }]
};
EOF
```

#### 6.2 Iniciar Aplicação

```bash
cd /var/www/app.smileai.com.br/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 6.3 Comandos Úteis PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs resea-backend

# Restart
pm2 restart resea-backend

# Stop
pm2 stop resea-backend

# Monitor
pm2 monit
```

---

### 7. Implementar SSO Authentication

#### 7.1 Criar Middleware de Autenticação no Backend

```bash
cat > /var/www/app.smileai.com.br/backend/src/middleware/ssoAuth.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { logger } from '../config/logger.js';

const MAIN_DOMAIN_API = process.env.MAIN_DOMAIN_API || 'https://smileai.com.br/api';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Middleware SSO - Valida token via API do domínio principal
 */
export async function ssoAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Extrair token do cookie ou header
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido',
        redirectUrl: `https://smileai.com.br/login?redirect=${encodeURIComponent(req.originalUrl)}`
      });
    }

    // Validar token via API do domínio principal
    const response = await axios.post(
      `${MAIN_DOMAIN_API}/auth/validate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 5000
      }
    );

    if (!response.data.valid) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
        redirectUrl: 'https://smileai.com.br/login'
      });
    }

    // Anexar dados do usuário à requisição
    req.user = {
      id: response.data.user.id,
      email: response.data.user.email,
      name: response.data.user.name
    };

    logger.info('User authenticated via SSO', { userId: req.user.id });

    next();
  } catch (error: any) {
    logger.error('SSO authentication failed', { error: error.message });

    return res.status(401).json({
      success: false,
      error: 'Falha na autenticação',
      redirectUrl: 'https://smileai.com.br/login'
    });
  }
}

/**
 * Middleware opcional - permite acesso sem autenticação
 */
export async function optionalSsoAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const response = await axios.post(
      `${MAIN_DOMAIN_API}/auth/validate`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      }
    );

    if (response.data.valid) {
      req.user = response.data.user;
    }
  } catch (error) {
    // Continua sem autenticação
  }

  next();
}
EOF
```

#### 7.2 Aplicar Middleware nas Rotas

Edite `/var/www/app.smileai.com.br/backend/src/routes/api.ts`:

```typescript
import { ssoAuthMiddleware } from '../middleware/ssoAuth.js';

// Aplicar em todas as rotas que precisam autenticação
router.use(ssoAuthMiddleware);

// Ou em rotas específicas:
router.post('/generate-plan', ssoAuthMiddleware, async (req, res) => {
  // req.user disponível aqui
  const userId = req.user?.id;
  // ...
});
```

#### 7.3 Criar Serviço SSO no Frontend

```bash
cat > /var/www/app.smileai.com.br/services/ssoService.ts << 'EOF'
/**
 * SSO Service - Single Sign-On integration
 */

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'https://smileai.com.br';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

/**
 * Verifica se usuário está autenticado
 */
export async function checkAuth(): Promise<User | null> {
  try {
    const response = await fetch(`${MAIN_DOMAIN}/api/auth/me`, {
      credentials: 'include' // Envia cookies
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
 * Redireciona para login
 */
export function redirectToLogin() {
  const currentUrl = window.location.href;
  window.location.href = `${MAIN_DOMAIN}/login?redirect=${encodeURIComponent(currentUrl)}`;
}

/**
 * Logout
 */
export async function logout() {
  try {
    await fetch(`${MAIN_DOMAIN}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout failed', error);
  }

  redirectToLogin();
}

/**
 * Hook React para autenticação
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().then((userData) => {
      setUser(userData);
      setLoading(false);

      if (!userData) {
        redirectToLogin();
      }
    });
  }, []);

  return { user, loading, logout };
}
EOF
```

---

### 8. Scripts de Deploy e Manutenção

#### 8.1 Deploy Script

```bash
cat > /var/www/app.smileai.com.br/scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest code
cd /var/www/app.smileai.com.br
git pull origin main

# Backend
echo "📦 Building backend..."
cd backend
npm install --production
npm run build

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm install
npm run build

# Copy frontend build to root
cp -r dist/* /var/www/app.smileai.com.br/dist/

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart resea-backend

echo "✅ Deployment completed!"
EOF

chmod +x /var/www/app.smileai.com.br/scripts/deploy.sh
```

#### 8.2 Backup Script

```bash
cat > /var/www/app.smileai.com.br/scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/resea"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup code
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /var/www/app.smileai.com.br

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/www/app.smileai.com.br/backend/logs

# Keep only last 7 backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR"
EOF

chmod +x /var/www/app.smileai.com.br/scripts/backup.sh
```

#### 8.3 Agendar Backup (Cron)

```bash
crontab -e

# Adicionar linha (backup diário às 3h)
0 3 * * * /var/www/app.smileai.com.br/scripts/backup.sh
```

---

### 9. Monitoramento

#### 9.1 Verificar Status

```bash
# Nginx
systemctl status nginx

# PM2
pm2 status

# Logs em tempo real
pm2 logs resea-backend --lines 100

# Logs do Nginx
tail -f /var/log/nginx/app.smileai.access.log
tail -f /var/log/nginx/app.smileai.error.log
```

#### 9.2 Configurar Alertas (Opcional)

```bash
# PM2 Plus (Monitoramento em tempo real)
pm2 plus
```

---

### 10. Configurações de Segurança

#### 10.1 Firewall

```bash
# UFW (Uncomplicated Firewall)
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable
ufw status
```

#### 10.2 Fail2Ban (Proteção contra brute force)

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/app.smileai.error.log

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
EOF

systemctl restart fail2ban
```

---

## ✅ Checklist Final

- [ ] VPS configurada com Node.js, Nginx, PM2
- [ ] Subdomínio `app.smileai.com.br` apontando para VPS
- [ ] SSL configurado com Let's Encrypt
- [ ] Backend buildado e rodando (PM2)
- [ ] Frontend buildado e servido pelo Nginx
- [ ] SSO integrado com `smileai.com.br`
- [ ] Firewall configurado
- [ ] Backup automático agendado
- [ ] Logs sendo monitorados
- [ ] Teste completo do fluxo de autenticação

---

## 🧪 Teste de Produção

```bash
# 1. Teste de SSL
curl -I https://app.smileai.com.br

# 2. Teste de API
curl https://app.smileai.com.br/api/health

# 3. Teste de autenticação
# (requer token válido do domínio principal)
curl -H "Authorization: Bearer TOKEN" https://app.smileai.com.br/api/generate-plan
```

---

## 📞 Suporte

Em caso de problemas:
1. Verifique logs: `pm2 logs`
2. Verifique Nginx: `nginx -t`
3. Verifique SSL: `certbot certificates`
4. Consulte documentação: [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

---

Desenvolvido para deploy em Hostinger VPS ⚡
