# Como Verificar Credenciais OAuth no Terminal HostGator

## Método 1: Via Laravel Artisan (RECOMENDADO)

Conecte no terminal SSH da HostGator e execute:

```bash
# Listar todos os OAuth Clients
php artisan passport:client --list

# Ou via tinker
php artisan tinker
>>> DB::table('oauth_clients')->get();
>>> exit
```

Isso vai mostrar todos os clientes OAuth cadastrados, incluindo:
- Client ID
- Client Secret
- Nome do cliente
- Tipo (password grant, personal access, etc)

---

## Método 2: Direto no Banco de Dados MySQL

```bash
# Conectar no MySQL
mysql -u seu_usuario -p seu_banco_de_dados

# Listar OAuth Clients
SELECT id, name, secret, password_client, personal_access_client
FROM oauth_clients;

# Sair do MySQL
exit;
```

---

## Método 3: Verificar arquivo .env

```bash
# Ver variáveis de ambiente do Laravel
cat .env | grep OAUTH

# Ou procurar por configurações Passport
cat .env | grep PASSPORT
```

---

## O que você está procurando:

### Password Grant Client (o que você precisa!)
```
ID: 2
Name: "Laravel Password Grant Client"
Secret: "2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8"
password_client: 1
personal_access_client: 0
```

### Personal Access Client (não é esse)
```
ID: 1
Name: "Laravel Personal Access Client"
Secret: "Q2NM4Z6f4xt6HzlGhwRroO6eN5byqdjjmJoblJZX"
password_client: 0
personal_access_client: 1
```

---

## Comando mais simples (copie e cole):

```bash
php artisan tinker
DB::table('oauth_clients')->where('password_client', 1)->first();
exit
```

Isso vai retornar o Password Grant Client com ID e Secret corretos.

---

## Se não encontrar ou quiser recriar:

```bash
# Criar novo Password Grant Client
php artisan passport:client --password

# Vai perguntar o nome, pode colocar: "Resea Backend"
```

Isso vai gerar um novo Client ID e Secret que você deve usar no backend Resea.

---

## Depois de descobrir as credenciais:

1. Anote o **Client ID** e **Client Secret**
2. Configure no Render Dashboard:
   - `OAUTH_CLIENT_ID` = (o ID que encontrou)
   - `OAUTH_CLIENT_SECRET` = (o Secret que encontrou)
3. Reinicie o serviço no Render
4. Teste novamente

---

## ⚠️ IMPORTANTE:

Se você RECRIAR as credenciais OAuth, o Client Secret antigo vai parar de funcionar!
Então anote o novo secret e atualize em TODOS os lugares que usa (Render, .env local, etc).
