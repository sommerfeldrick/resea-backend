/**
 * Model Selection Strategy - Modelos GRATUITOS por Provider
 * 
 * Estratégia de seleção:
 * - Sempre usa modelos gratuitos
 * - Rotação automática entre modelos quando um atinge limite
 * - Configurável por use case
 */

export type ModelQuality = 'fast' | 'balanced' | 'quality';

/**
 * Modelos GRATUITOS disponíveis por provider - ARRAYS com fallback
 * Primeira opção é preferida, próximas são fallback
 */
export const freeModels = {
  ollama: {
    quality: [
      'gpt-oss:120b-cloud',           // 120B - Melhor qualidade
      'deepseek-v3.1:671b-cloud',     // 671B - Ultra-poderoso
      'qwen3-coder:480b-cloud'        // 480B - Code specialization
    ],
    balanced: [
      'gpt-oss:120b-cloud',           // 120B - Bom balanço
      'glm-4.6:cloud',                // GLM 4.6 - Speed/quality balance
      'kimi-k2:cloud'                 // Kimi K2 - Alternativa
    ],
    fast: [
      'glm-4.6:cloud',                // GLM 4.6 - Rápido
      'minimax-m2:cloud',             // MiniMax M2 - Ultra-rápido
      'gpt-oss:120b-cloud'            // Fallback
    ]
  },

  groq: {
    quality: [
      'llama-3.1-70b-versatile'       // 70B - Melhor qualidade
    ],
    balanced: [
      'mixtral-8x7b-32768'            // 56B equiv - Balanceado
    ],
    fast: [
      'llama-3.1-8b-instruct'         // 8B - Mais rápido
    ]
  },

  openrouter: {
    quality: [
      'nousresearch/hermes-3-llama-3.1-405b:free',  // 405B - Frontier
      'deepseek/deepseek-chat-v3.1:free',           // Ultra-poderoso
      'meta-llama/llama-3.3-70b-instruct:free',     // 70B alternativa
      'qwen/qwen-2.5-72b-instruct:free'             // 72B alternativa
    ],
    balanced: [
      'meta-llama/llama-3.3-70b-instruct:free',     // 70B
      'qwen/qwen-2.5-72b-instruct:free',            // 72B
      'deepseek/deepseek-r1:free',                  // DeepSeek R1
      'meta-llama/llama-4-maverick:free'            // Llama 4 (multimodal)
    ],
    fast: [
      'meta-llama/llama-3.3-8b-instruct:free',      // 8B rápido
      'qwen/qwen3-coder:free',                      // Qwen3 Coder
      'deepseek/deepseek-r1-0528-qwen3-8b:free',   // DeepSeek R1 8B
      'qwen/qwen3-4b:free'                          // 4B ultra-leve
    ]
  },

  gemini: {
    quality: [
      'google/gemini-2.0-flash-exp:free'            // 2.0 Flash - Melhor
    ],
    balanced: [
      'google/gemini-2.0-flash-exp:free'            // 2.0 Flash
    ],
    fast: [
      'google/gemini-2.0-flash-exp:free'            // Flash é rápido
    ]
  }
};

/**
 * Informações sobre modelos para ajudar na seleção
 */
