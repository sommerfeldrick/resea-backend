# Guia de Integração - SmileAI API

## 📋 Resumo da Implementação

Este guia mostra como integrar seu subdomínio `app.smileai.com.br` com a API principal do `smileai.com.br`.

## ✅ Arquivos Criados

1. **`services/smileaiAPI.ts`** - Serviço central de comunicação com a API
2. **`components/UserDashboard.tsx`** - Dashboard visual de créditos e plano
3. **`components/AuthIntegration.tsx`** - Componente de autenticação/integração

## 🚀 Como Usar

### 1. Integrar no App.tsx Principal

```tsx
import React from 'react';
import { AuthIntegration } from './components/AuthIntegration';
import { UserDashboard } from './components/UserDashboard';
import { smileaiAPI } from './services/smileaiAPI';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Componente de autenticação - verifica e redireciona se necessário */}
      <AuthIntegration
        onAuthSuccess={() => setIsAuthenticated(true)}
        onAuthError={(error) => console.error(error)}
      />

      {isAuthenticated && (
        <div className="container mx-auto p-6">
          {/* Sidebar com Dashboard */}
          <div className="grid grid-cols-12 gap-6">
            {/* Dashboard de Créditos - 3 colunas */}
            <aside className="col-span-12 lg:col-span-3">
              <UserDashboard />
            </aside>

            {/* Conteúdo Principal - 9 colunas */}
            <main className="col-span-12 lg:col-span-9">
              {/* Seu conteúdo principal aqui */}
              <YourMainComponent />
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 2. Usar o Hook de Uso de Créditos

```tsx
import { useUserUsage } from './components/UserDashboard';
import { smileaiAPI } from './services/smileaiAPI';

function YourFeatureComponent() {
  const { usageData, hasEnoughWords, refresh } = useUserUsage();

  const handleGenerateContent = async () => {
    // Verifica se tem créditos suficientes
    if (!hasEnoughWords(500)) {
      alert('Créditos insuficientes! Faça upgrade do seu plano.');
      return;
    }

    try {
      const result = await smileaiAPI.generateContent({
        post_type: 'summarize_text',
        maximum_length: 500,
        number_of_results: 1,
        creativity: 0.7,
        tone_of_voice: 'Professional',
        language: 'pt-BR',
        text_to_summary: 'Seu texto aqui...',
      });

      console.log('Conteúdo gerado:', result.generated_content);

      // Atualiza os créditos após gerar
      refresh();
    } catch (error) {
      if (error.message.includes('Créditos insuficientes')) {
        alert('Ops! Seus créditos acabaram. Faça upgrade!');
      } else {
        console.error('Erro:', error);
      }
    }
  };

  return (
    <div>
      <button onClick={handleGenerateContent}>
        Gerar Conteúdo ({usageData?.words_left} créditos)
      </button>
    </div>
  );
}
```

### 3. Exemplo de Geração de Imagem

```tsx
import { smileaiAPI } from './services/smileaiAPI';

async function generateImage() {
  try {
    const result = await smileaiAPI.generateImage({
      prompt: 'Um gato astronauta no espaço',
      size: '1024x1024',
      n: 1,
    });

    console.log('Imagem gerada:', result);
  } catch (error) {
    if (error.message.includes('Créditos de imagem insuficientes')) {
      alert('Créditos de imagem acabaram!');
    }
  }
}
```

## 🔐 Fluxo de Autenticação Recomendado

### Opção 1: Token via URL (Mais Segura) ⭐ RECOMENDADO

**No domínio principal (smileai.com.br):**
```php
// Backend Laravel - Após login bem-sucedido
Route::post('/auth/redirect-to-app', function (Request $request) {
    $user = $request->user();

    // Gera um token temporário de 5 minutos
    $tempToken = Str::random(64);
    Cache::put("temp_token:{$tempToken}", $user->id, now()->addMinutes(5));

    // Redireciona para o subdomínio
    return redirect("https://app.smileai.com.br?temp_token={$tempToken}");
});

// Endpoint para trocar o token temporário por um access_token real
Route::post('/auth/exchange-token', function (Request $request) {
    $tempToken = $request->input('temp_token');
    $userId = Cache::pull("temp_token:{$tempToken}");

    if (!$userId) {
        return response()->json(['error' => 'Token inválido'], 401);
    }

    $user = User::find($userId);
    $token = $user->createToken('app-token')->accessToken;

    return response()->json(['access_token' => $token]);
});
```

**No subdomínio (app.smileai.com.br):**
```tsx
// Já implementado no AuthIntegration.tsx!
// Ele automaticamente:
// 1. Detecta o token na URL
// 2. Troca por um access_token permanente
// 3. Remove o token da URL
// 4. Armazena no localStorage
```

### Opção 2: Cookie Compartilhado (Simples)

**Configuração no backend:**
```php
// config/session.php
'domain' => '.smileai.com.br', // Note o ponto no início

