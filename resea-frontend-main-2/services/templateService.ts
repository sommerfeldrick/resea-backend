/**
 * Serviço de Gerenciamento de Templates
 */

import { authService } from './authService';
import type {
  FavoriteTemplate,
  TemplateUsage,
  CustomTemplate,
  SharedTemplate,
  TemplateRating,
  TemplateAnalytics,
  TemplatePreview
} from '../types/templates';

class TemplateService {
  private readonly STORAGE_KEY_FAVORITES = 'smileai_favorite_templates';
  private readonly STORAGE_KEY_HISTORY = 'smileai_template_history';
  private readonly CACHE_KEY_TEMPLATES = 'smileai_templates_cache';
  private readonly CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutos

  // ===== FAVORITOS =====

  /**
   * Adicionar template aos favoritos
   */
  async addFavorite(templateId: string): Promise<FavoriteTemplate> {
    const favorite: FavoriteTemplate = {
      id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      userId: authService.getUser()?.id.toString() || 'guest',
      addedAt: new Date()
    };

    // Salvar localmente
    const favorites = this.getFavoritesLocal();
    favorites.push(favorite);
    localStorage.setItem(
      this.STORAGE_KEY_FAVORITES,
      JSON.stringify(favorites)
    );

    // Sync com servidor (se autenticado)
    if (authService.isAuthenticated()) {
      try {
        await authService.apiRequest('/api/templates/favorites', {
          method: 'POST',
          body: JSON.stringify({ templateId })
        });
      } catch (error) {
        console.error('Erro ao sincronizar favorito:', error);
      }
    }

    return favorite;
  }

  /**
   * Remover template dos favoritos
   */
  async removeFavorite(templateId: string): Promise<void> {
    // Remover localmente
    const favorites = this.getFavoritesLocal();
    const filtered = favorites.filter((f) => f.templateId !== templateId);
    localStorage.setItem(
      this.STORAGE_KEY_FAVORITES,
      JSON.stringify(filtered)
    );

    // Sync com servidor
    if (authService.isAuthenticated()) {
      try {
        await authService.apiRequest(
          `/api/templates/favorites/${templateId}`,
          {
            method: 'DELETE'
          }
        );
      } catch (error) {
        console.error('Erro ao remover favorito:', error);
      }
    }
  }

  /**
   * Obter favoritos locais
   */
  getFavoritesLocal(): FavoriteTemplate[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Verificar se template é favorito
   */
  isFavorite(templateId: string): boolean {
    const favorites = this.getFavoritesLocal();
    return favorites.some((f) => f.templateId === templateId);
  }

  /**
   * Obter todos os favoritos (com sync do servidor)
   */
  async getFavorites(): Promise<FavoriteTemplate[]> {
    if (authService.isAuthenticated()) {
      try {
        const serverFavorites = await authService.apiRequest<
          FavoriteTemplate[]
        >('/api/templates/favorites');
        // Merge com favoritos locais
        const localFavorites = this.getFavoritesLocal();
        const merged = [...serverFavorites];

        localFavorites.forEach((local) => {
          if (!merged.some((s) => s.templateId === local.templateId)) {
            merged.push(local);
          }
        });

        return merged;
      } catch (error) {
        console.error('Erro ao buscar favoritos:', error);
        return this.getFavoritesLocal();
      }
    }

    return this.getFavoritesLocal();
  }

  // ===== HISTÓRICO =====

  /**
   * Adicionar uso de template ao histórico
   */
  async addToHistory(
    templateId: string,
    filledData: Record<string, any>,
    generatedPrompt: string
  ): Promise<TemplateUsage> {
    const usage: TemplateUsage = {
      id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      userId: authService.getUser()?.id.toString() || 'guest',
      usedAt: new Date(),
      filledData,
      generatedPrompt
    };

    // Salvar localmente (limitar a 100 últimos)
    const history = this.getHistoryLocal();
    history.unshift(usage);
    if (history.length > 100) history.pop();
    localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(history));

    // Sync com servidor
    if (authService.isAuthenticated()) {
      try {
        await authService.apiRequest('/api/templates/history', {
          method: 'POST',
          body: JSON.stringify(usage)
        });
      } catch (error) {
        console.error('Erro ao salvar histórico:', error);
      }
    }

    return usage;
  }

