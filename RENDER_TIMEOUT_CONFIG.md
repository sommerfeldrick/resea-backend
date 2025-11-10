# Configuração de Timeout no Render.com

## Problema
As análises AI complexas podem levar vários minutos (até 6 minutos com análise de 30 artigos). O timeout padrão do Render.com pode causar erro 502 Bad Gateway se não for configurado corretamente.

## Solução: Configurar Timeout no Dashboard

### **IMPORTANTE**: Plano Free tem timeout fixo de 30 segundos

O **Render.com Free Plan** NÃO permite alterar o timeout - ele fica fixo em **30 segundos**.

Para ter timeouts maiores, você precisa fazer upgrade para um plano pago:

### Planos Render.com com Timeout Configurável

| Plano | Preço/mês | Timeout Máximo | Timeout Padrão |
|-------|-----------|----------------|----------------|
| **Free** | $0 | **30s (fixo)** | 30s |
| **Starter** | $7 | **10 minutos** | 30s |
| **Standard** | $25+ | **10 minutos** | 30s |

### Como Configurar Timeout (Planos Pagos)

1. Acesse [https://dashboard.render.com](https://dashboard.render.com)
2. Selecione o serviço **resea-backend**
3. Vá em **Settings** → **General**
4. Procure por **"Request Timeout"** ou **"HTTP Timeout"**
5. Altere para **600 segundos (10 minutos)**
6. Clique em **Save Changes**

## Alternativa para Plano Free: Otimizar Performance

Se você está no plano Free, temos 3 opções:

### Opção 1: Aceitar o Timeout de 30s (ATUAL)
- Código já otimizado para tentar completar em menos de 30s
- Análise de 20 artigos com abstracts reduzidos
- maxTokens: 10000
- Pode falhar em análises muito complexas

### Opção 2: Usar Streaming SSE
- Geração de conteúdo usa streaming (não tem timeout)
- Análise poderia ser convertida para streaming incremental
- Frontend recebe dados progressivamente

### Opção 3: Background Jobs (Requer infraestrutura adicional)
- Mover análise para background worker
- Usar fila (Redis/BullMQ)
- Polling do frontend para verificar status

## Configuração Atual do Código

Com o código atual (após últimas mudanças):

### Configuração MÁXIMA QUALIDADE (Para planos com timeout longo)
```typescript
// Análise
maxTokens: 20000
articlesContext: 30 artigos
abstractLength: 400 chars
authorsCount: 5 primeiros

// Estratégia
maxTokens: 20000
```

### Configuração OTIMIZADA (Para plano Free - 30s timeout)
```typescript
// Análise
maxTokens: 10000
articlesContext: 20 artigos
abstractLength: 200 chars
authorsCount: 3 primeiros

// Estratégia
maxTokens: 10000
```

## Recomendação

**Para produção com qualidade máxima**: Upgrade para plano Starter ($7/mês) + timeout de 600s

**Para desenvolvimento/testes no Free**: Usar configuração otimizada (reduzida)
