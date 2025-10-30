# 🎯 Guia Visual - Instalação via Hostinger File Manager

## ▶️ COMEÇAR AQUI - Passo a Passo Simplificado

---

## 📍 LOCALIZAÇÃO DA PASTA

### Onde instalar os arquivos?

```
🏠 Painel Hostinger
  └── 📁 Arquivos
      └── 📁 Gerenciador de Arquivos
          └── 📁 domains
              └── 📁 app.smileai.com.br
                  └── 📁 public_html  ← AQUI!
```

**Caminho completo:**
```
/home/u123456789/domains/app.smileai.com.br/public_html/
```

---

## 📦 PASSO 1: Preparar Arquivos no Computador

### 1.1 Criar 2 arquivos ZIP

No seu computador (`/Users/usuario/Downloads/resea-ai-research-assistant/`):

**ZIP 1: backend.zip**
```
📦 backend.zip
  └── 📁 backend/
      ├── 📁 src/
      ├── package.json
      ├── tsconfig.json
      └── ecosystem.config.js
```

**Como criar:**
1. Selecione a pasta `backend/`
2. Botão direito → Compactar
3. Nome: `backend.zip`

---

**ZIP 2: frontend.zip**
```
📦 frontend.zip
  ├── 📁 components/
  ├── 📁 services/
  ├── 📁 hooks/
  ├── App.tsx
  ├── index.tsx
  ├── index.html
  ├── package.json
  └── vite.config.ts
```

**Como criar:**
1. Selecione TODOS os arquivos do frontend (EXCETO a pasta backend)
2. Botão direito → Compactar
3. Nome: `frontend.zip`

---

### 1.2 Criar Arquivo .env (Backend)

Crie um arquivo chamado `env-backend.txt` com:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.smileai.com.br
GEMINI_API_KEY=COLE_SUA_CHAVE_AQUI
MAIN_DOMAIN_API=https://smileai.com.br/api
SSO_SECRET=qualquer_string_secreta_aqui_abc123
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
REDIS_ENABLED=false
```

⚠️ **IMPORTANTE:** Substitua `COLE_SUA_CHAVE_AQUI` pela sua chave real do Gemini!

---

### 1.3 Criar Arquivo .env (Frontend)

Crie um arquivo chamado `env-frontend.txt` com:

```
VITE_API_URL=https://app.smileai.com.br/api
VITE_MAIN_DOMAIN=https://smileai.com.br
VITE_SSO_ENABLED=true
```

---

## 📤 PASSO 2: Upload para Hostinger

### 2.1 Acessar Gerenciador de Arquivos

1. Entre em **hpanel.hostinger.com**
2. Login com suas credenciais
3. Clique em **Arquivos** no menu lateral
4. Clique em **Gerenciador de Arquivos**

---

### 2.2 Navegar para a Pasta Correta

1. Na árvore de pastas à esquerda, clique em **domains**
2. Clique em **app.smileai.com.br**
3. Clique em **public_html**

Você está em:
```
/domains/app.smileai.com.br/public_html/
```

---

### 2.3 Fazer Upload dos ZIPs

1. Clique no botão **Upload** (canto superior direito)
2. Clique em **Selecionar Arquivos**
3. Selecione `backend.zip`
4. Aguarde upload (barra de progresso)
5. Repita para `frontend.zip`
6. Upload `env-backend.txt`
7. Upload `env-frontend.txt`

---

### 2.4 Extrair os Arquivos

**Para backend.zip:**
1. Clique com botão direito em `backend.zip`
2. Selecione **Extrair**
3. Na janela, deixe o caminho como está
4. Clique em **Extrair**
5. Aguarde finalizar

**Para frontend.zip:**
1. Clique com botão direito em `frontend.zip`
2. Selecione **Extrair**
3. Clique em **Extrair**
4. Aguarde finalizar

---

### 2.5 Renomear Arquivos .env

**Backend:**
1. Encontre o arquivo `env-backend.txt`
2. Clique com botão direito → **Renomear**
3. Novo nome: `.env` (com ponto no início)
4. Clique em **Mover** ou **Renomear**
5. **IMPORTANTE:** Mova este `.env` para dentro da pasta `backend/`

**Frontend:**
1. Encontre o arquivo `env-frontend.txt`
2. Renomeie para `.env`
3. Este fica na raiz de `public_html/`

---

### 2.6 Deletar ZIPs (Opcional)

1. Selecione `backend.zip`
2. Clique em **Deletar**
3. Confirme
4. Repita para `frontend.zip`

---

## 🔧 PASSO 3: Instalar Dependências via SSH

### 3.1 Abrir Terminal SSH

1. No painel Hostinger, vá em **Avançado**
2. Clique em **Terminal SSH**
3. Uma nova aba abrirá com terminal

---

### 3.2 Instalar Backend

No terminal SSH, cole estes comandos:

```bash
# Ir para a pasta do backend
cd domains/app.smileai.com.br/public_html/backend

