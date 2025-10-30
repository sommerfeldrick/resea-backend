/**
 * Script para ajustar os limites de créditos dos usuários
 */

import { authService } from '../services/authService';
import { creditService } from '../services/creditSync';

const MAX_CREDITS = 88600; // Limite máximo corrigido

async function adjustUserCredits() {
  try {
    // Busca usuário atual
    const user = await authService.getCurrentUser();
    if (!user) {
      console.error('Usuário não encontrado');
      return;
    }

    // Calcula os totais baseado nos créditos das diferentes APIs
    const totalWords = Math.min(
      Object.entries(user.entity_credits || {}).reduce((sum: number, [_, provider]) => {
        if (!provider || typeof provider !== 'object') return sum;
        return sum + Object.values(provider as Record<string, { credit: number; isUnlimited: boolean }>)
          .reduce((total: number, model) => {
            if (model.isUnlimited) return total + MAX_CREDITS;
            return total + (model.credit || 0);
          }, 0);
      }, 0),
      MAX_CREDITS // Aplica o limite máximo
    );

    // Atualiza os créditos no servidor
    await creditService.synchronizeCredits(totalWords);
    
    console.log('Créditos ajustados com sucesso:', {
      antes: user.total_words,
      depois: totalWords
    });

  } catch (error) {
    console.error('Erro ao ajustar créditos:', error);
  }
}

// Executa o ajuste
adjustUserCredits();
