export interface TranslationRecord {
  id?: number;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  mode: 'translation' | 'parsing';
  style: string;
  customStyle?: string;
  timestamp: number;
  isFavorite: boolean;
  thinkingContent?: string;
}

export interface CustomLanguage {
  id: string;
  name: string;
  promptSuffix: string;
}

export interface CustomModel {
  id: string;
  name: string;
  apiType: string;
  maxContext: number;
  supportsThinking: boolean;
}

export interface AppSettings {
  defaultSourceLang: string;
  defaultTargetLang: string;
  defaultMode: 'translation' | 'parsing';
  defaultStyle: string;
  customStyle: string;
  apiBaseUrl: string;
  apiKey: string;
  selectedModel: string;
  customLanguages: CustomLanguage[];
  customModels: CustomModel[];
  jinaApiKey: string;
  cssVariables?: Record<string, string>;
  customCSS?: string;
}

const DB_NAME = 'translate-pwa-db';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        historyStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

export async function saveTranslation(record: Omit<TranslationRecord, 'id'>): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.add(record);
    
    request.onsuccess = async () => {
      const id = request.result as number;
      await cleanupOldRecords();
      resolve(id);
    };
    request.onerror = () => reject(request.error);
  });
}

const MAX_RECORDS = 1000;
const MAX_DAYS = 30;

async function cleanupOldRecords(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const records = request.result as TranslationRecord[];
      const now = Date.now();
      const maxAge = MAX_DAYS * 24 * 60 * 60 * 1000;
      
      const nonFavorites = records.filter(r => !r.isFavorite);
      const favorites = records.filter(r => r.isFavorite);
      
      if (nonFavorites.length <= MAX_RECORDS && nonFavorites.every(r => now - r.timestamp < maxAge)) {
        resolve();
        return;
      }
      
      nonFavorites.sort((a, b) => b.timestamp - a.timestamp);
      
      const toDelete: number[] = [];
      
      for (let i = MAX_RECORDS; i < nonFavorites.length; i++) {
        if (nonFavorites[i].id !== undefined) {
          toDelete.push(nonFavorites[i].id as number);
        }
      }
      
      for (const record of nonFavorites) {
        if (now - record.timestamp >= maxAge && record.id !== undefined) {
          toDelete.push(record.id as number);
        }
      }
      
      if (toDelete.length > 0) {
        const deleteTransaction = db.transaction(['history'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('history');
        for (const id of toDelete) {
          deleteStore.delete(id);
        }
      }
      
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateTranslation(record: TranslationRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.put(record);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTranslation(id: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllHistory(): Promise<TranslationRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result as TranslationRecord[];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getFavorites(): Promise<TranslationRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = (request.result as TranslationRecord[])
        .filter(record => record.isFavorite === true)
        .sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function toggleFavorite(id: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const record = getRequest.result as TranslationRecord;
      if (record) {
        record.isFavorite = !record.isFavorite;
        const putRequest = store.put(record);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error('Record not found'));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveSetting<K extends keyof AppSettings>(
  key: K, 
  value: AppSettings[K]
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K] | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.value);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSettings(): Promise<Partial<AppSettings>> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result as Array<{ key: string; value: unknown }>;
      const settings: Partial<AppSettings> = {};
      for (const item of results) {
        (settings as Record<string, unknown>)[item.key] = item.value;
      }
      resolve(settings);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function exportData(): Promise<string> {
  const history = await getAllHistory();
  const settings = await getAllSettings();
  return JSON.stringify({ history, settings }, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as { 
    history?: TranslationRecord[]; 
    settings?: Partial<AppSettings> 
  };
  
  if (data.history && Array.isArray(data.history)) {
    const db = await getDB();
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    
    for (const record of data.history) {
      const recordWithoutId = { ...record };
      delete recordWithoutId.id;
      store.add(recordWithoutId);
    }
  }
  
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      await saveSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    }
  }
}