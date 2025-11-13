# ☁️ Guia Completo: Configuração do Cloudflare R2

Este guia explica passo a passo como configurar o Cloudflare R2 para armazenamento de documentos.

---

## 📋 O que é Cloudflare R2?

**Cloudflare R2** é um serviço de armazenamento de objetos (object storage) compatível com S3:

✅ **Vantagens:**
- **Zero custos de saída (egress)** - Downloads gratuitos ilimitados
- **Preço baixo:** $0.015/GB/mês para armazenamento
- **Compatível com S3** - Usa a mesma API da AWS S3
- **Global e rápido** - CDN integrado do Cloudflare
- **10 GB grátis/mês** - Plano gratuito generoso

💰 **Custo Estimado:**
- 100 GB armazenados = $1.50/mês
- Downloads ilimitados = $0 (grátis!)
- Sem taxas surpresa

---

## 🚀 Passo 1: Criar Conta no Cloudflare

### 1.1. Acesse o site
```
https://dash.cloudflare.com/sign-up
```

### 1.2. Crie sua conta
- Use seu email profissional
- Crie uma senha forte
- Confirme o email

### 1.3. Faça login
```
https://dash.cloudflare.com/login
```

---

## 📦 Passo 2: Ativar o Cloudflare R2

### 2.1. No Dashboard do Cloudflare

1. **Clique em "R2"** no menu lateral esquerdo
2. Se for a primeira vez, clique em **"Purchase R2 Plan"** ou **"Enable R2"**
3. **Escolha o plano:**
   - **Free Plan**: 10 GB/mês grátis (recomendado para começar)
   - **Paid Plan**: $0.015/GB além dos 10 GB gratuitos

### 2.2. Adicione um método de pagamento (obrigatório)

Mesmo no plano gratuito, o Cloudflare exige um cartão de crédito para validação:

1. Vá em **"Billing"** (no canto superior direito)
2. Clique em **"Add Payment Method"**
3. Adicione seu cartão de crédito
4. **Não será cobrado** enquanto estiver dentro dos 10 GB gratuitos

---

## 🪣 Passo 3: Criar um Bucket

### 3.1. Criar o Bucket

1. No dashboard do R2, clique em **"Create bucket"**
2. **Configure:**

```
Bucket Name: resea-documents
Location: Automatic (recomendado)
   └── Cloudflare escolhe automaticamente o melhor data center

Storage Class: Standard
```

3. Clique em **"Create bucket"**

### 3.2. Entendendo as opções

**Bucket Name:**
- Nome único globalmente
- Apenas letras minúsculas, números e hífens
- Exemplo: `resea-documents`, `meuapp-files`, `docs-prod`

**Location:**
- `Automatic`: Cloudflare escolhe automaticamente (RECOMENDADO)
- `Europe`: Data centers europeus (GDPR compliance)
- `North America`: Data centers norte-americanos

**Storage Class:**
- `Standard`: Acesso frequente (nosso caso)
- `Infrequent Access`: Arquivos raramente acessados (mais barato)

---

## 🔑 Passo 4: Gerar Access Keys (API Tokens)

### 4.1. Criar API Token

1. No dashboard do R2, clique em **"Manage R2 API Tokens"**
2. Clique em **"Create API Token"**
3. **Configure:**

```
Token Name: resea-backend-api
Permissions:
  ☑ Object Read & Write
TTL (Time to Live): Forever (ou escolha uma data de expiração)
```

4. **Importante:** Escolha as permissões:
   - ☑ **Admin Read & Write** (acesso total) OU
   - ☑ **Object Read & Write** (apenas leitura/escrita de objetos - RECOMENDADO)

5. Clique em **"Create API Token"**

### 4.2. Copiar as Credenciais

Após criar, você verá uma tela com 3 informações importantes:

```
Access Key ID: a1b2c3d4e5f6g7h8i9j0
Secret Access Key: X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0
Endpoint URL: https://1234567890abcdef.r2.cloudflarestorage.com
```

⚠️ **ATENÇÃO:**
- **Copie e guarde essas informações AGORA**
- Você **NÃO** poderá ver o `Secret Access Key` novamente
- Se perder, terá que criar um novo token

### 4.3. Extrair Account ID

O **Account ID** está na URL do endpoint:

```
Endpoint URL: https://1234567890abcdef.r2.cloudflarestorage.com
                      ^^^^^^^^^^^^^^^^
                      Este é seu Account ID
```

Ou você pode encontrar no dashboard:
1. Clique no seu nome de usuário (canto superior direito)
2. Selecione qualquer domínio
3. Na barra lateral, olhe a URL: `dash.cloudflare.com/{ACCOUNT_ID}/...`

---

## ⚙️ Passo 5: Configurar Variáveis de Ambiente

### 5.1. Abra o arquivo `.env`

No seu projeto backend:

```bash
nano .env
# ou
code .env
```

