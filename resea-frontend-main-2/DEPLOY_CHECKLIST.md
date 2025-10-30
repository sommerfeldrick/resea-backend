# ✅ Checklist de Deploy - Resea AI @ app.smileai.com.br

Use este checklist para acompanhar o progresso do deploy passo a passo.

---

## 📋 PRÉ-DEPLOY

### Preparação
- [ ] Acesso SSH ao VPS Hostinger
- [ ] Chave API do Gemini em mãos
- [ ] Documentação da API de smileai.com.br disponível
- [ ] Subdomínio app.smileai.com.br criado no painel Hostinger
- [ ] DNS propagado (testar com `nslookup app.smileai.com.br`)

---

## 🖥️ CONFIGURAÇÃO DO SERVIDOR

### Sistema Base
- [ ] Conectado via SSH: `ssh root@seu-vps-ip`
- [ ] Sistema atualizado: `apt update && apt upgrade -y`
- [ ] Node.js 20.x instalado
- [ ] Nginx instalado
- [ ] PM2 instalado globalmente
- [ ] Git instalado
- [ ] Certbot instalado

### Verificação
```bash
node --version   # deve ser v20.x
npm --version    # deve ser v10.x
nginx -v         # deve estar instalado
pm2 --version    # deve estar instalado
```

---

## 📁 ESTRUTURA DE DIRETÓRIOS

- [ ] Diretório criado: `/var/www/app.smileai.com.br`
- [ ] Subdiretórios criados:
  - [ ] `backend/`
  - [ ] `frontend/`
  - [ ] `scripts/`
  - [ ] `dist/`
- [ ] Diretório de backup: `/var/backups/resea`
- [ ] Permissões corretas: `chown -R $USER:$USER /var/www/app.smileai.com.br`

---

## 📥 UPLOAD DO CÓDIGO

### Opção A: Git
- [ ] Repositório clonado: `git clone <repo> /var/www/app.smileai.com.br`

### Opção B: FTP/SFTP
- [ ] Código do backend enviado para `/var/www/app.smileai.com.br/backend/`
- [ ] Código do frontend enviado para `/var/www/app.smileai.com.br/`
- [ ] Scripts enviados para `/var/www/app.smileai.com.br/scripts/`

---

## ⚙️ CONFIGURAÇÃO DO BACKEND

### Instalação
- [ ] Navegado para: `cd /var/www/app.smileai.com.br/backend`
- [ ] Dependências instaladas: `npm install --production`
- [ ] Build criado: `npm run build`
- [ ] Pasta `dist/` criada com sucesso

