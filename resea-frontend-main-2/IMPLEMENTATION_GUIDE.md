# 🚀 Guia de Implementação Completo - Resea AI Research Assistant

## 📋 Índice

1. [Backend Setup](#backend-setup)
2. [Frontend Updates](#frontend-updates)
3. [Testing](#testing)
4. [Deployment](#deployment)
5. [Next Steps](#next-steps)

---

## 1. Backend Setup

### Instalar Dependências

```bash
cd backend
npm install
```

### Configurar Ambiente

```bash
cp .env.example .env
```

Edite `.env` e adicione sua chave do Gemini:
```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Iniciar Backend

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

O backend estará rodando em `http://localhost:3001`

---

## 2. Frontend Updates

### 2.1 Atualizar package.json do Frontend

Adicione ao `package.json` na raiz:

```json
{
  "dependencies": {
    "...": "existing dependencies",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

### 2.2 Criar arquivo .env no Frontend

```bash
cp .env.example .env
```

Conteúdo:
```env
VITE_API_URL=http://localhost:3001/api
```

### 2.3 Atualizar components/LandingPage.tsx

Substitua a importação do serviço:

```typescript
// ANTES:
import { generateTaskPlan } from '../services/geminiService';

// DEPOIS:
import { generateTaskPlan } from '../services/apiService';
```

### 2.4 Atualizar components/ResearchPage.tsx

Substitua as importações:

```typescript
// ANTES:
import {
  generateMindMap,
  performResearchStep,
  generateOutline,
  generateContentStream,
} from '../services/geminiService';

// DEPOIS:
import {
  generateMindMap,
  performResearchStep,
  generateOutline,
  generateContentStream,
} from '../services/apiService';
```

### 2.5 Atualizar App.tsx

Adicione no topo:

```typescript
import { useResearchHistory } from './hooks/useResearchHistory';
import { useTheme } from './hooks/useTheme';
import { exportAsMarkdown, exportAsHTML, exportAsJSON, printDocument } from './services/exportService';
```

Substitua o gerenciamento de histórico:

```typescript
// ANTES:
const [history, setHistory] = useState<CompletedResearch[]>(mockHistory);

// DEPOIS:
const {
  history,
  loading: historyLoading,
  addToHistory,
  removeFromHistory
} = useResearchHistory();
```

Substitua callbacks:

```typescript
// ANTES:
const handleDeleteHistory = (id: string) => {
  setHistory(prev => prev.filter(item => item.id !== id));
};

// DEPOIS:
const handleDeleteHistory = async (id: string) => {
  await removeFromHistory(id);
};
```

Quando completar pesquisa:

```typescript
// ANTES:
setHistory(prev => [completedResearch, ...prev]);

// DEPOIS:
await addToHistory(completedResearch);
```

### 2.6 Adicionar Menu de Exportação

No `ResearchPage.tsx`, adicione botão de exportação no header:

```typescript
<div className="flex items-center gap-2">
  <button
    onClick={() => exportAsMarkdown(currentResearch!)}
    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
  >
    Exportar MD
  </button>
  <button
    onClick={() => exportAsHTML(currentResearch!)}
    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
  >
    Exportar HTML
  </button>
  <button
    onClick={() => printDocument(currentResearch!)}
    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
  >
    Imprimir
  </button>
</div>
```

### 2.7 Adicionar Toggle de Modo Escuro

No `App.tsx`, adicione no Sidebar:

```typescript
import { useTheme } from './hooks/useTheme';

// Dentro do componente:
const { theme, resolvedTheme, toggleTheme } = useTheme();

// No sidebar, adicione antes do perfil:
<button
  onClick={toggleTheme}
  className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md flex items-center gap-2"
>
  {resolvedTheme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
</button>
```

### 2.8 Adicionar Estilos para Modo Escuro

No `index.html`, adicione no `<head>`:

```html
<style>
  [data-theme='dark'] {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --border-color: #404040;
  }

  [data-theme='dark'] body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  [data-theme='dark'] .bg-white {
    background-color: var(--bg-secondary);
  }

  [data-theme='dark'] .text-gray-900 {
    color: var(--text-primary);
  }

  [data-theme='dark'] .border-gray-200 {
    border-color: var(--border-color);
  }
</style>
```

---

## 3. Testing

### 3.1 Testar Backend

```bash
cd backend

# Verificar health
curl http://localhost:3001/api/health

# Testar geração de plano
curl -X POST http://localhost:3001/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"query": "Impacto da IA na educação"}'
```

### 3.2 Testar Frontend

```bash
# Na raiz do projeto
npm run dev
```

Acesse `http://localhost:3000` e teste:

1. ✅ Criar nova pesquisa
2. ✅ Ver plano gerado
3. ✅ Confirmar e iniciar pesquisa
4. ✅ Ver mapa mental
5. ✅ Ver fontes acadêmicas
6. ✅ Ver esboço
7. ✅ Ver documento final
8. ✅ Exportar documentos
9. ✅ Salvar no histórico
10. ✅ Alternar modo escuro
11. ✅ Recarregar página (histórico persiste)

---

## 4. Deployment

### 4.1 Deploy Backend (Exemplo: Heroku)

```bash
cd backend

# Criar Procfile
echo "web: node dist/server.js" > Procfile

# Build
npm run build

# Deploy
git init
heroku create resea-backend
git add .
git commit -m "Deploy backend"
git push heroku main

# Configurar variáveis
heroku config:set GEMINI_API_KEY=your_key
heroku config:set FRONTEND_URL=https://your-frontend.com
```

### 4.2 Deploy Frontend (Exemplo: Vercel)

```bash
# Na raiz
npm run build

# Deploy com Vercel
vercel --prod

# Ou Netlify
netlify deploy --prod --dir=dist
```

Configure variáveis de ambiente:
- `VITE_API_URL=https://resea-backend.herokuapp.com/api`

---

## 5. Next Steps

### 5.1 Funcionalidades Implementadas ✅

- ✅ Backend seguro com API keys protegidas
- ✅ Sistema avançado de extração de artigos
- ✅ Leitura e análise de PDFs
- ✅ Filtros de busca avançados (ano, citações, open access)
- ✅ Circuit breakers e retry logic
- ✅ Cache em memória (Redis opcional)
- ✅ Persistência com IndexedDB
- ✅ Exportação (Markdown, HTML, JSON, Text)
- ✅ Modo escuro
- ✅ Logging estruturado
- ✅ Deduplicação inteligente
- ✅ Ranking por qualidade

### 5.2 Próximas Melhorias 🚀

#### A. Testes Automatizados

```bash
cd backend
npm install -D vitest @vitest/coverage-v8
```

Criar `backend/src/__tests__/academicSearch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extrairPalavrasChave, buscaAcademicaUniversal } from '../services/academicSearch';

describe('Academic Search', () => {
  it('should extract keywords', () => {
    const keywords = extrairPalavrasChave('Inteligência artificial na educação');
    expect(keywords).toContain('inteligência');
    expect(keywords).toContain('artificial');
    expect(keywords).toContain('educação');
  });

  it('should search multiple APIs', async () => {
    const results = await buscaAcademicaUniversal('machine learning', {
      maxResults: 5
    });
    expect(results.length).toBeGreaterThan(0);
  });
});
```

#### B. Sistema de Templates

Criar `services/templateService.ts`:

```typescript
export const templates = {
  tcc: {
    name: 'TCC (Trabalho de Conclusão de Curso)',
    structure: ['Introdução', 'Revisão de Literatura', 'Metodologia', 'Resultados', 'Conclusão'],
    wordCount: '8000-12000'
  },
  artigo: {
    name: 'Artigo Científico',
    structure: ['Abstract', 'Introdução', 'Metodologia', 'Resultados', 'Discussão', 'Conclusão'],
    wordCount: '4000-6000'
  },
  dissertacao: {
    name: 'Dissertação de Mestrado',
    structure: ['Introdução', 'Fundamentação Teórica', 'Metodologia', 'Análise', 'Conclusão'],
    wordCount: '15000-25000'
  }
};
```

#### C. Colaboração em Tempo Real

Usar Socket.io para múltiplos usuários:

```bash
npm install socket.io socket.io-client
```

```typescript
// backend/src/server.ts
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL }
});

io.on('connection', (socket) => {
  socket.on('join-research', (researchId) => {
    socket.join(researchId);
  });

  socket.on('comment', (data) => {
    io.to(data.researchId).emit('new-comment', data);
  });
});
```

#### D. Autenticação (Opcional)

Usar NextAuth.js ou Clerk:

```bash
npm install next-auth
# ou
npm install @clerk/nextjs
```

#### E. Analytics

```typescript
// services/analyticsService.ts
export function trackEvent(event: string, properties?: any) {
  console.log('📊', event, properties);

  // Integrar com Google Analytics, Mixpanel, etc.
  if (window.gtag) {
    window.gtag('event', event, properties);
  }
}

// Uso:
trackEvent('research_completed', {
  query: research.query,
  sourcesCount: research.researchResults.length,
  wordCount: research.writtenContent.length
});
```

#### F. Otimizações de Performance

**Lazy Loading:**

```typescript
// App.tsx
import { lazy, Suspense } from 'react';

const ResearchPage = lazy(() => import('./components/ResearchPage'));

<Suspense fallback={<LoadingSpinner />}>
  <ResearchPage ... />
</Suspense>
```

**Memoização:**

```typescript
// ResearchPage.tsx
import { memo, useMemo } from 'react';

const ParsedContent = memo(({ content, sources }: ParsedContentProps) => {
  const processedContent = useMemo(() => {
    return parseContent(content, sources);
  }, [content, sources]);

  return <div>{processedContent}</div>;
});
```

**Debouncing:**

```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 📊 Comparação: Antes vs Depois

### Antes 🔴

- ❌ API keys expostas no frontend
- ❌ Sem persistência (dados perdidos ao recarregar)
- ❌ Apenas metadados dos artigos (sem PDFs)
- ❌ Limite de 3 artigos por API
- ❌ Sem retry logic (falhas permanentes)
- ❌ Sem cache (requisições repetidas)
- ❌ Sem filtros de busca
- ❌ Sem exportação de documentos
- ❌ Sem modo escuro
- ❌ Sem logging estruturado

### Depois ✅

- ✅ API keys seguras no backend
- ✅ Persistência com IndexedDB
- ✅ Extração completa de PDFs
- ✅ 10-20 artigos por busca (configurável)
- ✅ Retry automático com exponential backoff
- ✅ Cache inteligente (1 hora TTL)
- ✅ Filtros: ano, citações, open access
- ✅ Exportação: MD, HTML, JSON, TXT
- ✅ Modo claro/escuro
- ✅ Logging completo com Winston

---

## 🐛 Troubleshooting

### Erro: "Failed to connect to server"

**Causa:** Backend não está rodando

**Solução:**
```bash
cd backend
npm run dev
```

### Erro: "GEMINI_API_KEY not configured"

**Causa:** Variável de ambiente não configurada

**Solução:**
```bash
# backend/.env
GEMINI_API_KEY=your_key_here
```

### Erro: "IndexedDB not available"

**Causa:** Navegador não suporta ou está em modo privado

**Solução:** Sistema usa localStorage como fallback automaticamente

### Erro: "Rate limit exceeded"

**Causa:** Muitas requisições

**Solução:** Ajuste `RATE_LIMIT_MAX_REQUESTS` no backend/.env

### Erro: "PDF extraction failed"

**Causa:** PDF não acessível ou muito grande

**Solução:** Sistema continua funcionando com apenas metadados

---

## 📚 Recursos Adicionais

### Documentação

- **Backend API:** `backend/README.md`
- **Types:** `types.ts`
- **Services:** `services/`

### Testes

```bash
# Backend
cd backend
npm test

# Frontend (quando implementado)
npm test
```

### Logs

```bash
# Backend logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Monitoring

```bash
# Health check
curl http://localhost:3001/api/health

# Stats
curl http://localhost:3001/api/health | jq
```

---

## 🎉 Conclusão

Você agora tem um sistema completo de assistente de pesquisa acadêmica com:

- Backend seguro e escalável
- Extração avançada de artigos científicos
- Persistência de dados
- Exportação de documentos
- Interface moderna com modo escuro
- Sistema de logging e monitoramento

**Próximos passos sugeridos:**
1. Implementar testes automatizados
2. Adicionar autenticação de usuários
3. Implementar colaboração em tempo real
4. Deploy em produção
5. Adicionar analytics

Boa sorte! 🚀