### 5.2. Adicione as variáveis do R2

```bash
# Cloudflare R2 Storage
R2_ENABLED=true
R2_ACCOUNT_ID=1234567890abcdef
R2_BUCKET_NAME=resea-documents
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0
R2_SECRET_ACCESS_KEY=X1Y2Z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q0
R2_REGION=auto
R2_PUBLIC_DOMAIN=
```

### 5.3. Explicação das Variáveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `R2_ENABLED` | Ativar/desativar R2 | `true` ou `false` |
| `R2_ACCOUNT_ID` | ID da sua conta Cloudflare | `1234567890abcdef` |
| `R2_BUCKET_NAME` | Nome do bucket criado | `resea-documents` |
| `R2_ACCESS_KEY_ID` | Access Key gerada | `a1b2c3d4e5f6...` |
| `R2_SECRET_ACCESS_KEY` | Secret Key gerada | `X1Y2Z3A4B5C6...` |
| `R2_REGION` | Região (sempre `auto`) | `auto` |
| `R2_PUBLIC_DOMAIN` | Domínio customizado (opcional) | deixe vazio por ora |

---

## 🧪 Passo 6: Testar a Configuração

### 6.1. Reiniciar o Backend

```bash
# Pare o servidor (Ctrl+C)
# Inicie novamente
npm run dev
```

### 6.2. Verificar Logs

Você deve ver no console:

```
✅ Cloudflare R2 storage initialized successfully
   Bucket: resea-documents
   Region: auto
   Account: 1234567890abcdef
```

Se vir erro:
```
❌ R2 storage not available, using PostgreSQL fallback
```

Significa que as credenciais estão incorretas ou o bucket não existe.

### 6.3. Testar Upload Manual

Crie um arquivo de teste `test-r2.ts`:

```typescript
import { storageService } from './src/services/storageService.js';

async function testR2() {
  try {
    console.log('🧪 Testando upload para R2...');

    // Upload de teste
    const result = await storageService.uploadDocument(
      'test-user',
      'test-doc-123',
      Buffer.from('<html><body>Teste R2</body></html>'),
      'text/html',
      'html'
    );

    console.log('✅ Upload bem-sucedido!');
    console.log('   Key:', result.key);
    console.log('   URL:', result.url);
    console.log('   Size:', result.size, 'bytes');

    // Gerar URL de download
    const downloadUrl = await storageService.getSignedDownloadUrl(result.key, 3600);
    console.log('📥 URL de download (válida por 1h):');
    console.log('   ', downloadUrl);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testR2();
```

Execute:
```bash
npx tsx test-r2.ts
```

Resultado esperado:
```
🧪 Testando upload para R2...
✅ Upload bem-sucedido!
   Key: documents/test-user/test-doc-123.html
   URL: https://resea-documents.1234567890abcdef.r2.cloudflarestorage.com/documents/test-user/test-doc-123.html
   Size: 36 bytes
📥 URL de download (válida por 1h):
    https://resea-documents.1234567890abcdef.r2.cloudflarestorage.com/documents/test-user/test-doc-123.html?X-Amz-Algorithm=...
```

---

## 🌐 Passo 7: Configurar Domínio Público (Opcional)

Por padrão, as URLs do R2 são longas e feias:
```
https://resea-documents.1234567890abcdef.r2.cloudflarestorage.com/...
```

Você pode configurar um domínio customizado:

### 7.1. Adicionar Domínio Customizado

1. No dashboard do R2, selecione seu bucket `resea-documents`
2. Vá na aba **"Settings"**
3. Clique em **"Connect Domain"**
4. **Opções:**

**Opção A: Usar subdomínio do seu site**
```
files.seusite.com
docs.seusite.com
cdn.seusite.com
```

**Opção B: Usar domínio R2 público**
```
resea-documents.r2.dev (gratuito)
```

5. Siga as instruções para adicionar registro CNAME no seu DNS

### 7.2. Atualizar `.env`

Depois de configurar:

```bash
R2_PUBLIC_DOMAIN=https://files.seusite.com
# ou
R2_PUBLIC_DOMAIN=https://resea-documents.r2.dev
```

Agora as URLs ficarão bonitas:
```
https://files.seusite.com/documents/123/456.html
```

---

## 🔒 Passo 8: Segurança e Boas Práticas

### 8.1. Permissões do Bucket

Por padrão, o bucket é **privado** (não acessível publicamente). Isso é correto!

Os documentos só podem ser acessados via:
- **URLs assinadas** (presigned URLs) com expiração de 1 hora
- **API do backend** com autenticação

### 8.2. Rotação de Tokens

Recomendado a cada 90 dias:

1. Crie um novo API Token
2. Atualize o `.env` com as novas credenciais
3. Teste se está funcionando
4. Delete o token antigo

### 8.3. Backup

Configure backup automático (opcional):

