# 📁 Instalação via Gerenciador de Arquivos da Hostinger

## 🎯 Objetivo

Instalar o Resea AI no subdomínio **app.smileai.com.br** usando apenas o **Gerenciador de Arquivos** do painel da Hostinger (sem SSH).

---

## 📋 Pré-requisitos

- ✅ Acesso ao painel da Hostinger (hPanel)
- ✅ Subdomínio `app.smileai.com.br` criado
- ✅ Chave da API do Gemini

---

## 🗂️ PASSO 1: Localizar a Pasta do Subdomínio

### 1.1 Acessar Gerenciador de Arquivos

1. Entre no **painel da Hostinger** (hPanel)
2. Vá em **Arquivos** → **Gerenciador de Arquivos**
3. Você verá a estrutura de pastas

### 1.2 Encontrar a Pasta do Subdomínio

A Hostinger cria automaticamente uma pasta para cada subdomínio. Procure por:

```
📁 public_html/
  📁 app.smileai.com.br/     ← ESTA É A PASTA DO SEU SUBDOMÍNIO
     📁 public_html/         ← Aqui vão os arquivos do app
```

**Caminho completo:**
```
/home/seu_usuario/domains/app.smileai.com.br/public_html/
```

**OU (em alguns casos):**
```
/home/seu_usuario/public_html/app.smileai.com.br/
```

💡 **Dica:** Se não achar, crie o subdomínio primeiro:
- Painel Hostinger → **Domínios** → **Gerenciar** → **Subdomínios** → **Criar Subdomínio**
- Nome: `app`
- A pasta será criada automaticamente

---

## 📦 PASSO 2: Preparar os Arquivos para Upload

### 2.1 Criar Estrutura Local

No seu computador, organize os arquivos assim:

```
📁 app.smileai.com.br/
  │
  ├── 📁 backend/
  │   ├── 📁 src/
  │   ├── package.json
  │   ├── tsconfig.json
  │   └── .env
  │
  ├── 📁 frontend/
  │   ├── 📁 components/
  │   ├── 📁 services/
  │   ├── 📁 hooks/
  │   ├── App.tsx
  │   ├── index.tsx
  │   ├── package.json
  │   └── .env
  │
  └── 📁 docs/
      ├── README.md
      ├── DEPLOYMENT_HOSTINGER.md
      └── ...
```

### 2.2 Criar Arquivo .env do Backend

Crie o arquivo `backend/.env` com:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.smileai.com.br

# Sua chave aqui
GEMINI_API_KEY=AIzaSy...

# API do domínio principal
MAIN_DOMAIN_API=https://smileai.com.br/api
SSO_SECRET=sua_chave_secreta_aqui

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
REDIS_ENABLED=false
```

### 2.3 Criar Arquivo .env do Frontend

Crie o arquivo `.env` na raiz com:

```env
VITE_API_URL=https://app.smileai.com.br/api
VITE_MAIN_DOMAIN=https://smileai.com.br
VITE_SSO_ENABLED=true
```

---

## 📤 PASSO 3: Upload via Gerenciador de Arquivos

### 3.1 Compactar os Arquivos (Recomendado)

**No seu computador:**

1. Selecione a pasta `backend/`
2. Compacte em **backend.zip**

3. Selecione os arquivos do frontend (sem a pasta backend)
4. Compacte em **frontend.zip**

### 3.2 Fazer Upload

**No Gerenciador de Arquivos da Hostinger:**

1. Navegue até: `/domains/app.smileai.com.br/public_html/`
2. Clique em **Upload**
3. Arraste ou selecione `backend.zip`
4. Aguarde o upload completar
5. Arraste ou selecione `frontend.zip`
6. Aguarde o upload completar

### 3.3 Descompactar

1. Clique com botão direito em `backend.zip`
2. Selecione **Extrair**
3. Escolha extrair para a pasta atual
4. Repita para `frontend.zip`
5. Delete os arquivos `.zip` após extrair

**Estrutura final no servidor:**

```
/domains/app.smileai.com.br/public_html/
  ├── 📁 backend/
  │   ├── 📁 src/
  │   ├── package.json
  │   └── .env
  │
  ├── 📁 components/
  ├── 📁 services/
  ├── 📁 hooks/
  ├── App.tsx
  ├── index.tsx
  ├── index.html
  ├── package.json
  ├── vite.config.ts
  └── .env