# Verificar se está na pasta correta
pwd

# Deve mostrar: /home/u123456789/domains/app.smileai.com.br/public_html/backend

# Instalar dependências
npm install --production

# Aguarde... pode demorar 2-5 minutos

# Fazer build
npm run build

# Deve criar a pasta dist/
```

---

### 3.3 Instalar Frontend

```bash
# Voltar para raiz
cd ..

# Verificar localização
pwd

# Deve mostrar: /home/u123456789/domains/app.smileai.com.br/public_html

# Instalar dependências
npm install

# Aguarde... pode demorar 2-5 minutos

# Fazer build
npm run build

# Cria a pasta dist/ com os arquivos prontos
```

---

## 🚀 PASSO 4: Iniciar Backend com PM2

### 4.1 Instalar PM2 (se não tiver)

No terminal SSH:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Verificar instalação
pm2 --version
```

---

### 4.2 Iniciar Aplicação

```bash
# Ir para pasta do backend
cd domains/app.smileai.com.br/public_html/backend

# Iniciar com PM2
pm2 start dist/server.js --name resea-backend

# Deve mostrar:
# ┌─────┬──────────────┬─────────┬─────────┐
# │ id  │ name         │ status  │ restart │
# ├─────┼──────────────┼─────────┼─────────┤
# │ 0   │ resea-backend│ online  │ 0       │
# └─────┴──────────────┴─────────┴─────────┘

# Salvar configuração
pm2 save

# Auto-start no boot
pm2 startup

# Execute o comando que ele mostrar (se pedir)
```

---

### 4.3 Verificar se Está Rodando

```bash
# Ver status
pm2 status

# Ver logs (últimas 50 linhas)
pm2 logs resea-backend --lines 50

# Deve mostrar:
# 🚀 Server running on port 3001
```

---

## 🌐 PASSO 5: Configurar Servidor Web

### Opção A: Se Usar Apache (.htaccess)

No Gerenciador de Arquivos, crie arquivo `.htaccess` em `public_html/`:

```apache
# Arquivo: .htaccess
RewriteEngine On

# HTTPS forçado
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# API proxy
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://localhost:3001/api/$1 [P,L]

# Frontend SPA
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ dist/index.html [L]
```

---

### Opção B: Configurar Node.js App (Hostinger Premium/Business)

Se você tem plano **Premium** ou **Business**:

1. Vá em **Avançado** → **Node.js**
2. Clique em **Criar Aplicação**

**Configure assim:**
```
Nome da aplicação: resea-backend
Modo: Production
Versão Node.js: 20.x
Diretório: domains/app.smileai.com.br/public_html/backend
Arquivo de início: dist/server.js
Porta da aplicação: 3001
```

3. Clique em **Criar**
4. Clique em **Iniciar**

---

## 🔒 PASSO 6: Ativar SSL

### 6.1 No Painel Hostinger

1. Vá em **SSL** no menu lateral
2. Procure por `app.smileai.com.br`
3. Clique em **Instalar SSL** (se não estiver instalado)
4. Ative **Forçar HTTPS**
5. Aguarde 5-10 minutos

---

## ✅ PASSO 7: Testar

### 7.1 Testar Frontend

Abra no navegador:
```
https://app.smileai.com.br
```

✅ Deve carregar a interface do Resea AI

---

### 7.2 Testar Backend API

Abra no navegador:
```
https://app.smileai.com.br/api/health
```

✅ Deve retornar JSON:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

---

### 7.3 Testar SSO (Integração)

1. Faça login em `smileai.com.br`
2. Acesse `app.smileai.com.br`
3. ✅ Deve entrar SEM pedir login novamente

---

## 📁 Estrutura Final no Servidor

```
📁 /domains/app.smileai.com.br/public_html/
  │
  ├── 📁 backend/              ← Backend Node.js
  │   ├── 📁 src/
  │   ├── 📁 dist/            ← Build (criado por npm run build)
  │   ├── 📁 node_modules/    ← Dependências (criado por npm install)
  │   ├── 📁 logs/            ← Logs da aplicação
  │   ├── package.json
  │   ├── tsconfig.json
  │   └── .env                ← Configurações (você criou)
  │
  ├── 📁 dist/                ← Build do frontend (criado por npm run build)
  │   ├── index.html
  │   ├── assets/
  │   │   ├── index-abc123.js
  │   │   └── index-xyz789.css
  │   └── ...
  │
  ├── 📁 components/          ← Código fonte (opcional manter)
  ├── 📁 services/
  ├── 📁 hooks/
  ├── App.tsx
  ├── index.tsx
  ├── package.json
  ├── vite.config.ts
  ├── .env                    ← Configurações frontend
  └── .htaccess               ← Configuração Apache (se usar)
```

