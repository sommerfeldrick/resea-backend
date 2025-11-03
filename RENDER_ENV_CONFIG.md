# Configuração de Variáveis de Ambiente no Render

## ✅ Variáveis Já Configuradas
Você já tem estas variáveis configuradas no Render:
- ✅ DATABASE_URL (PostgreSQL)
- ✅ REDIS_URL (Redis)
- ✅ QDRANT_URL (Qdrant)
- ✅ OPENROUTER_API_KEY (OpenRouter AI)
- ✅ ELASTICSEARCH_URL (Elasticsearch Cloud)

## ⚠️ Variáveis Opcionais Recomendadas

### 1. Semantic Scholar API (Recomendado)
**Status atual**: Usando sem API key (limite: 100 req/min)
**Com API key**: 5.000 req/min

**Como obter:**
1. Acesse: https://www.semanticscholar.org/product/api
2. Crie uma conta gratuita
3. Gere uma API key
4. No Render, adicione:
   - **Nome**: `SEMANTIC_SCHOLAR_KEY`
   - **Valor**: sua_api_key_do_semantic_scholar

### 2. CORE API (Recomendado)
**Status atual**: Não configurado
**Benefício**: Acesso a 10.000 papers/dia gratuitos

**Como obter:**
1. Acesse: https://core.ac.uk/services/api
2. Registre-se gratuitamente
3. Solicite uma API key
4. No Render, adicione:
   - **Nome**: `CORE_API_KEY`
   - **Valor**: sua_api_key_do_core

### 3. Unpaywall Email (Recomendado)
**Status atual**: Não configurado
**Benefício**: Acesso a PDFs Open Access

**Como configurar:**
1. No Render, adicione:
   - **Nome**: `UNPAYWALL_EMAIL`
   - **Valor**: seu_email@exemplo.com (qualquer email válido)

## 🔧 Como Adicionar Variáveis no Render

### Via Dashboard:
1. Acesse https://dashboard.render.com
2. Selecione seu serviço **resea-backend**
3. Vá em **Environment** no menu lateral
4. Clique em **Add Environment Variable**
5. Preencha:
   - **Key**: Nome da variável (ex: `SEMANTIC_SCHOLAR_KEY`)
   - **Value**: Valor da variável
6. Clique em **Save Changes**
7. O Render fará redeploy automático

### Via Render CLI (Alternativa):
```bash
render env set SEMANTIC_SCHOLAR_KEY=sua_chave_aqui
render env set CORE_API_KEY=sua_chave_aqui
render env set UNPAYWALL_EMAIL=seu_email@exemplo.com
```

## 📊 Status Atual do Sistema

### ✅ Funcionando Perfeitamente:
- PostgreSQL (metadados dos artigos)
- Qdrant (busca vetorial semântica)
- Redis (cache)
- OpenRouter AI (embeddings + LLM)
- API Routes (todos os endpoints)

### ⚠️ Com Avisos (Não Críticos):
- **Elasticsearch**: Erro 406 de compatibilidade de versão
  - **Fix aplicado**: Commit 17ee498 (aguardando redeploy)
  - **Impacto**: Sistema funciona sem ele usando apenas Qdrant

- **Semantic Scholar**: Usando sem API key
  - **Impacto**: Limite de 100 req/min (vs 5k com key)
  - **Solução**: Adicionar variável `SEMANTIC_SCHOLAR_KEY`

### ❌ Não Configurados (Opcionais):
- CORE_API_KEY (adiciona 10k papers/dia)
- UNPAYWALL_EMAIL (acesso a PDFs OA)

## 🎯 Prioridades

### Alta Prioridade:
1. ✅ Aguardar redeploy do fix do Elasticsearch (commit 17ee498)

### Média Prioridade:
1. ⚠️ Adicionar `SEMANTIC_SCHOLAR_KEY` (aumenta capacidade 50x)

### Baixa Prioridade:
1. ⏳ Adicionar `CORE_API_KEY` (fontes adicionais)
2. ⏳ Adicionar `UNPAYWALL_EMAIL` (PDFs Open Access)

## 🚀 Sistema Pronto para Uso!

Seu backend está **funcionando e respondendo** em:
- **URL Principal**: https://api.smileai.com.br
- **Status**: ✅ Live (200 OK)

**Endpoints disponíveis:**
- `GET /` - Health check
- `POST /search/quick` - Busca rápida
- `POST /search/interactive` - Busca interativa com aprovação
- `POST /search/approve` - Aprovar resultado
- `POST /search/acquire-content` - Adquirir texto completo
- `GET /search/status/:sessionId` - Status da sessão

## 📝 Próximos Passos

1. **Imediato**: Aguardar redeploy (commit 17ee498 já foi aplicado)
2. **Hoje/Amanhã**: Adicionar `SEMANTIC_SCHOLAR_KEY` para melhor performance
3. **Quando quiser**: Adicionar CORE_API_KEY e UNPAYWALL_EMAIL para fontes adicionais

---

**Última atualização**: 2025-11-03
**Commits importantes**:
- `608a0eb` - Fix ES Modules (130+ imports)
- `17ee498` - Fix Elasticsearch compatibility
