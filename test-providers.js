/**
 * Script para testar todos os providers configurados
 *
 * Uso: node test-providers.js
 */

import 'dotenv/config';

const providers = {
  deepseek: {
    name: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },
  gemini: {
    name: 'Google Gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  },
  openai: {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};

console.log('🔍 Verificando configuração dos AI Providers...\n');

console.log('📊 Status dos Providers:');
console.log('─'.repeat(70));

for (const [key, config] of Object.entries(providers)) {
  const hasKey = !!config.apiKey;
  const keyPreview = config.apiKey
    ? `${config.apiKey.substring(0, 8)}...`
    : 'NÃO CONFIGURADA';

  const status = hasKey ? '✅ ATIVO' : '❌ INATIVO';

  console.log(`${status} ${config.name}`);
  console.log(`   API Key: ${keyPreview}`);
  console.log(`   Modelo:  ${config.model}`);
  console.log('');
}

console.log('─'.repeat(70));
console.log('\n🔄 Ordem de Fallback:');
console.log('1️⃣  DeepSeek (primary)');
console.log('2️⃣  Gemini (secondary)');
console.log('3️⃣  OpenAI (tertiary)');

console.log('\n⚠️  Problemas Detectados:');

const issues = [];

if (!providers.deepseek.apiKey) {
  issues.push('• DeepSeek: API key não configurada');
}

if (!providers.gemini.apiKey) {
  issues.push('• Gemini: API key não configurada - FALLBACK NÃO FUNCIONARÁ!');
}

if (!providers.openai.apiKey) {
  issues.push('• OpenAI: API key não configurada');
}

if (providers.openai.model && !['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'].includes(providers.openai.model)) {
  issues.push(`• OpenAI: Modelo "${providers.openai.model}" não existe! Use: gpt-4o, gpt-4o-mini, gpt-4-turbo, ou gpt-3.5-turbo`);
}

if (issues.length === 0) {
  console.log('✅ Nenhum problema detectado!');
} else {
  issues.forEach(issue => console.log(issue));
}

console.log('\n💡 Recomendações:');
console.log('• Para ter fallback completo, configure Gemini e OpenAI');
console.log('• DeepSeek: Gratuito (5M tokens/mês)');
console.log('• Gemini: Gratuito (250 req/dia)');
console.log('• OpenAI: Pago (use gpt-4o-mini para economia)');
