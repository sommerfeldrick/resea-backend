# 🧪 Guia de Teste - Sistema Resea AI

## 🎯 Objetivo

Este guia fornece instruções passo a passo para testar todas as funcionalidades do sistema, com foco especial no **sistema de créditos** e no **fluxo completo das 8 fases**.

---

## 📋 Pré-requisitos

### 1. Autenticação
- ✅ Estar logado na plataforma SmileAI
- ✅ Ter um token de autenticação válido
- ✅ Ter créditos disponíveis

### 2. Como Obter o Token

**Opção A: Pelo Console do Browser**
```javascript
// Abra o DevTools (F12) na aplicação
// Vá para Console e execute:
localStorage.getItem('smileai_token')
```

**Opção B: Pelo Network Tab**
```
1. Abra DevTools (F12)
2. Vá para aba Network
3. Faça qualquer requisição na aplicação
4. Clique em qualquer request
5. Veja o header Authorization: Bearer {TOKEN}
```

---

## 🧪 Teste Automatizado de Endpoints

### Executar Script de Teste

```bash
# No servidor backend
cd /home/user/resea-backend

# Exportar seu token
export TOKEN='cole_seu_token_aqui'

# Executar script
./scripts/test-endpoints.sh
```

### Saída Esperada

```
✓ 200 - Endpoint funcionando
⚠ 401 - Precisa de autenticação
✗ 404 - Endpoint não encontrado
✗ 500 - Erro no servidor
```

---

## 🔍 Teste Manual Completo

### **PARTE 1: Verificar Exibição de Créditos** ⭐

#### Passo 1: Acessar a Aplicação
1. Abra `https://app.smileai.com.br` (ou seu ambiente)
2. Faça login se necessário
3. Aguarde carregamento completo

#### Passo 2: Verificar Menu de Perfil
1. No canto superior direito, clique no **avatar/nome do usuário**
2. Verifique se aparece:
   - ✅ Nome do usuário
   - ✅ Email
   - ✅ **Plano** (ex: "Básico", "Pro")
   - ✅ **Créditos** (ex: "50.000")
   - ✅ Botão "Fazer Upgrade"

#### Passo 3: Verificar Fonte dos Créditos
Abra DevTools (F12) → Console e observe as mensagens:
```
🔐 [RESEA-CREDITOS] Iniciando busca de dados do usuário...
🔍 Tentativa 1: Buscando /api/user/credits (sistema local Resea)...
✅ Dados de créditos locais obtidos: {...}
```

**✅ SUCESSO se:**
- Créditos aparecem no menu
- Console mostra "✅ Dados de créditos locais obtidos"
- Fonte é "resea-local"

**❌ ERRO se:**
- Créditos aparecem como "0" ou não aparecem
- Console mostra erro "⚠️ Erro ao buscar /api/user/credits"
- Precisa fallback para SmileAI Platform

---

### **PARTE 2: Testar Fluxo Completo (8 Fases)** 🎯

#### **FASE 1: Onboarding**

1. Navegue para página inicial da pesquisa
2. Você deve ver:
   - ✅ Título "Assistente de Pesquisa Acadêmica"
   - ✅ Campo de texto para digitar o tema
   - ✅ Exemplos de queries
   - ✅ Botão "Continuar"

3. **Digite uma query de teste:**
   ```
   Inteligência Artificial na educação infantil
   ```

4. Clique em **"Continuar"**

**✅ SUCESSO se:**
- Botão mostra spinner "Iniciando..."
- Transiciona para Fase 2

**❌ ERRO se:**
- Página fica em branco
- Mostra erro de autenticação
- Console mostra erro CORS

**Troubleshooting:**
- Se aparecer "Sua sessão expirou" → Faça login novamente
- Se página ficar em branco → Verifique console para erros

---

#### **FASE 2: Clarification**

**O que esperar:**
1. ✅ Barra de progresso (ex: "Pergunta 1 de 5 - 20%")
2. ✅ Pergunta de clarificação
3. ✅ Opções de resposta (múltipla escolha, texto, range, checkboxes)
4. ✅ Botões "Anterior" e "Próxima"

**Teste:**
1. Responda cada pergunta
2. Navegue entre perguntas (Anterior/Próxima)
3. Na última pergunta, clique em **"Concluir"**

