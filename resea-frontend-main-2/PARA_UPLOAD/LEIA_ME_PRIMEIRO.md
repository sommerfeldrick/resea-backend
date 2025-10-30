# 📦 ESTRUTURA PARA UPLOAD - Resea AI

## ✅ ESTA PASTA ESTÁ PRONTA PARA UPLOAD!

---

## 📁 Estrutura (Como Deve Ficar no Servidor)

```
/domains/app.smileai.com.br/public_html/
│
├── index.html                  ← Frontend (placeholder - veja abaixo)
│
└── backend/                    ← Backend (Node.js API)
    ├── src/                    ← Código fonte TypeScript
    │   ├── config/
    │   ├── services/
    │   ├── middleware/
    │   ├── routes/
    │   ├── types/
    │   ├── utils/
    │   └── server.ts
    ├── package.json            ← Dependências
    ├── tsconfig.json           ← Config TypeScript
    ├── .env                    ← Config desenvolvimento
    └── .env.production         ← Config produção ✅
```

---

## 🚀 Como Fazer Upload

### Método 1: Via File Manager (RECOMENDADO)

1. **Compactar esta pasta:**
   ```bash
   # Na sua máquina local:
   cd PARA_UPLOAD
   zip -r para_upload.zip public_html/
   ```

2. **Acessar Hostinger:**
   - https://hpanel.hostinger.com/file-manager

3. **Navegar até:**
   - `/domains/app.smileai.com.br/`

4. **Fazer Upload:**
   - Arraste `para_upload.zip`
   - Clique com botão direito → **Extract**

5. **Mover arquivos:**
   - Entre na pasta `public_html/` extraída
   - Mova todo o conteúdo para `/domains/app.smileai.com.br/public_html/`

### Método 2: Via SCP (Terminal)

```bash
# Na sua máquina local, dentro de PARA_UPLOAD/
scp -r public_html/* seu_usuario@seu_servidor:/domains/app.smileai.com.br/public_html/
```

---

## ⚠️ IMPORTANTE: Frontend

### O Frontend Precisa Ser Compilado!

O arquivo `index.html` atual é apenas um **placeholder**.

**Para ter o frontend completo:**

#### Opção A: Compilar Localmente
```bash
# Na raiz do projeto (não dentro de PARA_UPLOAD)
cd /Users/usuario/Downloads/resea-ai-research-assistant

# Instalar dependências
npm install

# Compilar para produção
npm run build

# Isso cria a pasta dist/ com:
# - index.html (real)
# - assets/ (JS, CSS compilados)
# - imagens, fontes, etc.
```

**Depois:**
```bash
# Copiar dist/ para PARA_UPLOAD/public_html/
cp -r dist/* PARA_UPLOAD/public_html/
```

#### Opção B: Usar Frontend Existente (Se Já Foi Compilado)

Se a pasta `dist/` já existe no projeto raiz:
```bash
cp -r dist/* PARA_UPLOAD/public_html/
```

---

## 🔧 Após Upload: Configurar Backend

### Via SSH:

```bash
# 1. Conectar
ssh seu_usuario@seu_servidor

# 2. Ir para pasta do backend
cd /domains/app.smileai.com.br/public_html/backend

# 3. Instalar dependências
npm install --production

# 4. Compilar TypeScript
npm run build

# 5. Editar .env (apenas 1 linha)
nano .env
# Linha 20: GROQ_API_KEY=sua_chave_aqui
# Salvar: CTRL+O, ENTER, CTRL+X

# 6. Iniciar com PM2
pm2 start dist/server.js --name resea-backend
pm2 save
pm2 startup
```

---

## ✅ Verificar se Está Funcionando

```bash
# Testar API
curl http://localhost:3001/api/health

# Deve retornar:
# {"status":"ok", ...}

# Ver logs
pm2 logs resea-backend

# Ver status
pm2 status
```

---

## 🌐 Configurar Nginx

Criar arquivo: `/etc/nginx/sites-available/app.smileai.com.br`

```nginx
server {
    listen 80;
    server_name app.smileai.com.br;

    # Frontend (React)
    root /domains/app.smileai.com.br/public_html;
    index index.html;

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

## 📊 Estrutura Final no Servidor

Depois de tudo configurado:

```
/domains/app.smileai.com.br/public_html/
│
├── index.html              ← Frontend compilado
├── assets/                 ← JS, CSS, imagens
│   ├── index-abc123.js
│   ├── index-def456.css
│   └── ...
│
└── backend/
    ├── src/                ← Código fonte
    ├── dist/               ← Compilado (criado por npm run build)
    │   └── server.js       ← Servidor (PM2 roda isso)
    ├── node_modules/       ← Criado por npm install
    ├── logs/               ← Logs da aplicação
    ├── package.json
    ├── tsconfig.json
    └── .env                ← IMPORTANTE: Adicionar chave Groq
```

---

## 🔑 Configuração Obrigatória

### Apenas 1 Coisa: Chave Groq (2 minutos, GRÁTIS)

1. Acesse: https://console.groq.com/
2. Login/Cadastro
3. Vá em **API Keys**
4. Clique **Create API Key**
5. Copie a chave (começa com `gsk_`)

**Edite `backend/.env`:**
```env
# Linha 20
GROQ_API_KEY=gsk_sua_chave_aqui
```

**Pronto! Tudo configurado!** ✅

---

## 🎯 Checklist de Upload

- [ ] Compilar frontend (`npm run build` na raiz do projeto)
- [ ] Copiar `dist/*` para `PARA_UPLOAD/public_html/`
- [ ] Compactar `PARA_UPLOAD/public_html/` em ZIP
- [ ] Upload ZIP para Hostinger
- [ ] Extrair no servidor
- [ ] Mover para `/domains/app.smileai.com.br/public_html/`
- [ ] SSH: `cd backend && npm install --production`
- [ ] SSH: `npm run build`
- [ ] SSH: Editar `.env` com chave Groq
- [ ] SSH: `pm2 start dist/server.js --name resea-backend`
- [ ] Configurar Nginx
- [ ] Testar: `curl http://localhost:3001/api/health`
- [ ] Acessar: `https://app.smileai.com.br`
- [ ] Funciona! 🎉

---

## 🆘 Problemas?

### Backend não inicia
```bash
pm2 logs resea-backend --lines 50
```

### Erro "GROQ_API_KEY"
- Edite `backend/.env` e adicione a chave

### Frontend não aparece
- Certifique-se que compilou: `npm run build`
- Copie `dist/*` para `public_html/`

---

## 📞 Comandos Úteis

```bash
# Ver status
pm2 status

# Reiniciar
pm2 restart resea-backend

# Parar
pm2 stop resea-backend

# Ver logs em tempo real
pm2 logs resea-backend

# Testar API
curl http://localhost:3001/api/health
curl http://localhost:3001/api/ai-stats
```

---

**📖 Documentação completa em:** `../docs/`

**Versão:** 2.0.0
**Status:** ✅ Pronto para Upload
**Tempo estimado:** 20 minutos (com frontend compilado)