export const modelInfo = {
  // OLLAMA CLOUD
  'gpt-oss:120b-cloud': {
    provider: 'ollama',
    name: 'GPT-OSS 120B (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'medium',
    quality: 'high',
    freeTokensPerDay: 1000000,
    isCloud: true
  },

  'deepseek-v3.1:671b-cloud': {
    provider: 'ollama',
    name: 'DeepSeek v3.1 671B (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'medium',
    quality: 'very-high',
    freeTokensPerDay: 1000000,
    isCloud: true
  },

  'glm-4.6:cloud': {
    provider: 'ollama',
    name: 'GLM 4.6 (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'fast',
    quality: 'high',
    freeTokensPerDay: 1000000,
    isCloud: true
  },

  'qwen3-coder:480b-cloud': {
    provider: 'ollama',
    name: 'Qwen3 Coder 480B (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'medium',
    quality: 'very-high',
    freeTokensPerDay: 1000000,
    isCloud: true,
    specialized: 'code'
  },

  'kimi-k2:cloud': {
    provider: 'ollama',
    name: 'Kimi K2 (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'medium',
    quality: 'high',
    freeTokensPerDay: 1000000,
    isCloud: true
  },

  'minimax-m2:cloud': {
    provider: 'ollama',
    name: 'MiniMax M2 (Ollama Cloud)',
    contextWindow: 4096,
    speed: 'very-fast',
    quality: 'medium',
    freeTokensPerDay: 1000000,
    isCloud: true
  },

  // GROQ
  'llama-3.1-70b-versatile': {
    provider: 'groq',
    name: 'Llama 3.1 70B',
    contextWindow: 8192,
    speed: 'very-fast', // 276 tokens/sec
    quality: 'high',
    freeTokensPerDay: 100000,
    freeLimitPerMinute: 30
  },

  'mixtral-8x7b-32768': {
    provider: 'groq',
    name: 'Mixtral 8x7B',
    contextWindow: 32768,
    speed: 'very-fast',
    quality: 'high',
    freeTokensPerDay: 100000,
    freeLimitPerMinute: 30
  },

  'llama-3.1-8b-instruct': {
    provider: 'groq',
    name: 'Llama 3.1 8B',
    contextWindow: 8192,
    speed: 'ultra-fast',
    quality: 'medium',
    freeTokensPerDay: 100000,
    freeLimitPerMinute: 30
  },

  // OPENROUTER - QUALITY TIER
  'nousresearch/hermes-3-llama-3.1-405b:free': {
    provider: 'openrouter',
    name: 'Hermes 3 Llama 3.1 405B',
    contextWindow: 8192,
    speed: 'medium',
    quality: 'very-high',
    hasFreeTier: true
  },

  'deepseek/deepseek-chat-v3.1:free': {
    provider: 'openrouter',
    name: 'DeepSeek Chat v3.1',
    contextWindow: 4096,
    speed: 'medium',
    quality: 'very-high',
    hasFreeTier: true
  },

  // OPENROUTER - BALANCED TIER
  'meta-llama/llama-3.3-70b-instruct:free': {
    provider: 'openrouter',
    name: 'Llama 3.3 70B',
    contextWindow: 8192,
    speed: 'medium',
    quality: 'high',
    hasFreeTier: true
  },

  'qwen/qwen-2.5-72b-instruct:free': {
    provider: 'openrouter',
    name: 'Qwen 2.5 72B',
    contextWindow: 8192,
    speed: 'medium',
    quality: 'high',
    hasFreeTier: true
  },

  'deepseek/deepseek-r1:free': {
    provider: 'openrouter',
    name: 'DeepSeek R1 (Reasoning)',
    contextWindow: 8192,
    speed: 'slow',
    quality: 'very-high',
    hasFreeTier: true,
    specialized: 'reasoning'
  },

  'meta-llama/llama-4-maverick:free': {
    provider: 'openrouter',
    name: 'Llama 4 Maverick (Multimodal)',
    contextWindow: 8192,
    speed: 'medium',
    quality: 'high',
    hasFreeTier: true,
    specialized: 'multimodal'
  },

  // OPENROUTER - FAST TIER
  'meta-llama/llama-3.3-8b-instruct:free': {
    provider: 'openrouter',
    name: 'Llama 3.3 8B',
    contextWindow: 8192,
    speed: 'fast',
    quality: 'medium',
    hasFreeTier: true
  },

  'qwen/qwen3-coder:free': {
    provider: 'openrouter',
    name: 'Qwen3 Coder',
    contextWindow: 8192,
    speed: 'fast',
    quality: 'high',
    hasFreeTier: true,
    specialized: 'code'
  },

  'deepseek/deepseek-r1-0528-qwen3-8b:free': {
    provider: 'openrouter',
    name: 'DeepSeek R1 0528 Qwen3 8B',
    contextWindow: 8192,
    speed: 'fast',
    quality: 'high',
    hasFreeTier: true,
    specialized: 'reasoning'
  },

  'qwen/qwen3-4b:free': {
    provider: 'openrouter',
    name: 'Qwen3 4B',
    contextWindow: 8192,
    speed: 'ultra-fast',
    quality: 'medium-low',
    hasFreeTier: true
  },

  'deepseek/deepseek-r1-0528:free': {
    provider: 'openrouter',
    name: 'DeepSeek R1 0528',
    contextWindow: 8192,
    speed: 'slow',
    quality: 'very-high',
    hasFreeTier: true,
    specialized: 'reasoning'
  },

  'mistralai/mistral-small-3.2-24b-instruct:free': {
    provider: 'openrouter',
    name: 'Mistral Small 3.2 24B (Multimodal)',
    contextWindow: 8192,
    speed: 'fast',
    quality: 'medium-high',
    hasFreeTier: true,
    specialized: 'multimodal'
  },

  // GEMINI
  'google/gemini-2.0-flash-exp:free': {
    provider: 'gemini',
    name: 'Gemini 2.0 Flash Experimental',
    contextWindow: 1000000,
    speed: 'medium',
    quality: 'high',
    freeTokensPerDay: 1000000,
    freeLimitPerDay: 250
  }
};

/**
 * Recomendações de modelos por caso de uso
 * Prioridade: Ollama → Groq → OpenRouter → Gemini
 */
