# 🚀 Deploy Simples - Resea AI

## ⚡ Está TUDO pronto! Apenas siga estes passos:

---

## 📦 Passo 1: Preparar Arquivos

Execute o script de preparação:

```bash
# No terminal, dentro da pasta do projeto:
./prepare-deploy.sh
```

Isso vai criar 3 arquivos ZIP em `deploy-package/`:
- ✅ `backend.zip` (aplicação backend completa)
- ✅ `frontend.zip` (aplicação frontend completa)
- ✅ `docs.zip` (documentação)

---

## 📤 Passo 2: Upload para Hostinger

### 2.1 Acessar File Manager
1. Acesse: https://hpanel.hostinger.com/file-manager
2. Navegue até: `/domains/app.smileai.com.br/public_html/`

### 2.2 Fazer Upload
1. Clique em **Upload**
2. Arraste os arquivos:
   - `backend.zip`
   - `frontend.zip`
3. Aguarde o upload completar

### 2.3 Extrair Arquivos
1. Clique com botão direito em `backend.zip` → **Extract**
2. Clique com botão direito em `frontend.zip` → **Extract**
3. Pronto! Arquivos extraídos

---

## 🔧 Passo 3: Configurar (APENAS 1 COISA)

### Via SSH:

```bash
# 1. Conectar via SSH
ssh seu_usuario@seu_servidor

# 2. Entrar na pasta do backend
cd /domains/app.smileai.com.br/public_html/backend

# 3. Editar .env com sua chave Groq
nano .env

# Encontre esta linha:
GROQ_API_KEY=gsk_sua_chave_aqui

# Substitua por sua chave real:
GROQ_API_KEY=gsk_1234abcd5678efgh...

# Salvar: CTRL+O, ENTER, CTRL+X

# 4. Instalar dependências
npm install --production

# 5. Build
npm run build
```

**Obter chave Groq (GRÁTIS):**
1. Acesse: https://console.groq.com/
2. Faça login/cadastro
3. Vá em **API Keys**
4. Clique **Create API Key**
5. Copie a chave (começa com `gsk_`)

---

## 🚀 Passo 4: Iniciar Servidor

```bash
# Ainda via SSH, na pasta backend/

# Instalar PM2 (se não tiver)
npm install -g pm2

# Iniciar o backend
pm2 start dist/server.js --name resea-backend

# Salvar configuração
pm2 save

# Configurar para iniciar automaticamente
pm2 startup
```

**Pronto! Backend rodando!** ✅

---

## ✅ Passo 5: Verificar

```bash
# Ver logs
pm2 logs resea-backend

# Ver status
pm2 status

# Testar API
curl http://localhost:3001/api/health
```

**Se aparecer `"status": "ok"` → ESTÁ FUNCIONANDO!** 🎉

---

## 🌐 Configurar Nginx (Hostinger)

Crie um arquivo de configuração:

```bash
nano /etc/nginx/sites-available/app.smileai.com.br
```

Cole isto:

```nginx
server {
    listen 80;
    server_name app.smileai.com.br;

    # Frontend (React)
    root /domains/app.smileai.com.br/public_html/dist;
    index index.html;

    # Servir frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend
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

Ativar:
```bash
ln -s /etc/nginx/sites-available/app.smileai.com.br /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 🎉 PRONTO!

Acesse: **https://app.smileai.com.br**

### Testar:
1. Abra a aplicação
2. Faça uma pesquisa
3. Deve funcionar perfeitamente!

---

## 🔑 OAuth SmileAI

**JÁ ESTÁ CONFIGURADO!** ✅

As credenciais OAuth estão hardcoded em:
- Client ID: `2`
- Client Secret: `2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8`
- Base URL: `https://smileai.com.br`

**Endpoints disponíveis:**
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário
- `GET /api/auth/smileai/documents` - Documentos
- `GET /api/auth/smileai/templates` - Templates
- `GET /api/auth/smileai/brand-voice` - Brand Voice

---

## 🆘 Problemas?

### Backend não inicia
```bash
# Ver logs detalhados
pm2 logs resea-backend --lines 100

# Reiniciar
pm2 restart resea-backend
```

### Erro "GROQ_API_KEY"
- Edite o `.env` e adicione sua chave Groq

### Erro "Cannot connect to SmileAI"
- Verifique se `https://smileai.com.br` está online

---

## 📊 Comandos Úteis

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs resea-backend

# Reiniciar
pm2 restart resea-backend

# Parar
pm2 stop resea-backend

# Deletar
pm2 delete resea-backend
```

---

## ✅ Checklist Final

- [ ] Executei `./prepare-deploy.sh`
- [ ] Fiz upload dos ZIPs para Hostinger
- [ ] Extraí os arquivos
- [ ] Editei `.env` com minha chave Groq
- [ ] Rodei `npm install --production`
- [ ] Rodei `npm run build`
- [ ] Iniciei com `pm2 start`
- [ ] Configurei Nginx
- [ ] Testei `http://localhost:3001/api/health`
- [ ] Acessei `https://app.smileai.com.br`
- [ ] Funciona! 🎉

---

**Tempo estimado:** 15 minutos
**Dificuldade:** Fácil
**Status:** Tudo configurado, apenas fazer upload!

🎉 **Sucesso!**
