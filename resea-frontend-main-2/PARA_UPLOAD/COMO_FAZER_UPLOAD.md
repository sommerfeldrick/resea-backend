# 📤 COMO FAZER UPLOAD - Guia Visual

## ✅ A Pasta Está Perfeita!

A pasta `public_html/` aqui contém EXATAMENTE o que deve estar dentro de `/domains/app.smileai.com.br/public_html/` no servidor.

---

## 🎯 Estrutura Atual (Correto)

```
PARA_UPLOAD/
│
├── public_html/                    ← ESTA pasta vai para o servidor
│   ├── index.html                  ← Frontend
│   ├── .htaccess                   ← Apache config
│   ├── favicon.ico                 ← Ícone
│   └── backend/                    ← API completa
│       ├── src/
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env
│       └── .env.production
│
├── README_UPLOAD.md                ← Documentação (não fazer upload)
├── INSTRUÇÕES_SIMPLES.txt          ← Guia rápido (não fazer upload)
└── COMO_FAZER_UPLOAD.md            ← Este arquivo (não fazer upload)
```

---

## 📤 Método de Upload

### Opção 1: ZIP (RECOMENDADO - Mais Rápido)

#### 1. Compactar a pasta public_html

**Windows:**
1. Clique com botão direito em `public_html`
2. Enviar para → Pasta compactada
3. Renomeie para `site.zip`

**Mac/Linux:**
```bash
cd PARA_UPLOAD
zip -r site.zip public_html/
```

#### 2. Upload do ZIP

1. **Acesse:** https://hpanel.hostinger.com/file-manager

2. **Navegue até:** `/domains/app.smileai.com.br/`

3. **Upload:**
   - Clique em "Upload"
   - Selecione `site.zip`
   - Aguarde completar

4. **Extrair:**
   - Clique com botão direito em `site.zip`
   - Clique "Extract"
   - Aguarde extrair

5. **Mover para public_html:**
   - Entre na pasta `public_html` extraída
   - Pressione CTRL+A (ou CMD+A no Mac)
   - Arraste TUDO para: `/domains/app.smileai.com.br/public_html/`

---

### Opção 2: Upload Direto (Pasta por Pasta)

#### 1. Acessar Hostinger File Manager

**URL:** https://hpanel.hostinger.com/file-manager

#### 2. Ir para pasta de destino

**Caminho:** `/domains/app.smileai.com.br/public_html/`

#### 3. Upload dos arquivos

Arraste da sua pasta `PARA_UPLOAD/public_html/` para o File Manager:

- ✅ `index.html`
- ✅ `.htaccess`
- ✅ `favicon.ico`
- ✅ Pasta `backend/` completa

**IMPORTANTE:** Arraste a pasta `backend` inteira, não os arquivos dentro dela!

---

## 🎯 Como Deve Ficar no Servidor

```
/domains/app.smileai.com.br/public_html/
│
├── index.html              ✅ Deve estar aqui
├── .htaccess               ✅ Deve estar aqui
├── favicon.ico             ✅ Deve estar aqui
│
└── backend/                ✅ Deve estar aqui
    ├── src/
    │   ├── config/
    │   ├── services/
    │   ├── middleware/
    │   ├── routes/
    │   ├── types/
    │   ├── utils/
    │   └── server.ts
    ├── package.json
    ├── tsconfig.json
    ├── .env
    └── .env.production
```

---

## ❌ ERROS COMUNS

### ❌ ERRADO:
```
/domains/app.smileai.com.br/public_html/
└── public_html/              ← ERRADO! Duplicado!
    ├── index.html
    └── backend/
```

### ✅ CORRETO:
```
/domains/app.smileai.com.br/public_html/
├── index.html                ← CORRETO!
└── backend/                  ← CORRETO!
```

---

## 🔍 Verificar Upload

Depois do upload, verifique se ficou assim:

1. Acesse no File Manager: `/domains/app.smileai.com.br/public_html/`

2. Você deve ver:
   ```
   📄 index.html
   📄 .htaccess
   📄 favicon.ico
   📁 backend/
   ```

3. Entre na pasta `backend/`:
   ```
   📁 src/
   📄 package.json
   📄 tsconfig.json
   📄 .env
   📄 .env.production
   ```

4. Entre na pasta `src/`:
   ```
   📁 config/
   📁 services/
   📁 middleware/
   📁 routes/
   📁 types/
   📁 utils/
   📄 server.ts
   ```

**Se está assim → PERFEITO!** ✅

---

## ⚙️ Próximo Passo: Configurar

Depois do upload, você precisa:

### Via SSH:

```bash
# 1. Conectar
ssh seu_usuario@seu_servidor

# 2. Ir para pasta do backend
cd /domains/app.smileai.com.br/public_html/backend

# 3. Verificar se está no lugar certo
pwd
# Deve mostrar: /domains/app.smileai.com.br/public_html/backend

ls
# Deve mostrar: src  package.json  tsconfig.json  .env  .env.production

# 4. Instalar dependências
npm install --production

# 5. Compilar TypeScript
npm run build

# 6. Verificar se compilou
ls dist/
# Deve mostrar: server.js  config/  services/  etc.

# 7. Editar .env (adicionar chave Groq)
nano .env
# Linha 20: GROQ_API_KEY=sua_chave_aqui
# Salvar: CTRL+O, ENTER, CTRL+X

# 8. Iniciar servidor
pm2 start dist/server.js --name resea-backend

# 9. Salvar configuração
pm2 save

# 10. Auto-start
pm2 startup
```

---

## ✅ Testar

```bash
# Testar API
curl http://localhost:3001/api/health

# Deve retornar:
# {"status":"ok","timestamp":"...","aiProvider":"groq",...}

# Ver status PM2
pm2 status

# Deve mostrar:
# resea-backend | online | 0 | 0 | ...
```

---

## 🌐 Acessar pelo Navegador

**URL:** https://app.smileai.com.br

**Deve aparecer:**
- Página inicial bonita
- Título "Resea AI"
- Botões para ver status da API

---

## 🆘 Problemas?

### Backend não encontrado no SSH
```bash
# Verifique o caminho
ls -la /domains/app.smileai.com.br/public_html/

# Deve listar: backend/
```

### Pasta backend vazia
- Upload falhou
- Tente novamente com ZIP
- Ou arraste pasta backend inteira

### npm install falha
```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 📊 Resumo

### O Que Fazer Upload:
✅ TODO o conteúdo de `PARA_UPLOAD/public_html/`

### Para Onde:
✅ `/domains/app.smileai.com.br/public_html/`

### NÃO fazer upload:
❌ `README_UPLOAD.md`
❌ `INSTRUÇÕES_SIMPLES.txt`
❌ `COMO_FAZER_UPLOAD.md`

### Depois do Upload:
1. ✅ SSH: `cd backend`
2. ✅ `npm install --production`
3. ✅ `npm run build`
4. ✅ Editar `.env`
5. ✅ `pm2 start dist/server.js`

---

**📖 Documentação completa:** README_UPLOAD.md

**Versão:** 2.0.0
**Status:** ✅ PRONTO PARA UPLOAD
**Tempo:** 15 minutos

🚀 **BOA SORTE!**