export const recommendedModels = {
  // Para geração acadêmica - Qualidade máxima
  academic_writing: {
    primaryProvider: 'ollama',
    providers: ['ollama', 'groq', 'openrouter', 'gemini'],
    quality: 'quality'
  },

  // Para geração rápida - Velocidade
  fast_content: {
    primaryProvider: 'groq',
    providers: ['groq', 'ollama', 'openrouter', 'gemini'],
    quality: 'fast'
  },

  // Para análise de pesquisa - Balanceado
  research_analysis: {
    primaryProvider: 'ollama',
    providers: ['ollama', 'groq', 'openrouter', 'gemini'],
    quality: 'balanced'
  },

  // Para tarefas gerais - Balanceado
  general_purpose: {
    primaryProvider: 'ollama',
    providers: ['ollama', 'groq', 'openrouter', 'gemini'],
    quality: 'balanced'
  }
};

/**
 * Estratégia de ROTAÇÃO de modelos
 * Quando atingir limite, rotaciona para próximo modelo na array
 */
export class ModelRotationStrategy {
  private modelRotations: Map<string, number> = new Map();
  private modelHistory: Array<{ model: string; timestamp: Date; success: boolean }> = [];

  /**
   * Selecionar modelo com base na qualidade desejada
   * Retorna array de modelos em ordem de preferência
   */
  selectModels(provider: string, quality: ModelQuality = 'balanced'): string[] {
    const models = freeModels[provider as keyof typeof freeModels];
    if (!models) throw new Error(`Provider ${provider} not found`);
    
    const modelArray = models[quality];
    return Array.isArray(modelArray) ? modelArray : [modelArray];
  }

  /**
   * Selecionar primeiro modelo (mais preferido)
   */
  selectPrimaryModel(provider: string, quality: ModelQuality = 'balanced'): string {
    const models = this.selectModels(provider, quality);
    return models[0];
  }

  /**
   * Marcar uso de modelo
   */
  markUsage(model: string, success: boolean = true): void {
    this.modelHistory.push({
      model,
      timestamp: new Date(),
      success
    });

    // Manter apenas últimas 1000 requisições
    if (this.modelHistory.length > 1000) {
      this.modelHistory.shift();
    }
  }

  /**
   * Contar falhas de um modelo
   */
  getFailureCount(model: string, timeWindowMinutes: number = 60): number {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60000);
    return this.modelHistory.filter(
      (h) => h.model === model && h.timestamp > cutoff && !h.success
    ).length;
  }

  /**
   * Contar sucessos de um modelo
   */
  getSuccessCount(model: string, timeWindowMinutes: number = 60): number {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60000);
    return this.modelHistory.filter(
      (h) => h.model === model && h.timestamp > cutoff && h.success
    ).length;
  }

  /**
   * Taxa de sucesso do modelo
   */
  getSuccessRate(model: string, timeWindowMinutes: number = 60): number {
    const failures = this.getFailureCount(model, timeWindowMinutes);
    const successes = this.getSuccessCount(model, timeWindowMinutes);
    const total = failures + successes;

    if (total === 0) return 1.0; // Sem dados = 100%
    return successes / total;
  }

  /**
   * Obter próximo modelo na array (com fallback)
   * Tenta usar modelos com melhor taxa de sucesso primeiro
   */
  getNextModel(availableModels: string[]): string {
    if (availableModels.length === 0) {
      throw new Error('Nenhum modelo disponível');
    }

    // Ordenar por taxa de sucesso (melhor primeiro)
    const sorted = availableModels.sort((a, b) => {
      const rateA = this.getSuccessRate(a, 60);
      const rateB = this.getSuccessRate(b, 60);
      return rateB - rateA; // Descendente
    });

    return sorted[0];
  }

  /**
   * Obter histórico de uso
   */
  getHistory(limit: number = 100): Array<{ model: string; timestamp: Date; success: boolean }> {
    return this.modelHistory.slice(-limit);
  }

  /**
   * Rotacionar para próximo modelo se necessário
   */
  rotateIfNeeded(
    currentModel: string,
    alternativeModels: string[]
  ): { model: string; reason?: string } {
    const failureCount = this.getFailureCount(currentModel, 60);
    const successRate = this.getSuccessRate(currentModel, 60);

    // Se > 5 falhas em 1 hora, rotacionar
    if (failureCount > 5) {
      const nextModel = this.getNextModel(alternativeModels);
      return {
        model: nextModel,
        reason: `Modelo ${currentModel} teve ${failureCount} falhas`
      };
    }

    // Se taxa de sucesso < 50%, rotacionar
    if (successRate < 0.5 && this.getSuccessCount(currentModel, 60) > 5) {
      const nextModel = this.getNextModel(alternativeModels);
      return {
        model: nextModel,
        reason: `Taxa de sucesso baixa: ${(successRate * 100).toFixed(0)}%`
      };
    }

    return {
      model: currentModel,
      reason: 'Modelo operacional'
    };
  }

  /**
   * Resetar estatísticas
   */
  reset(): void {
    this.modelRotations.clear();
    this.modelHistory = [];
  }
}

/**
 * Instância global da estratégia de rotação
 */
export const rotationStrategy = new ModelRotationStrategy();
