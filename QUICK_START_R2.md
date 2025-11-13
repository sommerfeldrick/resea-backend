# 🚀 Quick Start - Cloudflare R2

Guia rápido de 5 minutos para configurar o Cloudflare R2.

---

## ⚡ Setup Rápido

### 1. Criar Conta e Bucket (5 min)

```bash
# 1. Acesse: https://dash.cloudflare.com/sign-up
# 2. Crie sua conta (grátis)
# 3. Vá em: R2 > Create bucket
# 4. Nome: resea-documents
# 5. Clique em: Create bucket
```

### 2. Gerar Credenciais (2 min)

```bash
# 1. Clique em: Manage R2 API Tokens
# 2. Clique em: Create API Token
# 3. Nome: resea-backend-api
# 4. Permissões: Object Read & Write
# 5. Copie as 3 informações:
#    - Access Key ID
#    - Secret Access Key
#    - Account ID (na URL do endpoint)
```

### 3. Configurar Backend (1 min)

Copie o arquivo de exemplo:

```bash
cp .env.r2.example .env.r2
```

Edite `.env.r2` com suas credenciais:

```bash
R2_ENABLED=true
R2_ACCOUNT_ID=SEU_ACCOUNT_ID_AQUI
R2_BUCKET_NAME=resea-documents
R2_ACCESS_KEY_ID=SUA_ACCESS_KEY_AQUI
R2_SECRET_ACCESS_KEY=SUA_SECRET_KEY_AQUI
R2_REGION=auto
R2_PUBLIC_DOMAIN=
```

Ou adicione ao seu `.env` existente.

### 4. Testar (30 seg)

```bash
# Instalar dependências (se ainda não instalou)
npm install

# Rodar teste
npx tsx scripts/test-r2.ts
```

**Resultado esperado:**

```
🧪 TESTE DE CONFIGURAÇÃO - CLOUDFLARE R2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ PASSO 1: Verificando Variáveis de Ambiente ━━━
✅ R2_ENABLED = true
✅ R2_ACCOUNT_ID = 1234567890abcdef
✅ R2_BUCKET_NAME = resea-documents
✅ R2_ACCESS_KEY_ID = a1b2***i9j0
✅ R2_SECRET_ACCESS_KEY = X1Y2***P9Q0
✅ R2_REGION = auto

━━━ PASSO 2: Verificando Disponibilidade do Serviço R2 ━━━
✅ Serviço R2 inicializado com sucesso!

━━━ PASSO 3: Testando Upload de Arquivo ━━━
✅ Upload realizado com sucesso!

━━━ PASSO 4: Gerando URL de Download Assinada ━━━
✅ URL assinada gerada com sucesso!

━━━ PASSO 5: Testando Download do Arquivo ━━━
✅ Download realizado com sucesso!
✅ Conteúdo verificado: Upload e Download são idênticos! ✨

━━━ PASSO 6: Deletando Arquivo de Teste ━━━
✅ Arquivo de teste deletado com sucesso!

🎉 TODOS OS TESTES PASSARAM COM SUCESSO!
```

---

## ✅ Pronto!

Seu backend está configurado para usar Cloudflare R2! 🎉

### O que acontece agora?

✅ **Documentos gerados são salvos automaticamente no R2**
- Upload transparente durante a geração
- Fallback para PostgreSQL se R2 falhar
- URLs assinadas com validade de 1 hora

✅ **Sistema de créditos funcionando**
- Contabiliza documentos (não palavras)
- Limite por plano: Básico=0, Standard=10, Premium=20
- Renovação automática mensal

✅ **Frontend pode consumir a API**
- `GET /api/research/credits` - Ver créditos disponíveis
- `GET /api/documents` - Listar documentos
- `GET /api/documents/:id/content` - Baixar conteúdo
- `GET /api/documents/:id/download` - Download direto

---

## 📚 Documentação Completa

**Se encontrar problemas ou quiser saber mais:**

1. **Guia Completo de Setup:** `CLOUDFLARE_R2_SETUP.md`
   - Passo a passo detalhado com screenshots
   - Solução de problemas comuns
   - Configuração de domínio customizado
   - Estimativa de custos

2. **API para Frontend:** `FRONTEND_API.md`
   - Todos os endpoints disponíveis
   - Exemplos de código React/TypeScript
   - Componentes prontos (CreditsBadge, DocumentsSidebar)

3. **Teste Automático:** `scripts/test-r2.ts`
   - Valida todas as configurações
   - Testa upload/download/delete
   - Verifica integridade dos dados

---

## 🆘 Solução Rápida de Problemas

### ❌ Erro: "Access Denied"

```bash
# Verifique as credenciais
R2_ACCESS_KEY_ID=...  # Correto?
R2_SECRET_ACCESS_KEY=...  # Correto?

# Token tem permissões corretas?
# Deve ter: "Object Read & Write"
```

### ❌ Erro: "Bucket not found"

```bash
# Nome do bucket está correto?
R2_BUCKET_NAME=resea-documents

# Bucket existe no dashboard?
# https://dash.cloudflare.com/ > R2
```

### ❌ Erro: "Invalid endpoint"

```bash
# Account ID está correto?
# Copie do endpoint URL:
# https://1234567890abcdef.r2.cloudflarestorage.com
#         ^^^^^^^^^^^^^^^^ <-- Este é o Account ID
```

### ❌ Erro: "Region not supported"

```bash
# Use sempre "auto"
R2_REGION=auto

# Nunca use: us-east-1, eu-west-1, etc
```

---

## 💰 Custos

**Free Tier:**
- 10 GB/mês grátis
- Downloads ilimitados grátis
- Perfeito para começar

**Além do Free Tier:**
- $0.015/GB/mês (armazenamento)
- $0 egress (downloads SEMPRE grátis!)

**Exemplo:**
- 100 documentos = ~2 GB = **$0/mês** (dentro do free tier)
- 1000 documentos = ~20 GB = **$0.15/mês**
- 10000 documentos = ~200 GB = **$2.85/mês**

Compare com AWS S3: 10-20x mais caro! 💸

---

## 🎯 Próximos Passos

1. ✅ **Testar manualmente:**
   ```bash
   # Gerar um documento no frontend
   # Verificar se foi salvo no R2
   # Dashboard: https://dash.cloudflare.com/ > R2 > Bucket
   ```

2. ✅ **Integrar com Frontend:**
   - Ver `FRONTEND_API.md`
   - Implementar CreditsBadge no header
   - Implementar DocumentsSidebar

3. ✅ **Monitorar uso:**
   - Dashboard: R2 > Analytics
   - Configurar alertas de custo
   - Revisar uso mensal

4. ✅ **Produção:**
   - Usar variáveis de ambiente no deploy
   - Configurar domínio customizado (opcional)
   - Rotacionar tokens a cada 90 dias

---

## 🔗 Links Úteis

- **Dashboard Cloudflare:** https://dash.cloudflare.com/
- **Documentação R2:** https://developers.cloudflare.com/r2/
- **Pricing Calculator:** https://www.cloudflare.com/products/r2/
- **Community:** https://community.cloudflare.com/

---

**Tem dúvidas?** Consulte o guia completo em `CLOUDFLARE_R2_SETUP.md`!
