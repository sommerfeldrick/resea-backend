# 🔧 Recomendações de Integração - API SmileAI com Resea

## 📊 Status Atual da Integração

### ✅ O que você já está fazendo bem:

1. **Autenticação OAuth2** - Implementado corretamente
2. **Fetch de dados de uso** - `/api/app/usage-data` sendo chamado
3. **Cache inteligente** - 30 segundos é razoável
4. **Fallback de créditos** - 100 palavras default se nenhum dado
5. **Token refresh automático** - Implementado no authService

---

## 🎯 Oportunidades de Melhoria

### 1. **Implementar AI Writer (Geração de Conteúdo)**

Seu app é focado em pesquisa, mas pode integrar geração de conteúdo:

**Endpoint**: `POST /api/aiwriter/generate`

```typescript
// services/contentGenerationService.ts
export async function generateContent(input: {
  post_type: 'article_generator' | 'summarize_text' | 'product_description' | /* ... */;
  maximum_length: number;
  number_of_results: number;
  creativity: number; // 0-1
  tone_of_voice: string; // 'Professional', 'Casual', etc
  language: string; // 'pt-BR', 'en-US'
  text_to_summary: string;
}) {
  const token = authService.getToken();
  const response = await fetch(`${API_BASE_URL}/api/aiwriter/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    },
    body: formData // FormData com os parâmetros acima
  });
  
  return response.json();
}
```

**Casos de Uso para Resea**:
- Resumir artigos da pesquisa
- Gerar título melhorado para o documento
- Gerar conclusão automática
- Reescrever em diferentes tons

---

### 2. **Implementar Chat (Conversas com IA)**

**Endpoints**:
- `POST /api/aichat/new-chat` - Criar conversa
- `POST /api/aichat/chat/chat-send` - Enviar mensagem (streaming)
- `DELETE /api/aichat/history` - Deletar conversa

```typescript
// services/chatService.ts
export async function createNewChat(categoryId: string) {
  return await authService.apiRequest(`/api/aichat/new-chat`, {
    method: 'POST',
    body: JSON.stringify({ category_id: categoryId })
  });
}