  /**
   * Obter histórico local
   */
  getHistoryLocal(): TemplateUsage[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Obter histórico completo
   */
  async getHistory(limit?: number): Promise<TemplateUsage[]> {
    if (authService.isAuthenticated()) {
      try {
        return await authService.apiRequest<TemplateUsage[]>(
          `/api/templates/history${limit ? `?limit=${limit}` : ''}`
        );
      } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return this.getHistoryLocal().slice(0, limit);
      }
    }

    return this.getHistoryLocal().slice(0, limit);
  }

  /**
   * Limpar histórico
   */
  async clearHistory(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY_HISTORY);

    if (authService.isAuthenticated()) {
      try {
        await authService.apiRequest('/api/templates/history', {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Erro ao limpar histórico:', error);
      }
    }
  }

  /**
   * Obter templates mais usados pelo usuário
   */
  async getMostUsedTemplates(limit = 5): Promise<
    Array<{ templateId: string; count: number }>
  > {
    const history = await this.getHistory();
    const counts: Record<string, number> = {};

    history.forEach((usage) => {
      counts[usage.templateId] = (counts[usage.templateId] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([templateId, count]) => ({ templateId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ===== TEMPLATES PERSONALIZADOS =====

  /**
   * Criar template personalizado
   */
  async createCustomTemplate(
    template: Omit<CustomTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount' | 'likes'>
  ): Promise<CustomTemplate> {
    if (!authService.isAuthenticated()) {
      throw new Error('É necessário estar autenticado');
    }

    return authService.apiRequest<CustomTemplate>(
      '/api/templates/custom',
      {
        method: 'POST',
        body: JSON.stringify(template)
      }
    );
  }

  /**
   * Atualizar template personalizado
   */
  async updateCustomTemplate(
    id: string,
    updates: Partial<CustomTemplate>
  ): Promise<CustomTemplate> {
    return authService.apiRequest<CustomTemplate>(
      `/api/templates/custom/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates)
      }
    );
  }

  /**
   * Deletar template personalizado
   */
  async deleteCustomTemplate(id: string): Promise<void> {
    return authService.apiRequest<void>(`/api/templates/custom/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Listar templates personalizados do usuário
   */
  async getCustomTemplates(): Promise<CustomTemplate[]> {
    if (!authService.isAuthenticated()) {
      return [];
    }

    return authService.apiRequest<CustomTemplate[]>(
      '/api/templates/custom'
    );
  }

  /**
   * Obter template personalizado por ID
   */
  async getCustomTemplate(id: string): Promise<CustomTemplate> {
    return authService.apiRequest<CustomTemplate>(
      `/api/templates/custom/${id}`
    );
  }

  // ===== TEMPLATES COMPARTILHADOS =====

  /**
   * Compartilhar template (tornar público)
   */
  async shareTemplate(customTemplateId: string): Promise<SharedTemplate> {
    return authService.apiRequest<SharedTemplate>(
      '/api/templates/shared',
      {
        method: 'POST',
        body: JSON.stringify({ customTemplateId })
      }
    );
  }

  /**
   * Remover compartilhamento
   */
  async unshareTemplate(sharedTemplateId: string): Promise<void> {
    return authService.apiRequest<void>(
      `/api/templates/shared/${sharedTemplateId}`,
      {
        method: 'DELETE'
      }
    );
  }

  /**
   * Listar templates compartilhados (comunidade)
   */
  async getSharedTemplates(params?: {
    category?: string;
    sortBy?: 'recent' | 'popular' | 'rating';
    limit?: number;
  }): Promise<SharedTemplate[]> {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return authService.apiRequest<SharedTemplate[]>(
      `/api/templates/shared?${queryParams.toString()}`
    );
  }

  /**
   * Avaliar template compartilhado
   */
  async rateTemplate(
    templateId: string,
    rating: number,
    comment?: string
  ): Promise<TemplateRating> {
    return authService.apiRequest<TemplateRating>(
      `/api/templates/shared/${templateId}/rate`,
      {
        method: 'POST',
        body: JSON.stringify({ rating, comment })
      }
    );
  }

  /**
   * Curtir template compartilhado
   */
  async likeTemplate(templateId: string): Promise<void> {
    return authService.apiRequest<void>(
      `/api/templates/shared/${templateId}/like`,
      {
        method: 'POST'
      }
    );
  }

  // ===== ANALYTICS =====

  /**
   * Obter analytics de um template
   */
  async getTemplateAnalytics(
    templateId: string
  ): Promise<TemplateAnalytics> {
    return authService.apiRequest<TemplateAnalytics>(
      `/api/templates/analytics/${templateId}`
    );
  }

  /**
   * Obter analytics gerais
   */
  async getGeneralAnalytics(): Promise<{
    mostUsed: TemplateAnalytics[];
    trending: TemplateAnalytics[];
    byCategory: Record<string, number>;
  }> {
    return authService.apiRequest('/api/templates/analytics');
  }

  // ===== PRÉ-VISUALIZAÇÃO =====

  /**
   * Obter pré-visualização de template
   */
  async getTemplatePreview(templateId: string): Promise<TemplatePreview> {
    // Verificar cache
    const cached = this.getCachedPreview(templateId);
    if (cached) return cached;

    try {
      const preview = await authService.apiRequest<TemplatePreview>(
        `/api/templates/preview/${templateId}`
      );

      // Cachear resultado
      this.cachePreview(templateId, preview);
      return preview;
    } catch (error) {
      console.error('Erro ao buscar preview:', error);
      // Retornar preview genérico
      return this.generateGenericPreview(templateId);
    }
  }

  // ===== CACHE =====

  /**
   * Cachear preview de template
   */
  private cachePreview(templateId: string, preview: TemplatePreview): void {
    const cache = this.getCache();
    cache[templateId] = {
      preview,
      timestamp: Date.now()
    };
    localStorage.setItem(this.CACHE_KEY_TEMPLATES, JSON.stringify(cache));
  }

  /**
   * Obter preview do cache
   */
  private getCachedPreview(templateId: string): TemplatePreview | null {
    const cache = this.getCache();
    const cached = cache[templateId];

    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
      return cached.preview;
    }

    return null;
  }

  /**
   * Obter cache completo
   */
  private getCache(): Record<
    string,
    { preview: TemplatePreview; timestamp: number }
  > {
    try {
      const data = localStorage.getItem(this.CACHE_KEY_TEMPLATES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Limpar cache expirado
   */
  clearExpiredCache(): void {
    const cache = this.getCache();
    const now = Date.now();
    const cleaned: typeof cache = {};

    Object.entries(cache).forEach(([key, value]) => {
      if (now - value.timestamp < this.CACHE_EXPIRY) {
        cleaned[key] = value;
      }
    });

    localStorage.setItem(this.CACHE_KEY_TEMPLATES, JSON.stringify(cleaned));
  }

  /**
   * Gerar preview genérico (fallback)
   */
  private generateGenericPreview(templateId: string): TemplatePreview {
    return {
      templateId,
      examplePrompt: 'Exemplo de prompt não disponível',
      exampleOutput: 'Exemplo de saída não disponível',
      estimatedQuality: 'medium',
      keyFeatures: [
        'Prompt estruturado',
        'Campos personalizáveis',
        'Resultado acadêmico'
      ]
    };
  }
}

export const templateService = new TemplateService();

// Limpar cache expirado ao iniciar
templateService.clearExpiredCache();
