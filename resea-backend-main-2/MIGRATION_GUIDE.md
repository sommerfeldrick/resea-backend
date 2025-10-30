/**
 * Migration Guide: De aiProvider.ts para novo AI Service Multi-Provider
 *
 * Este arquivo mostra como migrar o código existente para usar o novo
 * sistema multi-provider de IA.
 */

// ============================================================
// ANTES (Usando aiProvider.ts antigo)
// ============================================================
/*
import { generateText } from './aiProvider.js';

const response = await generateText(prompt, {
  systemPrompt: 'Você é um assistente',
  temperature: 0.7,
  maxTokens: 2000
});

console.log(response.text);
*/

// ============================================================
// DEPOIS (Usando novo AI Service)
// ============================================================
/*
import { generateText } from './ai/index.js';

const response = await generateText(prompt, {
  systemPrompt: 'Você é um assistente',
  temperature: 0.7,
  maxTokens: 2000
});

console.log(response.text); // Igual!
*/

// ============================================================
// MUDANÇAS NECESSÁRIAS
// ============================================================

/*
1. Adicionar novo import no arquivo que usa generateText:

   ANTES:
   import { generateText } from './aiProvider.js';

   DEPOIS:
   import { generateText } from './ai/index.js';

2. O resto do código permanece EXATAMENTE igual!

3. Agora você tem:
   ✅ Multi-provider automático
   ✅ Fallback inteligente
   ✅ Rate limiting
   ✅ Health checks
   ✅ Tracking de custos
   ✅ Monitoramento de uso

4. Para manter compatibilidade, você pode manter AMBOS os imports
   enquanto migra gradualmente.
*/

export {};