// No middleware de autenticação
Cookie::queue('smileai_token', $token, 60 * 24 * 30, '/', '.smileai.com.br', true, true);
```

## 📊 Contabilização de Créditos

A contabilização é **automática** pelo backend do SmileAI:

```
1. Frontend chama: POST /api/aiwriter/generate
2. Backend SmileAI:
   ✓ Verifica créditos do usuário
   ✓ Se OK: Gera conteúdo via IA (Ollama/GPT)
   ✓ Desconta créditos automaticamente
   ✓ Retorna o conteúdo gerado
3. Frontend: Atualiza dashboard de créditos
```

**Você NÃO precisa:**
- Chamar APIs externas (Ollama, GPT, etc.) diretamente
- Implementar lógica de desconto de créditos
- Gerenciar limites de planos

**Tudo é feito automaticamente pela API principal!**

## ⚠️ Tratamento de Erros Importantes

```tsx
try {
  await smileaiAPI.generateContent({...});
} catch (error) {
  if (error.message.includes('Sessão expirada')) {
    // Token inválido - redireciona para login
    window.location.href = 'https://smileai.com.br/login';
  }

  if (error.message.includes('Créditos insuficientes')) {
    // Sem créditos - mostra modal de upgrade
    showUpgradeModal();
  }

  if (error.message.includes('Geração de imagem em andamento')) {
    // Já tem uma geração em progresso
    alert('Por favor, aguarde a geração anterior terminar');
  }
}
```

## 🔧 Configurações Necessárias no Backend

### 1. CORS no Laravel

```php
// config/cors.php
return [
    'paths' => ['api/*', 'oauth/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'https://app.smileai.com.br',
        'https://smileai.com.br',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### 2. Domínios de Sessão

```php
// .env
SESSION_DOMAIN=.smileai.com.br
SANCTUM_STATEFUL_DOMAINS=smileai.com.br,app.smileai.com.br
```

## 📈 Monitoramento de Uso

```tsx
// Adicione listeners para atualizar o dashboard em tempo real
import { useUserUsage } from './components/UserDashboard';

function MyApp() {
  const { refresh: refreshUsage } = useUserUsage();

  // Atualiza créditos após cada geração
  const handleContentGenerated = () => {
    // ... lógica de geração
    refreshUsage(); // Atualiza o dashboard
  };

  return (
    // ...
  );
}
```

## 🎯 Checklist de Implementação

- [ ] Copiar arquivos criados para o projeto
- [ ] Configurar CORS no backend Laravel
- [ ] Implementar endpoint de troca de token temporário
- [ ] Integrar `AuthIntegration` no App.tsx
- [ ] Adicionar `UserDashboard` na sidebar
- [ ] Testar fluxo de login completo
- [ ] Testar geração de conteúdo
- [ ] Testar limite de créditos (erro 419)
- [ ] Testar atualização automática do dashboard
- [ ] Adicionar link de upgrade do plano

## 🔒 Segurança - Pontos Críticos

1. **NUNCA** exponha `client_secret` no frontend
2. **SEMPRE** use HTTPS em produção
3. **Valide** tokens no backend a cada requisição
4. **Implemente** rate limiting nos endpoints de geração
5. **Monitore** uso suspeito de créditos

## 📚 Endpoints Disponíveis

| Endpoint | Método | Descrição | Arquivo de Referência |
|----------|--------|-----------|----------------------|
| `/api/app/usage-data` | GET | Busca dados de uso e plano | `smileaiAPI.ts:87` |
| `/api/auth/profile` | GET | Perfil do usuário | `smileaiAPI.ts:109` |
| `/api/aiwriter/generate` | POST | Gera conteúdo de texto | `smileaiAPI.ts:131` |
| `/api/aiimage/generate-image` | POST | Gera imagem | `smileaiAPI.ts:174` |
| `/api/documents/recent` | GET | Documentos recentes | `smileaiAPI.ts:210` |
| `/api/auth/logout` | POST | Logout | `smileaiAPI.ts:231` |

## 🆘 Troubleshooting

### Erro: "CORS policy blocked"
```bash
# Verifique se o domínio está na whitelist do CORS
# Adicione no config/cors.php do Laravel
```

### Erro: "Token inválido"
```bash
# Limpe o localStorage e faça login novamente
localStorage.removeItem('smileai_access_token');
```

### Dashboard não atualiza após geração
```tsx
// Chame o método refresh() após cada geração
const { refresh } = useUserUsage();
await smileaiAPI.generateContent({...});
refresh(); // ← Adicione esta linha
```

## 📞 Suporte

Se tiver dúvidas sobre a integração:
1. Verifique os logs do console do navegador
2. Verifique os logs do Laravel (storage/logs)
3. Teste os endpoints diretamente via Postman/Insomnia
4. Consulte a documentação OpenAPI completa

---

**Nota:** Esta integração foi projetada para ser segura, escalável e fácil de manter. Todos os arquivos criados seguem as melhores práticas do React/TypeScript e Laravel.
