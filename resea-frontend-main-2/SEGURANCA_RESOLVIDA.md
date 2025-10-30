# Segurança Resolvida - Próximos Passos

## ✅ O que já foi feito:

1. **Frontend (resea-frontend):**
   - ✅ Atualizado .gitignore para proteger arquivos .env
   - ✅ Removido .env.production do controle de versão
   - ✅ Push realizado para GitHub

2. **Backend (resea-backend):**
   - ✅ Atualizado .gitignore para proteger todos .env.*
   - ✅ Removido .env.production do controle de versão
   - ✅ Push realizado para GitHub

---

## 🔴 URGENTE - Faça AGORA:

### 1. Revogar a chave antiga do Groq

1. Acesse: https://console.groq.com/keys
2. Encontre a chave: `gsk_****qgvV`
3. Clique em **"Delete"** ou **"Revoke"**
4. Confirme a revogação

### 2. Criar nova API key do Groq

1. Na mesma página (https://console.groq.com/keys)
2. Clique em **"Create API Key"**
3. Dê um nome: `resea-backend-production`
4. **COPIE A CHAVE** (você só verá ela uma vez!)
5. Anote em lugar seguro (gerenciador de senhas)

### 3. Configurar no Render

1. Acesse: https://dashboard.render.com/
2. Encontre seu serviço **"resea-backend"** (ou nome que você deu)
3. Vá na aba **"Environment"**
4. Encontre a variável `GROQ_API_KEY`
5. Clique em **"Edit"**
6. Cole a nova chave que você acabou de criar
7. Clique em **"Save Changes"**
8. O Render vai fazer redeploy automaticamente

---

## 🌐 DNS do Render para Cloudflare

Você estava certo! Como o backend está no Render, você precisa apontar para lá.

### Passos:

1. **Obter URL do Render:**
   - No dashboard do Render, abra seu serviço backend
   - Copie a URL (algo como: `resea-backend-xxxx.onrender.com`)
   - Ou algo como: `your-service-name.onrender.com`

2. **Configurar no Cloudflare:**
   - Vá em: https://dash.cloudflare.com/
   - Selecione: `smileai.com.br`
   - Vá na aba **"DNS"** > **"Records"**

3. **Editar o registro `api`:**
   - Encontre o registro que aponta para `162.240.105.34`
   - Clique em **"Edit"**
   - Mude de:
     ```
     Type: A
     Name: api
     Content: 162.240.105.34
     ```
   - Para:
     ```
     Type: CNAME
     Name: api
     Content: resea-backend-xxxx.onrender.com  (sua URL do Render)
     Proxy status: DNS only (ícone CINZA, não laranja)
     ```
   - Clique em **"Save"**

4. **Aguarde a propagação:**
   - Pode levar de 5 minutos a 1 hora
   - Teste depois com: `curl https://api.smileai.com.br/health`

---

## 🔒 Verificar se está seguro:

Depois de fazer tudo acima, verifique:

```bash
# No terminal do seu computador:
cd /Users/usuario/Downloads/resea-ai-research-assistant

# Verificar frontend
git log --oneline --all -- "*env*"

# Verificar backend
cd backend
git log --oneline --all -- "*env*"
```

Se aparecer apenas o commit de "Security: Protect environment variables", está tudo certo!

---

## 📝 Checklist Final:

- [ ] Revogada chave antiga no Groq (`gsk_****qgvV`)
- [ ] Criada nova chave no Groq
- [ ] Nova chave configurada no Render
- [ ] DNS do Cloudflare apontando para Render
- [ ] Testado a API com `curl https://api.smileai.com.br/health`

---

## ⚠️ IMPORTANTE - Para o futuro:

**NUNCA commite arquivos .env no git!**

- Sempre use variáveis de ambiente na plataforma de hospedagem
- Sempre tenha .env no .gitignore
- Use arquivos .env.example com valores de exemplo (sem chaves reais)

Se precisar compartilhar chaves com alguém, use:
- Gerenciador de senhas (1Password, Bitwarden, etc)
- Vault (HashiCorp Vault)
- Secrets do GitHub (para CI/CD)

---

Tem alguma dúvida sobre os passos acima?
