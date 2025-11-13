# 🚀 Configuração R2 no Render - Passo a Passo

## ✅ Status da Configuração

**Credenciais R2 obtidas com sucesso:**
- ✅ Account ID: `3906c841b79414c478ce8af2ceb33861`
- ✅ Bucket Name: `smileai-documents`
- ✅ Access Key ID: `9d6656d7da7836d268ffb5e67ea988d3`
- ✅ Secret Access Key: `11f99d34e1b83fd59dfa2c6a436fa537e26171a5135cb0b6cc91d766fec08296`

---

## 📋 Adicionar Variáveis no Render Dashboard

### Passo 1: Acessar o Dashboard

1. Acesse: https://dashboard.render.com/
2. Selecione o serviço: **resea-backend** (ou o nome do seu backend)
3. Clique na aba: **Environment**

### Passo 2: Adicionar as 7 Variáveis

Clique em **"Add Environment Variable"** e adicione uma por vez:

```bash
# Variável 1
Key:   R2_ENABLED
Value: true

# Variável 2
Key:   R2_ACCOUNT_ID
Value: 3906c841b79414c478ce8af2ceb33861

# Variável 3
Key:   R2_BUCKET_NAME
Value: smileai-documents

# Variável 4
Key:   R2_ACCESS_KEY_ID
Value: 9d6656d7da7836d268ffb5e67ea988d3

# Variável 5
Key:   R2_SECRET_ACCESS_KEY
Value: 11f99d34e1b83fd59dfa2c6a436fa537e26171a5135cb0b6cc91d766fec08296

# Variável 6
Key:   R2_REGION
Value: auto

# Variável 7 (opcional)
Key:   R2_PUBLIC_DOMAIN
Value: (deixe vazio)
```

### Passo 3: Salvar e Aguardar Deploy

1. Clique em: **"Save Changes"**
2. O Render vai fazer **redeploy automático**
3. Aguarde ~3-5 minutos

---

## 🔍 Verificar se Funcionou

### Opção 1: Verificar nos Logs do Render

1. Vá em: **Logs** (aba no Render)
2. Procure pela mensagem:
   ```
   ✅ Cloudflare R2 storage initialized successfully
   ```

**Se aparecer outras mensagens:**

❌ `📦 R2/S3 storage disabled - documents will be stored in PostgreSQL`
   - **Problema**: `R2_ENABLED` não está configurado ou está como `false`
   - **Solução**: Verifique se adicionou `R2_ENABLED=true`

❌ `Failed to initialize storage client`
   - **Problema**: Credenciais incorretas
   - **Solução**: Copie novamente as variáveis (cuidado com espaços extras)

### Opção 2: Gerar um Documento de Teste

1. Faça login no frontend: https://app.smileai.com.br
2. Gere um documento de pesquisa
3. Se salvar sem erro = **R2 está funcionando!** ✨

### Opção 3: Verificar no Dashboard do Cloudflare

1. Acesse: https://dash.cloudflare.com/
2. Vá em: **R2** → **Bucket** → `smileai-documents`
3. Procure pela pasta: **`documents/`**
4. Se tiver arquivos lá = **R2 está salvando!** 🎉

---

## 📊 O que vai acontecer agora?

Após configurar o R2 no Render:

✅ **Todos os documentos gerados serão salvos no R2**
   - Caminho: `documents/{userId}/{documentId}.html`
   - URLs assinadas com validade de 1 hora
   - Fallback para PostgreSQL se R2 falhar

✅ **Sistema de créditos continuará funcionando**
   - Contabiliza documentos (não palavras)
   - Limite por plano: Standard=10, Premium=20, etc
   - Renovação automática mensal

✅ **Frontend pode listar e baixar documentos**
   - `GET /api/documents` - Lista histórico
   - `GET /api/documents/:id/content` - Conteúdo completo
   - `GET /api/documents/:id/download` - Download direto

---

## 💰 Custos Estimados

**Free Tier do Cloudflare R2:**
- ✅ 10 GB/mês grátis
- ✅ Downloads ilimitados **GRÁTIS** (zero egress)
- ✅ Perfeito para começar

**Além do Free Tier:**
- $0.015/GB/mês (armazenamento)
- $0 downloads (sempre grátis!)

**Estimativa:**
- 100 documentos = ~2 GB = **$0/mês** (dentro do free tier)
- 1000 documentos = ~20 GB = **$0.15/mês**
- 10000 documentos = ~200 GB = **$2.85/mês**

---

## 🆘 Problemas Comuns

### Erro: "Access Denied" nos logs

```bash
# Verifique se as credenciais estão EXATAMENTE iguais:
R2_ACCESS_KEY_ID=9d6656d7da7836d268ffb5e67ea988d3
R2_SECRET_ACCESS_KEY=11f99d34e1b83fd59dfa2c6a436fa537e26171a5135cb0b6cc91d766fec08296

# SEM espaços extras antes ou depois!
```

### Erro: "Bucket not found"

```bash
# Verifique se criou o bucket no Cloudflare:
# Dashboard > R2 > Buckets > smileai-documents deve existir
R2_BUCKET_NAME=smileai-documents
```

### Erro: "Invalid endpoint"

```bash
# Account ID deve ter exatamente 32 caracteres hexadecimais
R2_ACCOUNT_ID=3906c841b79414c478ce8af2ceb33861
```

---

## 📚 Documentação Adicional

- **Setup Completo**: `CLOUDFLARE_R2_SETUP.md`
- **Quick Start**: `QUICK_START_R2.md`
- **API para Frontend**: `FRONTEND_API.md`
- **Teste Local** (quando DNS funcionar): `npx tsx scripts/test-r2.ts`

---

## ✅ Checklist de Configuração

- [ ] Adicionei as 7 variáveis no Render Environment
- [ ] Salvei as mudanças (Save Changes)
- [ ] Aguardei o redeploy completar
- [ ] Verifiquei os logs (deve aparecer: "✅ R2 storage initialized successfully")
- [ ] Testei gerando um documento no frontend
- [ ] Verifiquei se o documento apareceu no dashboard do Cloudflare R2

---

**Após configurar, gere um documento de teste e me avise se funcionou!** 🚀
