/**
 * Hook para gerenciar funcionalidades de templates
 */

import { useState, useEffect } from 'react';
import { templateService } from '../services/templateService';
import type { TemplateUsage } from '../types/templates';

export const useTemplateFeatures = () => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplateData();
  }, []);

  const loadTemplateData = async () => {
    setLoading(true);
    try {
      // Carregar favoritos
      const favs = templateService.getFavoritesLocal();
      setFavorites(new Set(favs.map(f => f.templateId)));

      // Carregar contagem de uso
      const history = templateService.getHistoryLocal();
      const counts: Record<string, number> = {};
      history.forEach((usage: TemplateUsage) => {
        counts[usage.templateId] = (counts[usage.templateId] || 0) + 1;
      });
      setUsageCounts(counts);
    } catch (error) {
      console.error('Erro ao carregar dados de templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (templateId: string) => {
    const isFav = favorites.has(templateId);

    if (isFav) {
      await templateService.removeFavorite(templateId);
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    } else {
      await templateService.addFavorite(templateId);
      setFavorites(prev => new Set(prev).add(templateId));
    }
  };

  const addToHistory = async (
    templateId: string,
    filledData: Record<string, any>,
    generatedPrompt: string
  ) => {
    await templateService.addToHistory(templateId, filledData, generatedPrompt);
    setUsageCounts(prev => ({
      ...prev,
      [templateId]: (prev[templateId] || 0) + 1
    }));
  };

  return {
    favorites,
    usageCounts,
    loading,
    toggleFavorite,
    addToHistory,
    isFavorite: (templateId: string) => favorites.has(templateId),
    getUsageCount: (templateId: string) => usageCounts[templateId] || 0
  };
};