**Console deve mostrar:**
```
Fase 2: Clarification
Pergunta 1/5 respondida
...
Processando respostas de clarificação...
✓ Respostas processadas
```

**✅ SUCESSO se:**
- Todas as perguntas aparecem corretamente
- Navegação funciona
- Transiciona para Fase 3

**❌ ERRO se:**
- Mostra "Carregando..." indefinidamente
- Pergunta não encontrada
- Não consegue navegar

**Troubleshooting:**
- Abra DevTools → Network → Verifique request para `/api/research-flow/clarification/generate`
- Status 200 = OK, Status 401/403 = Problema de auth

---

#### **FASE 3: Strategy Generation**

**O que esperar:**
1. ✅ Resumo das respostas de clarificação
2. ✅ Estratégia de busca gerada:
   - Termos de busca
   - Databases selecionadas
   - Filtros aplicados
3. ✅ Botão "Iniciar Busca"

**Teste:**
1. Revise a estratégia gerada
2. Clique em **"Iniciar Busca"**

**✅ SUCESSO:** Transiciona para Fase 4

---

#### **FASE 4: Exhaustive Search** 📡 SSE

**O que esperar:**
1. ✅ Progresso em tempo real:
   - "Buscando no PubMed... 45 artigos encontrados"
   - "Buscando no Google Scholar... 120 artigos encontrados"
2. ✅ Preview de artigos aparecendo em tempo real
3. ✅ Badges de prioridade (P1, P2, P3)
4. ✅ Indicador "📄 Texto completo" quando disponível

**Teste:**
1. Observe o progresso da busca
2. Veja os artigos aparecendo na grid
3. Aguarde mensagem "✓ Busca concluída - X artigos encontrados"

**Console deve mostrar:**
```
SSE: Conectado ao stream de busca
SSE: Progresso - PubMed: 45 artigos
SSE: Artigos recebidos (lote 1/5)
SSE: Busca completa
```

**✅ SUCESSO se:**
- Vê progresso em tempo real
- Artigos aparecem durante a busca
- Não trava ou timeout
- Transiciona automaticamente para Fase 5

**❌ ERRO se:**
- Fica travado em "Iniciando busca..."
- Timeout após 2 minutos
- Nenhum artigo aparece

**Troubleshooting:**
- SSE pode ser bloqueado por proxy/firewall
- Verifique Network → EventStream

---

#### **FASE 5: Article Analysis**

**O que esperar:**
1. ✅ Grafo de conhecimento interativo
2. ✅ Nós clicáveis com temas principais
3. ✅ Contador de artigos por tema
4. ✅ Painéis expansíveis ao clicar

**Teste:**
1. Clique em diferentes nós do grafo
2. Veja artigos relacionados àquele tema
3. Clique em **"Prosseguir para Geração"**

**✅ SUCESSO:** Grafo renderiza e é interativo

---

#### **FASE 6: Content Generation** 🔥 DESCONTA CRÉDITOS

**⚠️ IMPORTANTE:** Esta fase **CONSOME CRÉDITOS**!

**O que esperar:**
1. ✅ Seletor de templates (6 opções):
   - TCC, Artigo Científico, Dissertação, etc.
2. ✅ Estimativa de palavras e tempo
3. ✅ Painel de configuração:
   - Modo: Documento Completo ou Seção Específica
   - Estilo: Acadêmico Formal, Técnico, Acessível
   - Perspectiva: 1ª pessoa plural, 3ª pessoa
   - Densidade de citações: Baixa, Média, Alta
4. ✅ Botão "Gerar Conteúdo"
5. ✅ **Indicador de Auto-save** (canto superior direito)

**Antes de gerar:**
1. **Anote seus créditos atuais:**
   - Clique no menu de perfil
   - Veja valor de "Créditos" (ex: 50.000)

**Teste de Geração:**
1. Selecione um template (ex: "Artigo Científico")
2. Configure opções ou use padrão
3. Clique em **"Gerar Conteúdo"**
4. Observe:
   - ✅ Conteúdo aparecendo em tempo real (streaming)
   - ✅ Indicador de auto-save mudando estado
   - ✅ Contador de palavras aumentando

**Console deve mostrar:**
```
🔍 Verificando créditos antes de gerar...
✅ Créditos disponíveis: 50000
SSE: Gerando conteúdo...
SSE: Chunk recebido (500 chars)
...
✅ Geração completa (8523 palavras)
🔥 Descontando créditos: 1 documento gerado
```

