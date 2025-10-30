# Checklist de Testes Manuais

## 1. Interface e Navegação
- [ ] O carregamento inicial do dashboard leva menos de 3 segundos
- [ ] O painel de usuário está corretamente integrado no header
- [ ] O botão voltar funciona em todas as páginas
- [ ] O toggle de tema claro/escuro funciona
- [ ] O menu de usuário abre e fecha corretamente

## 2. Autenticação e Perfil
- [ ] Login funciona corretamente
- [ ] Dados do usuário são carregados e exibidos
- [ ] O plano correto é exibido (não a função)
- [ ] Logout funciona e limpa os dados locais

## 3. Sistema de Créditos
- [ ] Créditos são exibidos corretamente (máximo 88.600)
- [ ] Porcentagem de uso é calculada corretamente
- [ ] Créditos ilimitados são tratados corretamente
- [ ] Créditos são atualizados automaticamente após uso

## 4. Limites de Pesquisa
- [ ] Plano Básico: limite de 5 pesquisas
- [ ] Plano Standard: limite de 10 pesquisas
- [ ] Plano Premium: limite de 20 pesquisas
- [ ] Mensagem clara quando limite é atingido
- [ ] Contador reseta no início do mês

## 5. Performance
- [ ] Cache funciona (segunda requisição mais rápida)
- [ ] Não há duplicação de requisições
- [ ] Loading states são exibidos adequadamente
- [ ] Transições são suaves

## 6. Sincronização
- [ ] Créditos são sincronizados entre domínios
- [ ] Falhas de rede são tratadas corretamente
- [ ] Retry automático funciona
- [ ] Fila de operações pendentes persiste

## 7. Casos de Erro
- [ ] Erro de rede mostra mensagem adequada
- [ ] Erro de autenticação redireciona para login
- [ ] Erro de créditos insuficientes é claro
- [ ] Retry automático não causa duplicação

## 8. Segurança
- [ ] Tokens são armazenados seguramente
- [ ] Sessão expira corretamente
- [ ] CSRF tokens estão presentes
- [ ] Headers de segurança estão corretos

## Observações
- 📝 Anotar qualquer comportamento inesperado
- 🐛 Documentar bugs encontrados
- 💡 Registrar sugestões de melhorias

## Aprovação
- [ ] Todos os testes passaram
- [ ] Não há bugs críticos
- [ ] Performance está aceitável
- [ ] Segurança está adequada

Data: ___/___/___
Testador: ____________
Aprovado: Sim ⬜ Não ⬜