---

## 🎥 Vídeo Tutorial (Simulado)

```
[Passo 1] Login Hostinger → 0:00
[Passo 2] Criar Subdomínio → 0:30
[Passo 3] Upload ZIPs → 1:00
[Passo 4] Extrair Arquivos → 2:00
[Passo 5] Criar .env → 3:00
[Passo 6] SSH Terminal → 4:00
[Passo 7] npm install → 5:00
[Passo 8] npm run build → 7:00
[Passo 9] PM2 Start → 9:00
[Passo 10] SSL Ativo → 10:00
[Passo 11] Teste Final → 11:00
```

**Tempo total:** ~12 minutos

---

## 🚨 Solução de Problemas

### ❌ "Não encontro a pasta app.smileai.com.br"

**Causa:** Subdomínio não foi criado

**Solução:**
1. Vá em **Domínios** → `smileai.com.br`
2. Clique em **Subdomínios**
3. Adicionar subdomínio: `app`
4. Aguarde 5 minutos
5. Volte ao Gerenciador de Arquivos
6. Atualize (F5)

---

### ❌ "Erro ao extrair ZIP"

**Causa:** Arquivo corrompido ou formato errado

**Solução:**
1. Delete o ZIP do servidor
2. No computador, compacte novamente em formato .ZIP
3. Faça upload novamente

---

### ❌ "npm: comando não encontrado"

**Causa:** Node.js não está disponível no seu plano

**Solução:**
1. Verifique seu plano Hostinger
2. Planos **Premium** e **Business** têm Node.js
3. Se tiver plano básico, considere upgrade
4. OU use apenas frontend estático com backend em outro serviço

---

### ❌ "pm2: comando não encontrado"

**Solução:**
```bash
npm install -g pm2
```

---

### ❌ "Backend não inicia"

**Causa:** Erro no .env ou porta ocupada

**Solução:**
```bash
# Ver logs de erro
pm2 logs resea-backend

# Verificar arquivo .env
cat backend/.env

# Verificar se porta 3001 está livre
netstat -tulpn | grep 3001
```

---

### ❌ "Site mostra página em branco"

**Causa:** Build do frontend não foi feito

**Solução:**
```bash
cd domains/app.smileai.com.br/public_html
npm run build
```

Verifique se criou pasta `dist/` com `index.html` dentro.

---

### ❌ "API retorna 502 Bad Gateway"

**Causa:** Backend não está rodando

**Solução:**
```bash
pm2 status
# Se mostrar "stopped", iniciar:
pm2 start resea-backend
```

---

## 📞 Precisa de Ajuda?

**Hostinger Support:**
- Chat 24/7 no painel
- Email: support@hostinger.com

**Documentação deste projeto:**
- [README.md](README.md)
- [DEPLOYMENT_HOSTINGER.md](DEPLOYMENT_HOSTINGER.md)
- [SSO_INTEGRATION.md](SSO_INTEGRATION.md)

---

## ✅ Checklist Final

Marque conforme completa:

- [ ] Subdomínio `app.smileai.com.br` criado
- [ ] Arquivos `backend.zip` e `frontend.zip` criados
- [ ] Arquivos `.env` criados (backend e frontend)
- [ ] Upload feito via Gerenciador de Arquivos
- [ ] ZIPs extraídos com sucesso
- [ ] Arquivos `.env` renomeados e no lugar correto
- [ ] SSH Terminal aberto
- [ ] Backend: `npm install` executado
- [ ] Backend: `npm run build` executado
- [ ] Frontend: `npm install` executado
- [ ] Frontend: `npm run build` executado
- [ ] PM2 instalado
- [ ] Backend iniciado com PM2
- [ ] PM2 configurado para auto-start
- [ ] `.htaccess` ou Node.js App configurado
- [ ] SSL ativado
- [ ] `https://app.smileai.com.br` carrega
- [ ] `https://app.smileai.com.br/api/health` retorna JSON
- [ ] SSO funciona (login único)

---

## 🎉 PRONTO!

Seu app está no ar em:

**🌐 https://app.smileai.com.br**

Parabéns! 🚀

---

**Tempo total estimado:** 30-60 minutos (primeira vez)

Se tiver dúvidas em algum passo específico, me avise! 😊