### Configuração
- [ ] Arquivo `.env` criado
- [ ] `GEMINI_API_KEY` configurada
- [ ] `MAIN_DOMAIN_API` configurada (https://smileai.com.br/api)
- [ ] `SSO_SECRET` configurada
- [ ] `PORT` definida como 3001
- [ ] `NODE_ENV` definida como production

### Teste Local
```bash
# Teste rápido
node dist/server.js

# Deve mostrar:
# 🚀 Server running on port 3001
```
- [ ] Servidor inicia sem erros
- [ ] Porta 3001 responde: `curl http://localhost:3001/api/health`

---

## 🎨 CONFIGURAÇÃO DO FRONTEND

### Build
- [ ] Navegado para: `cd /var/www/app.smileai.com.br`
- [ ] Arquivo `.env` criado
- [ ] `VITE_API_URL` configurada (https://app.smileai.com.br/api)
- [ ] `VITE_MAIN_DOMAIN` configurada (https://smileai.com.br)
- [ ] `VITE_SSO_ENABLED` definida como true
- [ ] Dependências instaladas: `npm install`
- [ ] Build criado: `npm run build`
- [ ] Arquivos copiados: `cp -r dist/* /var/www/app.smileai.com.br/dist/`

### Verificação
- [ ] Arquivo `index.html` existe em `/var/www/app.smileai.com.br/dist/`
- [ ] Assets copiados (JS, CSS, etc.)

---

## 🌐 CONFIGURAÇÃO DO NGINX

### Arquivo de Configuração
- [ ] Criado: `/etc/nginx/sites-available/app.smileai.com.br`
- [ ] Link simbólico: `ln -s /etc/nginx/sites-available/app.smileai.com.br /etc/nginx/sites-enabled/`
- [ ] Configuração testada: `nginx -t` (deve dizer "syntax is ok")
- [ ] Nginx recarregado: `systemctl reload nginx`

### Teste HTTP (antes do SSL)
```bash
curl -I http://app.smileai.com.br
```
- [ ] Retorna 200 ou 301/302

---

## 🔒 CONFIGURAÇÃO SSL

### Let's Encrypt
- [ ] Certbot executado: `certbot --nginx -d app.smileai.com.br`
- [ ] Email fornecido
- [ ] Termos aceitos
- [ ] Redirecionamento HTTP→HTTPS escolhido
- [ ] Certificado instalado com sucesso

### Verificação
```bash
curl -I https://app.smileai.com.br
```
- [ ] Retorna 200
- [ ] Cadeado verde no navegador
- [ ] Certificado válido (verificar em browser)

### Auto-renovação
- [ ] Teste de renovação: `certbot renew --dry-run`
- [ ] Cron configurado automaticamente

---

## 🔧 CONFIGURAÇÃO PM2

### Ecosystem Config
- [ ] Arquivo criado: `backend/ecosystem.config.js`
- [ ] Configuração de 2 instâncias (cluster mode)
- [ ] Logs configurados

### Inicialização
- [ ] PM2 iniciado: `pm2 start ecosystem.config.js`
- [ ] Aplicação rodando: `pm2 status` (deve mostrar "online")
- [ ] Configuração salva: `pm2 save`
- [ ] Startup script: `pm2 startup` (executar comando gerado)

### Verificação
```bash
pm2 status
pm2 logs resea-backend --lines 50
```
- [ ] Status = "online"
- [ ] Sem erros nos logs
- [ ] 2 instâncias rodando

---

## 🛡️ SEGURANÇA

### Firewall (UFW)
- [ ] UFW instalado
- [ ] Regras configuradas:
  - [ ] Deny incoming (default)
  - [ ] Allow outgoing (default)
  - [ ] Allow SSH
  - [ ] Allow Nginx Full
- [ ] Firewall ativado: `ufw enable`
- [ ] Status verificado: `ufw status`

### Fail2Ban (Opcional)
- [ ] Fail2Ban instalado
- [ ] Configuração criada: `/etc/fail2ban/jail.local`
- [ ] Serviço reiniciado

---

## 📝 SCRIPTS DE MANUTENÇÃO

### Deploy Script
- [ ] Criado: `/var/www/app.smileai.com.br/scripts/deploy.sh`
- [ ] Permissão de execução: `chmod +x deploy.sh`
- [ ] Testado manualmente

### Backup Script
- [ ] Criado: `/var/www/app.smileai.com.br/scripts/backup.sh`
- [ ] Permissão de execução: `chmod +x backup.sh`
- [ ] Testado manualmente
- [ ] Cron agendado: `crontab -e` (backup diário às 3h)

---

## 🔐 INTEGRAÇÃO SSO

### Backend
- [ ] Middleware SSO implementado: `backend/src/middleware/ssoAuth.ts`
- [ ] Rotas protegidas com middleware
- [ ] Variável `MAIN_DOMAIN_API` configurada

### Frontend
- [ ] Serviço SSO implementado: `services/ssoService.ts`
- [ ] Hook useAuth implementado: `hooks/useAuth.ts`
- [ ] Componente ProtectedRoute implementado
- [ ] App.tsx usando ProtectedRoute

### Teste de Integração
- [ ] Login em smileai.com.br
- [ ] Cookie `auth_token` presente (DevTools → Application → Cookies)
- [ ] Acesso a app.smileai.com.br SEM novo login
- [ ] Backend valida token com sucesso (ver logs PM2)

---

## 🧪 TESTES FINAIS

### Backend
```bash
# Health check
curl https://app.smileai.com.br/api/health

# Deve retornar JSON com status: "ok"
```
- [ ] Health check retorna 200
- [ ] JSON válido com métricas

### Frontend
- [ ] Página carrega: https://app.smileai.com.br
- [ ] Interface React renderiza
- [ ] Sem erros no console do navegador
- [ ] Assets carregando (CSS, JS, imagens)

### Fluxo Completo
- [ ] Login em smileai.com.br funciona
- [ ] Acesso a app.smileai.com.br sem novo login
- [ ] Criar nova pesquisa funciona
- [ ] Gerar plano funciona
- [ ] Executar pesquisa funciona
- [ ] Ver artigos científicos funciona
- [ ] Gerar documento funciona
- [ ] Exportar documento funciona
- [ ] Histórico persiste após reload
- [ ] Modo escuro funciona
- [ ] Logout funciona

### Performance
- [ ] Tempo de carregamento < 3s
- [ ] Backend responde < 500ms (health)
- [ ] SSL Grade A (https://www.ssllabs.com/ssltest/)

---

## 📊 MONITORAMENTO

### Logs
- [ ] PM2 logs acessíveis: `pm2 logs resea-backend`
- [ ] Nginx access log: `/var/log/nginx/app.smileai.access.log`
- [ ] Nginx error log: `/var/log/nginx/app.smileai.error.log`
- [ ] Backend logs: `/var/www/app.smileai.com.br/backend/logs/`

### Métricas
- [ ] PM2 monit rodando: `pm2 monit`
- [ ] Uso de CPU < 50%
- [ ] Uso de memória < 500MB por instância
- [ ] Sem restart loops

---

## 📚 DOCUMENTAÇÃO

### Validação
- [ ] README.md atualizado
- [ ] DEPLOYMENT_HOSTINGER.md disponível
- [ ] SSO_INTEGRATION.md disponível
- [ ] IMPLEMENTATION_GUIDE.md disponível
- [ ] QUICKSTART.md disponível
- [ ] IMPROVEMENTS_SUMMARY.md disponível
- [ ] Este checklist completo

---

## 🎉 PÓS-DEPLOY

### Comunicação
- [ ] Time notificado sobre deploy
- [ ] Usuários informados sobre novo app
- [ ] Documentação compartilhada com time

### Monitoramento Contínuo (primeiras 48h)
- [ ] Verificar logs a cada 6h
- [ ] Monitorar uso de recursos
- [ ] Verificar erros de usuários
- [ ] Validar SSL (renovação em ~60 dias)

### Backup
- [ ] Primeiro backup manual executado
- [ ] Backup restaurado e testado
- [ ] Cron de backup verificado

---

## ✅ CONCLUSÃO

**Quando todos os itens acima estiverem marcados:**

🎊 **DEPLOY CONCLUÍDO COM SUCESSO!** 🎊

O aplicativo está rodando em:
**https://app.smileai.com.br**

---

## 🚨 Em Caso de Problemas

### Backend não inicia
```bash
pm2 logs resea-backend --lines 100
# Verificar erro específico
```

### Frontend não carrega
```bash
# Verificar Nginx
nginx -t
systemctl status nginx

# Verificar arquivos
ls -la /var/www/app.smileai.com.br/dist/
```

### SSL não funciona
```bash
certbot certificates
certbot renew --dry-run
```

### SSO não funciona
```bash
# Verificar logs
pm2 logs | grep SSO

# Testar API principal
curl https://smileai.com.br/api/auth/me
```

---

## 📞 Suporte

Consulte:
1. [DEPLOYMENT_HOSTINGER.md](DEPLOYMENT_HOSTINGER.md) - Deploy detalhado
2. [SSO_INTEGRATION.md](SSO_INTEGRATION.md) - Problemas de SSO
3. [TROUBLESHOOTING seção em cada doc]

---

**Data do Deploy:** ___/___/_____
**Responsável:** _________________
**Status Final:** [ ] Sucesso [ ] Pendências

---

*Mantenha este checklist para referência futura e auditorias.*
