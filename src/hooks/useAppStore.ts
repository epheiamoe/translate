import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  saveTranslation, 
  getAllHistory, 
  getFavorites, 
  toggleFavorite as dbToggleFavorite,
  deleteTranslation as dbDeleteTranslation,
  clearHistory as dbClearHistory,
  exportData as dbExportData,
  importData as dbImportData,
  saveSetting,
  getSetting,
  getAllSettings,
  TranslationRecord,
  CustomLanguage
} from '../lib/db';

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
}

interface AppState {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  mode: 'translation' | 'parsing';
  style: string;
  customStyle: string;
  isStreaming: boolean;
  history: TranslationRecord[];
  favorites: TranslationRecord[];
  thinkingContent: string;
  showHistory: boolean;
  showSettings: boolean;
  settings: AppSettings;
  
  docSourceText: string;
  docTargetText: string;
  docSourceLang: string;
  docTargetLang: string;
  docIsStreaming: boolean;
  docProgress: string;
  
  activeTab: 'translate' | 'explain' | 'doc';
  
  setSourceText: (text: string) => void;
  setTargetText: (text: string) => void;
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  setMode: (mode: 'translation' | 'parsing') => void;
  setStyle: (style: string) => void;
  setCustomStyle: (style: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setThinkingContent: (content: string) => void;
  setShowHistory: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setActiveTab: (tab: 'translate' | 'explain' | 'doc') => void;
  
  setDocSourceText: (text: string) => void;
  setDocTargetText: (text: string) => void;
  setDocSourceLang: (lang: string) => void;
  setDocTargetLang: (lang: string) => void;
  setDocIsStreaming: (streaming: boolean) => void;
  setDocProgress: (progress: string) => void;
  appendDocTargetText: (text: string) => void;
  
  loadHistory: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  addToHistory: (record: Omit<TranslationRecord, 'id'>) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
  saveSettingsToDb: () => Promise<void>;
  loadSettingsFromDb: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sourceText: '',
      targetText: '',
      sourceLang: 'auto',
      targetLang: 'zh',
      mode: 'translation',
      style: 'formal',
      customStyle: '',
      isStreaming: false,
      history: [],
      favorites: [],
      thinkingContent: '',
      showHistory: false,
      showSettings: false,
      settings: {
        defaultSourceLang: 'auto',
        defaultTargetLang: 'zh',
        defaultMode: 'translation',
        defaultStyle: 'formal',
        customStyle: '',
        apiBaseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        selectedModel: 'deepseek-chat',
        customLanguages: [],
        customModels: [],
        jinaApiKey: ''
      },

      docSourceText: '',
      docTargetText: '',
      docSourceLang: 'auto',
      docTargetLang: 'zh',
      docIsStreaming: false,
      docProgress: '',
      
      activeTab: 'translate',

      setSourceText: (text) => set({ sourceText: text }),
      setTargetText: (text) => set({ targetText: text }),
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),
      setMode: (mode) => set({ mode }),
      setStyle: (style) => set({ style }),
      setCustomStyle: (style) => set({ customStyle: style }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setThinkingContent: (content) => set({ thinkingContent: content }),
      setShowHistory: (show) => set({ showHistory: show }),
      setShowSettings: (show) => set({ showSettings: show }),
      setSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      setActiveTab: (tab) => set({ activeTab: tab }),

      setDocSourceText: (text) => set({ docSourceText: text }),
      setDocTargetText: (text) => set({ docTargetText: text }),
      setDocSourceLang: (lang) => set({ docSourceLang: lang }),
      setDocTargetLang: (lang) => set({ docTargetLang: lang }),
      setDocIsStreaming: (streaming) => set({ docIsStreaming: streaming }),
      setDocProgress: (progress) => set({ docProgress: progress }),
      appendDocTargetText: (text) => set((state) => ({ 
        docTargetText: state.docTargetText + text 
      })),

      loadHistory: async () => {
        const history = await getAllHistory();
        set({ history });
      },

      loadFavorites: async () => {
        const favorites = await getFavorites();
        set({ favorites });
      },

      addToHistory: async (record) => {
        await saveTranslation(record);
        await get().loadHistory();
        if (record.isFavorite) {
          await get().loadFavorites();
        }
      },

      toggleFavorite: async (id) => {
        await dbToggleFavorite(id);
        await get().loadHistory();
        await get().loadFavorites();
      },

      deleteRecord: async (id) => {
        await dbDeleteTranslation(id);
        await get().loadHistory();
        await get().loadFavorites();
      },

      clearHistory: async () => {
        await dbClearHistory();
        set({ history: [], favorites: [] });
      },

      exportData: async () => {
        return await dbExportData();
      },

      importData: async (json) => {
        await dbImportData(json);
        await get().loadHistory();
        await get().loadFavorites();
      },

      saveSettingsToDb: async () => {
        const { settings } = get();
        await saveSetting('defaultSourceLang', settings.defaultSourceLang);
        await saveSetting('defaultTargetLang', settings.defaultTargetLang);
        await saveSetting('defaultMode', settings.defaultMode);
        await saveSetting('defaultStyle', settings.defaultStyle);
        await saveSetting('customStyle', settings.customStyle);
        await saveSetting('apiBaseUrl', settings.apiBaseUrl);
        await saveSetting('apiKey', settings.apiKey);
        await saveSetting('selectedModel', settings.selectedModel);
        await saveSetting('customLanguages', settings.customLanguages);
        await saveSetting('customModels', settings.customModels);
        await saveSetting('jinaApiKey', settings.jinaApiKey);
      },

      loadSettingsFromDb: async () => {
        const dbSettings = await getAllSettings();
        const currentSettings = get().settings;
        set({
          settings: {
            ...currentSettings,
            ...dbSettings
          },
          sourceLang: (dbSettings.defaultSourceLang as string) || currentSettings.defaultSourceLang,
          targetLang: (dbSettings.defaultTargetLang as string) || currentSettings.defaultTargetLang,
          mode: (dbSettings.defaultMode as 'translation' | 'parsing') || currentSettings.defaultMode,
          style: (dbSettings.defaultStyle as string) || currentSettings.defaultStyle,
          customStyle: (dbSettings.customStyle as string) || currentSettings.customStyle,
          sourceText: '',
          targetText: '',
          thinkingContent: ''
        });
      }
    }),
    {
      name: 'translate-app-storage',
      partialize: (state) => ({
        settings: state.settings
      })
    }
  )
);