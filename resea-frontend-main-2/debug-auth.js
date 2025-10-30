/**
 * Script de Debug para Autenticação SmileAI
 *
 * Cole este script no console do navegador (F12) em https://app.smileai.com.br
 * e execute: debugAuth("seu-email@example.com", "sua-senha")
 */

async function debugAuth(email, password) {
  console.log("🔍 Iniciando debug de autenticação...\n");

  const API_BASE_URL = 'https://resea-backend.onrender.com';
  const SMILEAI_BASE_URL = 'https://smileai.com.br';

  // Teste 1: Verificar se o backend está online
  console.log("📡 Teste 1: Verificando backend Resea...");
  try {
    const healthCheck = await fetch(`${API_BASE_URL}/`);
    const healthData = await healthCheck.json();
    console.log("✅ Backend respondendo:", healthData);
  } catch (error) {
    console.error("❌ Backend não está respondendo:", error);
    return;
  }

  // Teste 2: Testar login no backend Resea (que chama SmileAI)
  console.log("\n📡 Teste 2: Tentando login via backend Resea...");
  try {
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    console.log("Status da resposta:", loginResponse.status, loginResponse.statusText);
    console.log("Headers da resposta:", Object.fromEntries(loginResponse.headers.entries()));

    const responseText = await loginResponse.text();
    console.log("Resposta raw:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log("Resposta parseada:", responseData);
    } catch (e) {
      console.error("❌ Resposta não é JSON válido");
      return;
    }

    if (loginResponse.ok && responseData.success) {
      console.log("✅ Login bem-sucedido!");
      console.log("👤 Usuário:", responseData.data.user);
      console.log("🔑 Token:", {
        access_token: responseData.data.token.access_token.substring(0, 50) + "...",
        token_type: responseData.data.token.token_type,
        expires_in: responseData.data.token.expires_in
      });

      // Teste 3: Validar o token obtido
      console.log("\n📡 Teste 3: Validando token...");
      const validateResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${responseData.data.token.access_token}`,
          'Accept': 'application/json'
        }
      });

      const validateData = await validateResponse.json();
      console.log("Status validação:", validateResponse.status);
      console.log("Dados do usuário:", validateData);

      if (validateResponse.ok) {
        console.log("\n✅ ✅ ✅ AUTENTICAÇÃO FUNCIONANDO PERFEITAMENTE! ✅ ✅ ✅");
      } else {
        console.log("\n⚠️ Token obtido mas validação falhou");
      }

    } else {
      console.error("❌ Login falhou");
      console.error("Erro:", responseData.error || "Erro desconhecido");
    }

  } catch (error) {
    console.error("❌ Erro durante login:", error);
  }

  // Teste 4: Testar diretamente o SmileAI OAuth (para comparação)
  console.log("\n📡 Teste 4: Tentando OAuth direto no SmileAI...");
  try {
    const directOAuthResponse = await fetch(`${SMILEAI_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: 2,
        client_secret: '2Moof1U6aYC1radoWP4ZozfMxPmy7Kufoyj2c7E8',
        username: email,
        password: password,
        scope: ''
      })
    });

    console.log("Status OAuth direto:", directOAuthResponse.status);

    const directText = await directOAuthResponse.text();
    console.log("Resposta OAuth direto (primeiros 500 chars):", directText.substring(0, 500));

    if (directText.includes('<!DOCTYPE html>')) {
      console.log("⚠️ SmileAI retornou HTML (provavelmente Cloudflare challenge)");
      console.log("Isso é normal - o backend Resea deve fazer essa requisição do lado do servidor");
    } else {
      try {
        const directData = JSON.parse(directText);
        console.log("✅ OAuth direto funcionou:", directData);
      } catch (e) {
        console.log("❌ Resposta OAuth não é JSON válido");
      }
    }

  } catch (error) {
    console.error("❌ Erro ao testar OAuth direto:", error);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DO DEBUG");
  console.log("=".repeat(60));
  console.log("Execute este script e compartilhe TODO o output acima");
  console.log("para identificar exatamente onde está o problema.");
}

// Instruções
console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔍 SCRIPT DE DEBUG - AUTENTICAÇÃO SMILEAI                ║
╚════════════════════════════════════════════════════════════╝

Para usar este script:

1. Abra o console do navegador (F12 ou Cmd+Option+J)
2. Cole TODO o código deste arquivo
3. Execute o comando:

   debugAuth("seu-email@example.com", "sua-senha")

4. Aguarde os testes completarem
5. Copie TODO o output e compartilhe

Exemplo:
   debugAuth("usuario@smileai.com.br", "minhasenha123")

⚠️  IMPORTANTE: Use credenciais REAIS do SmileAI para testar
`);