export async function sendChatMessage(
  converId: number,
  prompt: string,
  categoryId: number
) {
  // Usa Server-Sent Events para streaming
  const eventSource = new EventSource(
    `/api/aichat/chat/chat-send?conver_id=${converId}&message_id=${messageId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  eventSource.onmessage = (event) => {
    console.log('Streaming data:', event.data);
  };
}
```

---

### 3. **Sistema de Favoritos**

**Endpoints**:
- `GET /api/aiwriter/favorite-openai-list`
- `POST /api/aiwriter/favorite-openai-list-add`
- `POST /api/aiwriter/favorite-openai-list-remove`

```typescript
// services/favoritesService.ts
export async function addToFavorites(openaiId: number) {
  return await authService.apiRequest(
    `/api/aiwriter/favorite-openai-list-add?openai_id=${openaiId}`,
    { method: 'POST' }
  );
}

export async function removeFromFavorites(openaiId: number) {
  return await authService.apiRequest(
    `/api/aiwriter/favorite-openai-list-remove?openai_id=${openaiId}`,
    { method: 'POST' }
  );
}

export async function getFavorites() {
  return await authService.apiRequest(`/api/aiwriter/favorite-openai-list`);
}
```

---

### 4. **Geração de Imagens com IA**

**Endpoints**:
- `GET /api/aiimage/versions`
- `POST /api/aiimage/generate-image`
- `GET /api/aiimage/check-availability`

```typescript
// services/imageGenerationService.ts
export async function generateImage(params: {
  prompt: string;
  model: 'dall-e' | 'stable-diffusion';
  size?: string;
  quality?: string;
}) {
  return await authService.apiRequest(`/api/aiimage/generate-image`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}
```

---

## 🔍 Diagnóstico: Por que Créditos Aparecem como 0?

Analisando a API e seu código, as possíveis causas:

### Causa 1: **SmileAI não retorna `remaining_words` no login**
```typescript
// Seu código tenta isto:
words_left: Number(usageData?.words_left || userData.remaining_words || 0)

// Mas userData.remaining_words pode ser undefined
```

**Solução**: Adicionar log para debugar:
```typescript
console.log('userData fields:', Object.keys(userData));
console.log('usageData:', usageData);
```

### Causa 2: **`/api/app/usage-data` retorna erro silencioso**
```typescript
// Seu código falha silenciosamente:
if (usageResponse.ok) {
  // OK...
} else {
  console.warn('Falha ao buscar dados de uso:', usageResponse.status);
  // Continua sem dados!
}
```

**Solução**: Adicionar retry logic:
```typescript
async function fetchUsageDataWithRetry(token: string, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/usage-data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      if (response.status === 401) {
        // Token expirado, retorna null para retry
        return null;
      }
    } catch (error) {
      console.error(`Tentativa ${i + 1} falhou:`, error);
    }
    
    // Esperar antes de retry
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  
  return null; // Falhou após retries
}
```

### Causa 3: **Cache está servindo dados antigos ou vazios**
```typescript
// Seu cache de 30s pode estar guardando resposta vazia
// Solução: Limpar cache ao fazer login
handleTokenRedirect: async (token: string) => {
  authService.clearUserCache(); // ✅ Você já faz isto!
  // ...
}
```

---

## 💡 Melhorias Recomendadas

### 1. **Adicionar Logging Estruturado**

```typescript
// services/logger.ts
export const logger = {
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
    // Em produção, enviar para analytics
  }
};
```

### 2. **Endpoint Health Check**

```typescript
export async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      headers: { 'Authorization': `Bearer ${authService.getToken()}` }
    });
    
    if (!response.ok) {
      logger.warn('API health check failed', response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('API unreachable', error);
    return false;
  }
}
```

### 3. **Integrar Status de Créditos em Tempo Real**

```typescript
// Adicionar listener para mudanças de créditos
export function subscribeToCreditsChanges(callback: (credits: number) => void) {
  // Usar WebSocket ou polling a cada 1 minuto
  const interval = setInterval(async () => {
    const user = await authService.getCurrentUser();
    callback(user?.words_left || 0);
  }, 60000);
  
  return () => clearInterval(interval); // Unsubscribe
}
```

---

## 🚀 Roadmap de Integração

### Fase 1 (Agora ✅)
- [x] Autenticação OAuth
- [x] Fetch de créditos/dados de uso
- [x] Cache inteligente
- [x] Fallback de créditos

### Fase 2 (Próximo)
- [ ] Geração de conteúdo AI Writer
- [ ] Sistema de favoritos
- [ ] Melhor logging
- [ ] Health checks

### Fase 3 (Futuro)
- [ ] Chat em tempo real
- [ ] Geração de imagens
- [ ] Sistema de suporte integrado
- [ ] Analytics de uso

---

## 📋 Checklist de Testes

Quando implementar nova funcionalidade:

```
[ ] Testa com token válido
[ ] Testa com token expirado (deve renovar)
[ ] Testa sem créditos (deve retornar erro 419)
[ ] Testa com conexão ruim (deve ter timeout)
[ ] Testa logout corretamente
[ ] Testa rapidez de resposta (< 1s esperado)
[ ] Testa com diferentes planos (Básico, Standard, Premium)
[ ] Testa cache invalidation
[ ] Testa retry logic
[ ] Testa em produção (app.smileai.com.br)
```

---

## 🔗 Próximas Ações Recomendadas

1. **Adicionar logs detalhados** para debugar creditos=0
2. **Testar `/api/app/usage-data`** diretamente no Swagger
3. **Implementar retry logic** para requests falhos
4. **Adicionar testes e2e** para fluxo de créditos
5. **Considerar implementar geração de conteúdo** como feature complementar

---

**Documento criado**: 29/10/2025  
**Versão da API**: 1.0.0