**Após Geração Completa:**
1. **Verifique seus créditos novamente:**
   - Clique no menu de perfil
   - Créditos devem ter diminuído
   - Ex: Se tinha 50.000 → Agora tem 49.999 (ou menos, dependendo do plano)

2. **Verifique auto-save:**
   - Indicador deve mostrar "✓ Salvo há Xs"
   - Faça uma pequena edição no texto
   - Indicador muda para "● Alterações não salvas"
   - Após 30s, volta para "✓ Salvo há 0s"

**✅ SUCESSO se:**
- Conteúdo é gerado em tempo real
- Créditos são descontados corretamente
- Auto-save funciona
- Pode clicar em "Editar" para ir para Fase 7

**❌ ERRO se:**
- Mostra "Limite de documentos atingido" (sem créditos)
- Streaming trava ou não completa
- Créditos não são descontados
- Auto-save não funciona

**Troubleshooting Créditos:**
```bash
# Verificar créditos via API
curl -H "Authorization: Bearer $TOKEN" \
  https://resea-backend.onrender.com/api/user/credits
```

---

#### **FASE 7: Interactive Editing** ✍️

**O que esperar:**
1. ✅ Editor rico TipTap com toolbar:
   - Bold, Italic, Strikethrough
   - Headings (H1, H2, H3, H4)
   - Lists (bullet, numbered)
   - Blockquotes, Code blocks
   - Undo/Redo
2. ✅ Sidebar com artigos **arrastáveis**
3. ✅ Indicador de auto-save
4. ✅ Contador de palavras e caracteres (rodapé)

**Teste de Formatação:**
1. Selecione texto e clique em **Bold**
2. Crie um título com **H1**
3. Adicione uma lista numerada
4. Insira uma citação em bloco (blockquote)
5. Use Undo/Redo

**Teste de Drag & Drop de Citações:** ⭐
1. Na sidebar direita, veja lista de artigos
2. **Arraste** um artigo da sidebar
3. **Solte** no meio do texto do editor
4. Deve inserir citação formatada: `(Autor et al., 2024)`

**O que observar:**
- ✅ Quando arrasta, aparece indicador "📎 Solte aqui para inserir a citação"
- ✅ Borda do editor fica destacada (azul/indigo)
- ✅ Citação é inserida exatamente onde você soltou
- ✅ Formato correto: `(Smith et al., 2023)` ou `(Silva, 2024)`

**Teste de Auto-save:**
1. Faça edição no texto
2. Veja indicador mudar para "● Alterações não salvas"
3. Espere 30 segundos
4. Indicador muda para "⏳ Salvando..."
5. Depois "✓ Salvo há 0s"
6. Ou clique em "Salvar agora" para save manual

**✅ SUCESSO se:**
- Todas as ferramentas de formatação funcionam
- Drag & drop insere citações corretamente
- Auto-save funciona
- Contador de palavras atualiza

**❌ ERRO se:**
- Toolbar não responde
- Drag & drop não funciona
- Citações não são inseridas
- Auto-save não salva

---

#### **FASE 8: Export & Citation**

**O que esperar:**
1. ✅ **Estatísticas Finais Completas:**
   - 📊 Total de palavras
   - 📚 Número de citações
   - 📑 Número de seções
   - 👥 Autores únicos citados
   - 📅 Citações mais antigas (ex: 2018)
   - 📅 Citações mais recentes (ex: 2024)

2. ✅ Botão "Auto-fix" (corrige formatação automaticamente)

3. ✅ Configurações de Exportação:
   - Formato: DOCX, PDF, HTML, TXT
   - Estilo de Citação: ABNT, APA, Chicago, Vancouver

4. ✅ Botão "Exportar Documento"

**Teste:**
1. Revise as estatísticas (devem refletir o documento atual)
2. Clique em **"Auto-fix"** se necessário
3. Selecione formato de exportação (ex: DOCX)
4. Selecione estilo de citação (ex: ABNT)
5. Clique em **"Exportar Documento"**

**✅ SUCESSO se:**
- Estatísticas estão corretas
- Exportação completa sem erros
- Arquivo é baixado corretamente
- Documento aparece no histórico (sidebar)

---

## 📊 Checklist de Verificação

