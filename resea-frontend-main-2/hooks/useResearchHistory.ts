/**
 * Custom hook for managing research history with persistent storage
 */

import { useState, useEffect } from 'react';
import type { CompletedResearch } from '../types';
import {
  loadAllResearch,
  saveResearch,
  deleteResearch,
  loadFromLocalStorage,
  saveToLocalStorage
} from '../services/storageService';

export function useResearchHistory() {
  const [history, setHistory] = useState<CompletedResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Auto-save to localStorage as backup
  useEffect(() => {
    if (history.length > 0 && !loading) {
      saveToLocalStorage(history);
    }
  }, [history, loading]);

  async function loadHistory() {
    try {
      setLoading(true);
      setError(null);

      // Try IndexedDB first
      let loadedHistory = await loadAllResearch();

      // Fallback to localStorage if empty
      if (loadedHistory.length === 0) {
        loadedHistory = loadFromLocalStorage();
      }

      setHistory(loadedHistory);
    } catch (err: any) {
      console.error('Failed to load history', err);
      setError(err.message);

      // Try localStorage as fallback
      const fallbackHistory = loadFromLocalStorage();
      setHistory(fallbackHistory);
    } finally {
      setLoading(false);
    }
  }

  async function addToHistory(research: CompletedResearch) {
    try {
      // Save to IndexedDB
      await saveResearch(research);

      // Update state
      setHistory((prev) => [research, ...prev]);
    } catch (err: any) {
      console.error('Failed to save research', err);
      setError(err.message);

      // Still update state even if save failed
      setHistory((prev) => [research, ...prev]);
    }
  }

  async function removeFromHistory(id: string) {
    try {
      // Delete from IndexedDB
      await deleteResearch(id);

      // Update state
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error('Failed to delete research', err);
      setError(err.message);

      // Still update state even if delete failed
      setHistory((prev) => prev.filter((item) => item.id !== id));
    }
  }

  function clearHistory() {
    setHistory([]);
    saveToLocalStorage([]);
  }

  return {
    history,
    loading,
    error,
    addToHistory,
    removeFromHistory,
    clearHistory,
    refreshHistory: loadHistory
  };
}
