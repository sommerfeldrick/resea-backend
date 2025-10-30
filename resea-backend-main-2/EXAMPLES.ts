/**
 * Exemplo Prático: Como usar o novo AI Service
 *
 * Este arquivo mostra 5 exemplos práticos de como usar o sistema
 * multi-provider de IA no seu aplicativo.
 */

import { generateText, getAIServiceHealth, AIStrategyRouter } from './src/services/ai/index.js';

// ============================================================
// EXEMPLO 1: Uso Simples (Recomendado)
// ============================================================

async function exemplo1_UsrSimples() {
  console.log('\n📝 EXEMPLO 1: Uso Simples');
  
  try {
    const response = await generateText(
      'Explique o que é inteligência artificial em 2 linhas'
    );

    console.log('✅ Texto:', response.text);
    console.log('✅ Provider:', response.provider);
    console.log('✅ Custo:', `$${(response.cost || 0).toFixed(6)}`);
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
  }
}

// ============================================================
// EXEMPLO 2: Com Opções Avançadas
// ============================================================

async function exemplo2_ComOpcoes() {
  console.log('\n📝 EXEMPLO 2: Com Opções');
  
  try {
    const response = await generateText(
      'Crie um título criativo para um artigo sobre IA na medicina',
      {
        systemPrompt: 'Você é um editor jornalístico criativo',
        temperature: 0.9,  // Mais criativo
        maxTokens: 100,
      }
    );

    console.log('✅ Título:', response.text);
    console.log('✅ Modelo:', response.model);
    console.log('✅ Tokens:', response.tokensUsed);
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
  }
}

// ============================================================
// EXEMPLO 3: Forçar Provider Específico
// ============================================================

async function exemplo3_ProviderEspecifico() {
  console.log('\n📝 EXEMPLO 3: Provider Específico');
  
  try {
    // Forçar uso de Gemini
    const response = await generateText(
      'Gere um plano de estudo para IA',
      {
        provider: 'gemini',
        temperature: 0.7,
        maxTokens: 500
      }
    );

    console.log('✅ Provedor usado:', response.provider);
    console.log('✅ Resposta:', response.text.substring(0, 200) + '...');
  } catch (error) {
    console.error(
      '❌ Erro (o Gemini pode não estar configurado):',
      error instanceof Error ? error.message : error
    );
  }
}

// ============================================================
// EXEMPLO 4: Monitorar Health Status
// ============================================================

async function exemplo4_HealthCheck() {
  console.log('\n📝 EXEMPLO 4: Health Check');
  
  try {
    const health = await getAIServiceHealth();
    
    console.log('✅ Sistema saudável:', health.healthy);
    console.log('✅ Provedores disponíveis:');
    
    Object.entries(health.providers || {}).forEach(([provider, info]: any) => {
      console.log(`   - ${provider}: ${info.available ? '✓ Online' : '✗ Offline'}`);
    });

    console.log('\n✅ Estatísticas de uso:');
    Object.entries(health.stats || {}).forEach(([provider, stats]: any) => {
      console.log(`   - ${provider}:
      - Requisições: ${stats.requestsToday || 0}
      - Tokens: ${stats.tokensUsedToday || 0}
      - Custo: $${(stats.costToday || 0).toFixed(6)}`);
    });
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
  }
}

// ============================================================
// EXEMPLO 5: Caso de Uso Real - Geração de Conteúdo Acadêmico
// ============================================================

async function exemplo5_CasoReal() {
  console.log('\n📝 EXEMPLO 5: Caso Real - Resumo Acadêmico');
  
  try {
    const tema = 'O impacto da Inteligência Artificial na educação';
    
    const response = await generateText(
      `Crie um resumo executivo (máx 500 palavras) sobre: "${tema}"
      
      O resumo deve:
      1. Apresentar o tema de forma clara
      2. Listar 3 impactos principais
      3. Incluir conclusão com perspectivas futuras
      4. Ser escrito em português acadêmico`,
      
      {
        systemPrompt: `Você é um professor universitário especializado em tecnologia e educação.
        Crie conteúdo academicamente rigoroso mas acessível.`,
        temperature: 0.5,  // Menos criativo, mais factual
        maxTokens: 1000,
      }
    );

    console.log('✅ Resumo Gerado:');
    console.log(response.text);
    console.log(`\n📊 Metadata:`);
    console.log(`   Provider: ${response.provider}`);
    console.log(`   Modelo: ${response.model}`);
    console.log(`   Tokens: ${response.tokensUsed}`);
    console.log(`   Custo: $${(response.cost || 0).toFixed(6)}`);
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
  }
}

// ============================================================
// EXECUTAR EXEMPLOS
// ============================================================

async function executarTodos() {
  console.log('🚀 ========== EXEMPLOS DO AI SERVICE ==========');
  
  // Descomente os que quer testar:
  
  await exemplo1_UsrSimples();
  await exemplo2_ComOpcoes();
  await exemplo3_ProviderEspecifico();
  await exemplo4_HealthCheck();
  await exemplo5_CasoReal();
  
  console.log('\n✅ ========== EXEMPLOS CONCLUÍDOS ==========\n');
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarTodos().catch(console.error);
}

// ============================================================
// INTEGRAÇÃO COM ROTAS EXPRESS
// ============================================================

/*
Se quiser usar em uma rota Express:

import express from 'express';
import { generateText } from './services/ai/index.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { prompt, options } = req.body;
    
    const response = await generateText(prompt, options);
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
*/