### Sistema de Créditos
- [ ] Créditos aparecem no menu de perfil
- [ ] Valor correto é exibido
- [ ] Fonte é "resea-local" (console)
- [ ] Créditos são descontados após gerar documento completo
- [ ] Valor atualiza no menu após desconto
- [ ] Bloqueio funciona quando créditos insuficientes

### Fluxo das 8 Fases
- [ ] **Fase 1:** Query aceita e navega para Fase 2
- [ ] **Fase 2:** Perguntas aparecem e respostas são processadas
- [ ] **Fase 3:** Estratégia é gerada e exibida
- [ ] **Fase 4:** Busca com SSE funciona, artigos aparecem
- [ ] **Fase 5:** Grafo interativo renderiza e é clicável
- [ ] **Fase 6:** Template, geração e auto-save funcionam
- [ ] **Fase 7:** Editor TipTap, drag & drop e auto-save funcionam
- [ ] **Fase 8:** Estatísticas corretas, exportação funciona

### Funcionalidades Avançadas
- [ ] Auto-save (Fases 6 e 7) salva a cada 30s
- [ ] Auto-save indicator atualiza corretamente
- [ ] Toast notifications aparecem quando necessário
- [ ] Drag & drop insere citações no editor
- [ ] Editor TipTap formata texto corretamente
- [ ] Templates aplicam configurações corretas
- [ ] Estatísticas calculam valores corretos

---

## 🐛 Problemas Comuns e Soluções

### 1. "Sua sessão expirou"
**Causa:** Token de autenticação inválido/expirado
**Solução:**
- Faça login novamente
- Verifique se o token é válido
- Limpe cache do browser (Ctrl+Shift+Delete)

### 2. Página em Branco
**Causa:** Fase 'onboarding' não renderizada ou erro de React
**Solução:**
- Abra DevTools → Console
- Veja se há erros JavaScript
- Recarregue a página (Ctrl+R)
- Limpe localStorage e faça login novamente

### 3. Créditos Aparecem como "0"
**Causa:** Endpoint `/api/user/credits` falhou
**Solução:**
- Verifique console: deve mostrar tentativa de buscar créditos
- Se falhou, pode estar usando fallback SmileAI
- Verifique se usuário tem plano ativo no SmileAI

### 4. Busca (Fase 4) Trava
**Causa:** Timeout de SSE ou erro no backend
**Solução:**
- Aguarde 2 minutos (timeout padrão)
- Verifique Network → EventStream
- Se erro 502/503 → backend está reiniciando
- Tente novamente após 1 minuto

### 5. Drag & Drop Não Funciona
**Causa:** Evento de drag não está sendo capturado
**Solução:**
- Verifique se artigos têm atributo `draggable`
- Tente arrastar bem devagar
- Solte dentro da área do editor (não na toolbar)

### 6. Créditos Não Descontam
**Causa:** Geração de seção única (não desconta) vs documento completo
**Solução:**
- Certifique-se de gerar **"Documento Completo"**, não "Seção Específica"
- Verifique console: deve mostrar "🔥 Descontando créditos"
- Se não desconta, pode ser que a geração tenha falhado

---

## 📞 Reportar Problemas

Se encontrar bugs ou comportamentos inesperados:

1. **Capture Informações:**
   - Screenshot da tela
   - Console do DevTools (F12 → Console)
   - Network tab (F12 → Network)
   - Descrição do que estava fazendo

2. **Verifique Logs:**
   ```bash
   # Backend logs (Render)
   # Acesse: https://dashboard.render.com
   # Veja logs em tempo real
   ```

3. **Teste Endpoints Manualmente:**
   ```bash
   export TOKEN='seu_token'
   ./scripts/test-endpoints.sh
   ```

4. **Documente:**
   - Qual fase estava testando
   - Passos para reproduzir
   - Comportamento esperado vs atual

---

## ✅ Critérios de Sucesso

O sistema está **100% funcional** se:

✅ Todos os endpoints retornam 200 (com token válido)
✅ Todas as 8 fases funcionam sequencialmente
✅ Créditos são exibidos corretamente
✅ Créditos são descontados ao gerar documento completo
✅ Auto-save funciona em Fases 6 e 7
✅ Drag & drop de citações funciona
✅ Editor TipTap formata corretamente
✅ Exportação gera arquivo válido
✅ Nenhum erro no console (exceto warnings)

---

**Boa sorte com os testes! 🚀**