```

---

## 🔧 PASSO 4: Instalar Dependências

### Opção A: Via Terminal SSH do hPanel

1. No painel Hostinger, vá em **Avançado** → **Terminal SSH**
2. Execute:

```bash
# Navegar para a pasta do app
cd domains/app.smileai.com.br/public_html

# Instalar Node.js (se não tiver)
# A Hostinger geralmente já tem Node.js instalado

# Verificar versão
node --version
npm --version

# Instalar dependências do backend
cd backend
npm install --production
npm run build

# Voltar e instalar dependências do frontend
cd ..
npm install
npm run build
```

### Opção B: Via Aplicação Node.js do hPanel

1. Vá em **Avançado** → **Node.js**
2. Clique em **Criar Aplicação**
3. Configure:
   - **Nome da aplicação:** resea-backend
   - **Modo:** Production
   - **Versão Node.js:** 20.x
   - **Diretório da aplicação:** `/domains/app.smileai.com.br/public_html/backend`
   - **Arquivo de inicialização:** `dist/server.js`
   - **Porta:** 3001

4. Clique em **Criar**

---

## 🌐 PASSO 5: Configurar Nginx (Arquivo .htaccess)

### 5.1 Criar arquivo .htaccess

No Gerenciador de Arquivos, em `/domains/app.smileai.com.br/public_html/`:

Crie um arquivo chamado `.htaccess` com o conteúdo:

```apache
# Habilitar mod_rewrite
RewriteEngine On

# Redirecionar HTTP para HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# API Routes - Proxy para backend Node.js
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://localhost:3001/api/$1 [P,L]

