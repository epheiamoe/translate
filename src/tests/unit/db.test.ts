import { describe, it, expect } from 'vitest';
import type { TranslationRecord, CustomLanguage, AppSettings } from '../../lib/db';

describe('Database Types', () => {
  describe('TranslationRecord', () => {
    it('should have all required fields', () => {
      const record: TranslationRecord = {
        id: 1,
        sourceText: 'Hello',
        targetText: '你好',
        sourceLang: 'en',
        targetLang: 'zh',
        mode: 'translation',
        style: 'formal',
        timestamp: Date.now(),
        isFavorite: false,
        thinkingContent: undefined
      };

      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('sourceText');
      expect(record).toHaveProperty('targetText');
      expect(record).toHaveProperty('sourceLang');
      expect(record).toHaveProperty('targetLang');
      expect(record).toHaveProperty('mode');
      expect(record).toHaveProperty('style');
      expect(record).toHaveProperty('timestamp');
      expect(record).toHaveProperty('isFavorite');
    });

    it('should allow optional fields', () => {
      const record: TranslationRecord = {
        sourceText: 'Hello',
        targetText: '你好',
        sourceLang: 'en',
        targetLang: 'zh',
        mode: 'translation',
        style: 'formal',
        timestamp: Date.now(),
        isFavorite: false
      };

      expect(record.id).toBeUndefined();
      expect(record.thinkingContent).toBeUndefined();
    });

    it('should support parsing mode', () => {
      const record: TranslationRecord = {
        sourceText: 'Hello',
        targetText: 'Explanation here',
        sourceLang: 'en',
        targetLang: 'zh',
        mode: 'parsing',
        style: 'academic',
        timestamp: Date.now(),
        isFavorite: false
      };

      expect(record.mode).toBe('parsing');
    });
  });

  describe('CustomLanguage', () => {
    it('should have correct structure', () => {
      const customLang: CustomLanguage = {
        id: 'custom_sanskrit',
        name: 'Sanskrit',
        promptSuffix: 'Translate to Sanskrit using classical forms'
      };

      expect(customLang).toHaveProperty('id');
      expect(customLang).toHaveProperty('name');
      expect(customLang).toHaveProperty('promptSuffix');
    });
  });

  describe('AppSettings', () => {
    it('should have correct structure', () => {
      const settings: AppSettings = {
        defaultSourceLang: 'auto',
        defaultTargetLang: 'zh',
        defaultMode: 'translation',
        defaultStyle: 'formal',
        customStyle: '',
        customInstructions: '',
        glossary: '',
        selectedProvider: 'deepseek',
        selectedModel: 'deepseek-v4-flash',
        providerApiKeys: {},
        customLanguages: [],
        customProviders: [],
        jinaApiKey: '',
        thinkingEnabled: false
      };

      expect(settings.defaultSourceLang).toBe('auto');
      expect(settings.defaultTargetLang).toBe('zh');
      expect(settings.selectedProvider).toBe('deepseek');
    });
  });
});