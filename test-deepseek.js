/**
 * Script de teste para verificar se DeepSeek API está funcionando
 *
 * Como usar:
 * 1. npm install openai (se ainda não instalou)
 * 2. node test-deepseek.js
 */

import OpenAI from 'openai';

// Substitua pela sua API key real ou use .env
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sua-api-key-aqui';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

async function testDeepSeek() {
  console.log('🧪 Testando DeepSeek API...\n');
  console.log(`API Key: ${DEEPSEEK_API_KEY.substring(0, 10)}...`);
  console.log(`Modelo: ${DEEPSEEK_MODEL}\n`);

  const client = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
    timeout: 60000
  });

  try {
    console.log('📤 Enviando requisição...');
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: 'Você é um assistente útil.' },
        { role: 'user', content: 'Responda apenas com "OK" se você está funcionando.' }
      ],
      temperature: 0.7,
      max_tokens: 50
    });

    const latency = Date.now() - startTime;
    const text = response.choices[0]?.message?.content || '';

    console.log('✅ SUCESSO!\n');
    console.log(`⏱️  Latência: ${latency}ms`);
    console.log(`📝 Resposta: "${text}"`);
    console.log(`🔢 Tokens: ${response.usage?.total_tokens || 0}`);
    console.log(`💰 Custo estimado: $${((response.usage?.total_tokens || 0) / 1_000_000 * 0.28).toFixed(6)}`);

    console.log('\n✅ DeepSeek está funcionando corretamente!');
    console.log(`✅ Modelo ${DEEPSEEK_MODEL} OK`);

  } catch (error) {
    console.error('\n❌ ERRO ao testar DeepSeek:\n');

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mensagem: ${error.response.statusText}`);
      console.error(`Dados:`, error.response.data);

      if (error.response.status === 400) {
        console.error('\n⚠️  Erro 400 - Possíveis causas:');
        console.error('1. Modelo inválido (verifique se é "deepseek-chat" ou "deepseek-reasoner")');
        console.error('2. Formato da requisição incorreto');
        console.error('3. Parâmetros inválidos');
      } else if (error.response.status === 401) {
        console.error('\n⚠️  Erro 401 - API Key inválida ou expirada');
        console.error('Gere nova chave em: https://platform.deepseek.com');
      } else if (error.response.status === 429) {
        console.error('\n⚠️  Erro 429 - Limite de requisições atingido');
        console.error('Aguarde alguns minutos ou verifique seu plano');
      }
    } else {
      console.error('Erro:', error.message);
    }

    process.exit(1);
  }
}

testDeepSeek();