# Frontend Routes - SPA fallback
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [L]
```

**OU usar configuração Nginx se a Hostinger permitir:**

Se você tiver acesso ao **Nginx**, crie em `/domains/app.smileai.com.br/nginx/app.conf`:

```nginx
server {
    listen 80;
    server_name app.smileai.com.br;
    root /home/seu_usuario/domains/app.smileai.com.br/public_html/dist;
    index index.html;

    # Frontend
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
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🚀 PASSO 6: Iniciar a Aplicação

### Via Node.js App Manager (Hostinger)

1. Vá em **Avançado** → **Node.js**
2. Encontre sua aplicação `resea-backend`
3. Clique em **Iniciar**

### Via Terminal SSH

```bash
cd /domains/app.smileai.com.br/public_html/backend

# Instalar PM2 globalmente (se não tiver)
npm install -g pm2

# Iniciar aplicação
pm2 start dist/server.js --name resea-backend

# Salvar configuração
pm2 save

# Configurar auto-start
pm2 startup
```

---

## 🔒 PASSO 7: Configurar SSL

### No Painel Hostinger

1. Vá em **SSL** → **Gerenciar**
2. Selecione o domínio `app.smileai.com.br`
3. Escolha **Forçar HTTPS** (ativar)
4. Clique em **Aplicar**

O SSL será instalado automaticamente (Let's Encrypt).

---

## ✅ PASSO 8: Verificar Instalação

### 8.1 Testar Frontend

Acesse no navegador:
```
https://app.smileai.com.br
```

Você deve ver a interface do Resea AI.

### 8.2 Testar Backend

Acesse:
```
https://app.smileai.com.br/api/health
```

Deve retornar JSON:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

### 8.3 Testar SSO

1. Faça login em `smileai.com.br`
2. Acesse `app.smileai.com.br`
3. Deve entrar direto sem novo login

---

## 📁 Estrutura Final no Servidor

```
/home/seu_usuario/domains/app.smileai.com.br/
│
├── 📁 public_html/              ← Raiz do site
│   │
│   ├── 📁 backend/              ← Backend Node.js
│   │   ├── 📁 src/
│   │   ├── 📁 dist/            ← Build do TypeScript
│   │   ├── 📁 node_modules/
│   │   ├── 📁 logs/
│   │   ├── package.json
│   │   ├── .env                ← Configurações
│   │   └── ecosystem.config.js
│   │
│   ├── 📁 dist/                ← Build do frontend
│   │   ├── index.html
│   │   ├── assets/
│   │   └── ...
│   │
│   ├── 📁 components/          ← Código fonte (opcional)
│   ├── 📁 services/
│   ├── 📁 hooks/
│   ├── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env                    ← Configurações frontend
│   └── .htaccess               ← Configuração Apache/Nginx
│
└── 📁 logs/                     ← Logs do servidor
```

---

## 🎥 Passo a Passo Visual

### 1️⃣ **Criar Subdomínio**

```
Hostinger → Domínios → smileai.com.br → Subdomínios → Criar
Nome: app
```

### 2️⃣ **Acessar Gerenciador de Arquivos**

```
Hostinger → Arquivos → Gerenciador de Arquivos
```

### 3️⃣ **Navegar para Pasta**

```
📁 domains → app.smileai.com.br → public_html
```

### 4️⃣ **Fazer Upload**

```
Botão Upload → Selecionar backend.zip e frontend.zip
```

### 5️⃣ **Extrair Arquivos**

```
Botão direito no .zip → Extrair → Confirmar
```

### 6️⃣ **Abrir Terminal SSH**

```
Hostinger → Avançado → Terminal SSH
```

### 7️⃣ **Instalar Dependências**

```bash
cd domains/app.smileai.com.br/public_html
cd backend
npm install --production
npm run build
cd ..
npm install
npm run build
```

### 8️⃣ **Configurar Node.js App**

```
Hostinger → Avançado → Node.js → Criar Aplicação
```

### 9️⃣ **Ativar SSL**

```
Hostinger → SSL → app.smileai.com.br → Forçar HTTPS
```

### 🔟 **Testar**

```
https://app.smileai.com.br
```

---

## 🚨 Problemas Comuns

### ❌ "Pasta public_html não encontrada"

**Solução:**
1. Certifique-se que criou o subdomínio no painel
2. Aguarde 5-10 minutos para propagação
3. Procure por: `/domains/app.smileai.com.br/`

---

### ❌ "Não consigo extrair o arquivo"

**Solução:**
1. Verifique se o arquivo .zip não está corrompido
2. Tente compactar novamente no seu computador
3. Use formato .zip (não .rar ou .7z)

---

### ❌ "Node.js não está instalado"

**Solução:**
1. Vá em **Hostinger → Avançado → Node.js**
2. Clique em **Ativar Node.js** para sua conta
3. Escolha versão 20.x

---

### ❌ "Backend não inicia"

**Solução:**
1. Verifique arquivo `.env` do backend
2. Confirme que a porta 3001 está disponível
3. Veja logs: **Hostinger → Node.js → Ver Logs**

---

### ❌ "Frontend mostra página em branco"

**Solução:**
1. Verifique se rodou `npm run build`
2. Confirme que arquivos estão em `/public_html/dist/`
3. Verifique console do navegador (F12)

---

### ❌ "SSL não funciona"

**Solução:**
1. Aguarde 5-10 minutos após ativar SSL
2. Limpe cache do navegador
3. Verifique em **Hostinger → SSL** se está ativo

---

## 📞 Suporte Hostinger

Se tiver dificuldades:
1. Chat ao vivo da Hostinger (24/7)
2. Email: support@hostinger.com
3. Base de conhecimento: https://support.hostinger.com

---

## ✅ Checklist Rápido

- [ ] Subdomínio `app.smileai.com.br` criado
- [ ] Arquivos uploadados via Gerenciador de Arquivos
- [ ] Arquivos .zip extraídos
- [ ] Arquivo `.env` do backend configurado com GEMINI_API_KEY
- [ ] Arquivo `.env` do frontend configurado
- [ ] Dependências instaladas (`npm install`)
- [ ] Build criado (`npm run build`)
- [ ] Aplicação Node.js criada e iniciada
- [ ] SSL ativado
- [ ] Site acessível em `https://app.smileai.com.br`
- [ ] API respondendo em `/api/health`
- [ ] SSO funcionando

---

## 🎉 Pronto!

Após seguir todos os passos, seu app estará rodando em:

**🌐 https://app.smileai.com.br**

---

**💡 Dica Final:**

Se a Hostinger não suportar Node.js diretamente na sua hospedagem, você precisará:
1. **Upgrade para VPS** (recomendado)
2. **OU** fazer build estático do frontend e hospedar apenas ele, com backend em outro serviço (Railway, Render, Heroku)

A maioria dos planos **Premium** e **Business** da Hostinger suportam Node.js!

---

Precisa de ajuda com algum passo específico? 🚀
