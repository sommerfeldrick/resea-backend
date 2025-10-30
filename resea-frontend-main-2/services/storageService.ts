/**
 * Storage Service - Persistent storage using IndexedDB
 * Replaces volatile in-memory storage with durable local database
 */

import type { CompletedResearch } from '../types';

const DB_NAME = 'ReseaDB';
const DB_VERSION = 1;
const STORE_NAME = 'research_history';

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('query', 'query', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save research to IndexedDB
 */
export async function saveResearch(research: CompletedResearch): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Add timestamp if not present
    const researchWithTimestamp = {
      ...research,
      timestamp: Date.now()
    };

    const request = store.put(researchWithTimestamp);

    request.onsuccess = () => {
      console.log('✅ Research saved to IndexedDB', { id: research.id });
      resolve();
    };

    request.onerror = () => {
      console.error('❌ Failed to save research', request.error);
      reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Load all research history from IndexedDB
 */
export async function loadAllResearch(): Promise<CompletedResearch[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      console.log('✅ Loaded research from IndexedDB', { count: results.length });

      // Sort by timestamp (newest first)
      results.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

      resolve(results);
    };

    request.onerror = () => {
      console.error('❌ Failed to load research', request.error);
      reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Load specific research by ID
 */
export async function loadResearch(id: string): Promise<CompletedResearch | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result || null;
      if (result) {
        console.log('✅ Research loaded from IndexedDB', { id });
      } else {
        console.warn('⚠️ Research not found', { id });
      }
      resolve(result);
    };

    request.onerror = () => {
      console.error('❌ Failed to load research', request.error);
      reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete research by ID
 */
export async function deleteResearch(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('✅ Research deleted from IndexedDB', { id });
      resolve();
    };

    request.onerror = () => {
      console.error('❌ Failed to delete research', request.error);
      reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all research history
 */
export async function clearAllResearch(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('✅ All research cleared from IndexedDB');
      resolve();
    };

    request.onerror = () => {
      console.error('❌ Failed to clear research', request.error);
      reject(request.error);
    };

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Export research history as JSON
 */
export async function exportResearchHistory(): Promise<string> {
  const history = await loadAllResearch();
  return JSON.stringify(history, null, 2);
}

/**
 * Import research history from JSON
 */
export async function importResearchHistory(jsonString: string): Promise<number> {
  try {
    const history: CompletedResearch[] = JSON.parse(jsonString);

    if (!Array.isArray(history)) {
      throw new Error('Invalid format: expected array');
    }

    let imported = 0;

    for (const research of history) {
      try {
        await saveResearch(research);
        imported++;
      } catch (error) {
        console.error('Failed to import research', { id: research.id, error });
      }
    }

    console.log('✅ Import completed', { total: history.length, imported });
    return imported;
  } catch (error: any) {
    console.error('❌ Import failed', error);
    throw new Error(`Import failed: ${error.message}`);
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  count: number;
  totalSize: number;
  oldestTimestamp: number;
  newestTimestamp: number;
}> {
  const history = await loadAllResearch();

  if (history.length === 0) {
    return {
      count: 0,
      totalSize: 0,
      oldestTimestamp: 0,
      newestTimestamp: 0
    };
  }

  const totalSize = new Blob([JSON.stringify(history)]).size;
  const timestamps = history
    .map((r: any) => r.timestamp || 0)
    .filter((t) => t > 0);

  return {
    count: history.length,
    totalSize,
    oldestTimestamp: Math.min(...timestamps),
    newestTimestamp: Math.max(...timestamps)
  };
}

/**
 * Fallback to localStorage if IndexedDB fails
 */
const LOCALSTORAGE_KEY = 'resea_research_history';

export function saveToLocalStorage(history: CompletedResearch[]): void {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(history));
    console.log('✅ Saved to localStorage as fallback');
  } catch (error) {
    console.error('❌ localStorage save failed', error);
  }
}

export function loadFromLocalStorage(): CompletedResearch[] {
  try {
    const data = localStorage.getItem(LOCALSTORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ localStorage load failed', error);
  }
  return [];
}
