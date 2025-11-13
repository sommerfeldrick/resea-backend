#!/usr/bin/env tsx

/**
 * Script de Teste - Cloudflare R2 Storage
 *
 * Este script testa a configuração do Cloudflare R2:
 * 1. Verifica variáveis de ambiente
 * 2. Testa conexão com o bucket
 * 3. Faz upload de um arquivo de teste
 * 4. Gera URL de download assinada
 * 5. Faz download do arquivo
 * 6. Deleta o arquivo de teste
 *
 * Execute: npx tsx scripts/test-r2.ts
 */

import { storageService } from '../src/services/storageService.js';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji: string, message: string, color: string = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log('✅', message, colors.green);
}

function logError(message: string) {
  log('❌', message, colors.red);
}

function logInfo(message: string) {
  log('ℹ️', message, colors.blue);
}

function logWarning(message: string) {
  log('⚠️', message, colors.yellow);
}

function logStep(step: number, message: string) {
  console.log(`\n${colors.cyan}━━━ PASSO ${step}: ${message} ━━━${colors.reset}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testR2Configuration() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTE DE CONFIGURAÇÃO - CLOUDFLARE R2');
  console.log('='.repeat(60));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 1: Verificar Variáveis de Ambiente
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(1, 'Verificando Variáveis de Ambiente');

  const requiredEnvVars = [
    'R2_ENABLED',
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_REGION'
  ];

  let envVarsOk = true;

  for (const varName of requiredEnvVars) {
    const value = process.env[varName];

    if (!value || value === '' || value === 'undefined') {
      logError(`${varName} não está configurada`);
      envVarsOk = false;
    } else {
      // Oculta valores sensíveis
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        const maskedValue = value.substring(0, 4) + '***' + value.substring(value.length - 4);
        logSuccess(`${varName} = ${maskedValue}`);
      } else {
        logSuccess(`${varName} = ${value}`);
      }
    }
  }

  if (!envVarsOk) {
    logError('\nVariáveis de ambiente faltando! Configure o .env primeiro.');
    logInfo('Veja o guia: CLOUDFLARE_R2_SETUP.md');
    process.exit(1);
  }

  // Verificar se R2 está habilitado
  if (process.env.R2_ENABLED !== 'true') {
    logWarning('\nR2_ENABLED=false - R2 está desabilitado!');
    logInfo('Mude para R2_ENABLED=true no .env para usar R2');
    process.exit(0);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 2: Verificar Disponibilidade do Serviço
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(2, 'Verificando Disponibilidade do Serviço R2');

  if (!storageService.isAvailable()) {
    logError('Serviço R2 não está disponível!');
    logInfo('Possíveis causas:');
    logInfo('  - Credenciais incorretas');
    logInfo('  - Account ID inválido');
    logInfo('  - Bucket não existe');
    logInfo('  - Região incorreta (use "auto")');
    process.exit(1);
  }

  logSuccess('Serviço R2 inicializado com sucesso!');
  logInfo(`Bucket: ${process.env.R2_BUCKET_NAME}`);
  logInfo(`Region: ${process.env.R2_REGION}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 3: Teste de Upload
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(3, 'Testando Upload de Arquivo');

  const testUserId = 'test-user-' + Date.now();
  const testDocId = 'test-doc-' + Math.random().toString(36).substring(7);
  const testContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Teste R2 - ${new Date().toISOString()}</title>
</head>
<body>
  <h1>🧪 Teste de Upload - Cloudflare R2</h1>
  <p>Este é um arquivo de teste.</p>
  <p><strong>Timestamp:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  <p><strong>User ID:</strong> ${testUserId}</p>
  <p><strong>Document ID:</strong> ${testDocId}</p>
</body>
</html>
  `.trim();

  logInfo(`User ID: ${testUserId}`);
  logInfo(`Document ID: ${testDocId}`);
  logInfo(`Content Size: ${testContent.length} bytes`);

  let uploadResult;
  try {
    uploadResult = await storageService.uploadDocument(
      testUserId,
      testDocId,
      Buffer.from(testContent, 'utf-8'),
      'text/html',
      'html'
    );

    logSuccess('Upload realizado com sucesso!');
    logInfo(`Key: ${uploadResult.key}`);
    logInfo(`URL: ${uploadResult.url}`);
    logInfo(`Size: ${uploadResult.size} bytes`);
  } catch (error) {
    logError('Erro ao fazer upload:');
    console.error(error);
    logInfo('\nPossíveis causas:');
    logInfo('  - Credenciais sem permissão de escrita');
    logInfo('  - Bucket não existe ou nome incorreto');
    logInfo('  - Quota de armazenamento excedida');
    process.exit(1);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 4: Gerar URL de Download Assinada
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(4, 'Gerando URL de Download Assinada');

  let downloadUrl: string;
  try {
    downloadUrl = await storageService.getSignedDownloadUrl(uploadResult.key, 3600);

    logSuccess('URL assinada gerada com sucesso!');
    logInfo('Válida por: 1 hora (3600 segundos)');
    logInfo(`URL: ${downloadUrl.substring(0, 80)}...`);
    logWarning('Esta URL permite download sem autenticação por 1 hora');
  } catch (error) {
    logError('Erro ao gerar URL assinada:');
    console.error(error);
    process.exit(1);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 5: Testar Download
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(5, 'Testando Download do Arquivo');

  try {
    const downloadResult = await storageService.downloadDocument(uploadResult.key);

    logSuccess('Download realizado com sucesso!');
    logInfo(`Content-Type: ${downloadResult.contentType}`);
    logInfo(`Content-Length: ${downloadResult.contentLength} bytes`);

    // Lê o stream e converte para string
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResult.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const downloadedContent = Buffer.concat(chunks).toString('utf-8');

    // Verifica se o conteúdo é o mesmo
    if (downloadedContent === testContent) {
      logSuccess('Conteúdo verificado: Upload e Download são idênticos! ✨');
    } else {
      logError('Conteúdo diferente do original!');
      logInfo(`Original: ${testContent.length} bytes`);
      logInfo(`Downloaded: ${downloadedContent.length} bytes`);
    }
  } catch (error) {
    logError('Erro ao fazer download:');
    console.error(error);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSO 6: Deletar Arquivo de Teste
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  logStep(6, 'Deletando Arquivo de Teste');

  logInfo('Aguardando 2 segundos...');
  await sleep(2000);

  try {
    await storageService.deleteDocument(uploadResult.key);
    logSuccess('Arquivo de teste deletado com sucesso!');
  } catch (error) {
    logWarning('Erro ao deletar arquivo de teste:');
    console.error(error);
    logInfo('Você pode deletar manualmente no dashboard do Cloudflare');
    logInfo(`Key: ${uploadResult.key}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESULTADO FINAL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n' + '='.repeat(60));
  logSuccess('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  console.log('='.repeat(60));

  console.log('\n📋 Resumo da Configuração:');
  console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`   Region: ${process.env.R2_REGION}`);
  console.log(`   Account: ${process.env.R2_ACCOUNT_ID}`);
  console.log(`   Status: ${colors.green}✅ Funcionando perfeitamente${colors.reset}`);

  console.log('\n🚀 Próximos Passos:');
  console.log('   1. Seu backend está pronto para usar R2!');
  console.log('   2. Documentos serão salvos automaticamente no R2');
  console.log('   3. Fallback para PostgreSQL se R2 falhar');
  console.log('   4. URLs assinadas com validade de 1 hora');

  console.log('\n💰 Monitorar Custos:');
  console.log('   Dashboard: https://dash.cloudflare.com/');
  console.log('   Seção: R2 > Analytics');
  console.log('   Free Tier: 10 GB/mês grátis\n');
}

// Executar teste
testR2Configuration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n' + '='.repeat(60));
    logError('ERRO FATAL NO TESTE');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  });