1. No dashboard do R2, vá em **"Settings"**
2. Configure **"Object Lifecycle"**
3. Adicione regra de retenção:
   - Manter versões antigas por 30 dias
   - Deletar automaticamente após 365 dias (se desejar)

---

## 🐛 Solução de Problemas

### Erro: "Access Denied"

**Causa:** Credenciais incorretas ou token sem permissões.

**Solução:**
1. Verifique `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`
2. Certifique-se que o token tem permissões de **Read & Write**
3. Recrie o token se necessário

### Erro: "Bucket not found"

**Causa:** Nome do bucket incorreto ou não existe.

**Solução:**
1. Verifique `R2_BUCKET_NAME` no `.env`
2. No dashboard R2, confirme que o bucket existe
3. Nomes são case-sensitive: `resea-documents` ≠ `Resea-Documents`

### Erro: "Region not supported"

**Causa:** Região configurada incorretamente.

**Solução:**
1. Sempre use `R2_REGION=auto`
2. O Cloudflare R2 não usa regiões como AWS S3

### Erro: "Invalid endpoint"

**Causa:** `R2_ACCOUNT_ID` incorreto.

**Solução:**
1. Copie o Account ID corretamente do endpoint URL
2. Formato: 16 caracteres hexadecimais (ex: `1234567890abcdef`)

### Uploads lentos

**Causa:** Servidor longe dos data centers do Cloudflare.

**Solução:**
1. Use `R2_REGION=auto` para roteamento automático
2. Considere usar Cloudflare Workers para upload direto do frontend

---

## 📊 Monitoramento e Custos

### Ver Uso no Dashboard

1. No dashboard do R2, clique em **"Analytics"**
2. Visualize:
   - **Storage:** GB armazenados
   - **Requests:** Número de uploads/downloads
   - **Egress:** Tráfego de saída (sempre $0!)

### Estimativa de Custos

**Cenário 1: Startup (100 documentos/mês)**
```
Armazenamento: 2 GB
Requests: 500/mês (uploads + downloads)
Egress: 10 GB

Custo: $0/mês (dentro do free tier)
```

**Cenário 2: Crescimento (1000 documentos/mês)**
```
Armazenamento: 20 GB
Requests: 5000/mês
Egress: 100 GB

Custo:
  Storage: (20 GB - 10 GB free) × $0.015 = $0.15
  Requests: Incluído no plano
  Egress: $0 (sempre grátis!)

Total: $0.15/mês
```

**Cenário 3: Escala (10.000 documentos/mês)**
```
Armazenamento: 200 GB
Requests: 50.000/mês
Egress: 1 TB

Custo:
  Storage: (200 GB - 10 GB free) × $0.015 = $2.85
  Requests: ~$0.50
  Egress: $0 (sempre grátis!)

Total: ~$3.35/mês
```

---

## 🔄 Alternativas (Comparação)

| Serviço | Storage | Egress | Custo Mensal (20 GB) |
|---------|---------|--------|----------------------|
| **Cloudflare R2** | $0.015/GB | **$0** | **$0.15** ✅ |
| AWS S3 | $0.023/GB | $0.09/GB | $2.26 |
| Google Cloud Storage | $0.020/GB | $0.12/GB | $2.80 |
| Azure Blob Storage | $0.018/GB | $0.087/GB | $2.10 |

**Vencedor:** Cloudflare R2 (10x mais barato!)

---

## 📚 Recursos Adicionais

**Documentação Oficial:**
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/)
- [Pricing Calculator](https://www.cloudflare.com/products/r2/)

**Ferramentas Úteis:**
- [s3cmd](https://s3tools.org/s3cmd) - CLI para gerenciar buckets
- [Cyberduck](https://cyberduck.io/) - GUI para navegação

**Comunidade:**
- [Cloudflare Community](https://community.cloudflare.com/)
- [Discord](https://discord.gg/cloudflaredev)

---

## ✅ Checklist Final

Antes de ir para produção:

- [ ] Conta Cloudflare criada e verificada
- [ ] R2 ativado (mesmo no free tier, precisa de cartão)
- [ ] Bucket `resea-documents` criado
- [ ] API Token gerado com permissões corretas
- [ ] Account ID copiado corretamente
- [ ] Variáveis de ambiente configuradas no `.env`
- [ ] Teste de upload realizado com sucesso
- [ ] URLs assinadas funcionando
- [ ] Fallback para PostgreSQL testado (se R2 falhar)
- [ ] Monitoramento de custos configurado

---

## 🆘 Precisa de Ajuda?

**Erros comuns já resolvidos?** Veja a seção "Solução de Problemas" acima.

**Ainda com problemas?** Compartilhe:
1. Mensagem de erro completa
2. Configuração do `.env` (sem revelar secrets!)
3. Logs do backend

---

**Última atualização:** 2024-01-20
**Versão:** 1.0
**Autor:** Claude Code
