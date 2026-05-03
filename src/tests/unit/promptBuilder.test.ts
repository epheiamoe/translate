import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildDetectionPrompt,
  getLanguageName,
  getSupportedLanguages,
  getBuiltInProviders
} from '../../lib/prompts/loadPrompts';

describe('Prompt Building', () => {
  describe('buildSystemPrompt', () => {
    it('should build translation system prompt with correct placeholders replaced', () => {
      const prompt = buildSystemPrompt('translation', 'en', 'zh', 'formal');
      
      expect(prompt).toContain('English');
      expect(prompt).toContain('Chinese');
      expect(prompt).toContain('formal');
      expect(prompt).not.toContain('{{source_lang}}');
      expect(prompt).not.toContain('{{target_lang}}');
    });

    it('should build parsing system prompt', () => {
      const prompt = buildSystemPrompt('parsing', 'ja', 'en', 'casual');
      
      expect(prompt).toContain('Japanese');
      expect(prompt).toContain('English');
      expect(prompt).not.toContain('{{style}}');
    });

    it('should handle custom style', () => {
      const prompt = buildSystemPrompt('translation', 'en', 'zh', 'custom', 'Use simple words');
      
      expect(prompt).toContain('Use simple words');
    });
  });

  describe('buildUserPrompt', () => {
    it('should build translation user prompt', () => {
      const prompt = buildUserPrompt('translation', 'en', 'zh', 'Hello world');
      
      expect(prompt).toContain('English');
      expect(prompt).toContain('Chinese');
      expect(prompt).toContain('Hello world');
    });

    it('should build parsing user prompt', () => {
      const prompt = buildUserPrompt('parsing', 'fr', 'en', 'Bonjour');
      
      expect(prompt).toContain('French');
      expect(prompt).toContain('Bonjour');
    });
  });

  describe('buildDetectionPrompt', () => {
    it('should build detection prompt with text', () => {
      const prompt = buildDetectionPrompt('你好世界');
      
      expect(prompt).toContain('你好世界');
    });
  });

  describe('getLanguageName', () => {
    it('should return language name for valid code', () => {
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('zh')).toBe('Chinese');
      expect(getLanguageName('ja')).toBe('Japanese');
    });

    it('should return code itself for unknown language', () => {
      expect(getLanguageName('xyz')).toBe('xyz');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return an object with languages', () => {
      const languages = getSupportedLanguages();
      
      expect(languages).toBeDefined();
      expect(typeof languages).toBe('object');
      expect(languages.en).toBe('English');
      expect(languages.zh).toBe('Chinese');
    });
  });

  describe('getBuiltInProviders', () => {
    it('should return providers with their models', () => {
      const providers = getBuiltInProviders();

      expect(providers).toBeDefined();
      expect(providers['deepseek']).toBeDefined();
      expect(providers['deepseek'].name).toBe('DeepSeek');
      expect(providers['deepseek'].models.length).toBeGreaterThan(0);
      expect(providers['deepseek'].models[0].name).toBeDefined();
    });
  });
});

describe('Input Sanitization', () => {
  it('should handle special characters in text', () => {
    const prompt = buildUserPrompt('translation', 'en', 'zh', 'Hello {{world}}');
    expect(prompt).toContain('Hello {{world}}');
  });

  it('should handle newlines in text', () => {
    const prompt = buildUserPrompt('translation', 'en', 'zh', 'Line1\nLine2');
    expect(prompt).toContain('Line1');
    expect(prompt).toContain('Line2');
  });

  it('should handle quotes in text', () => {
    const prompt = buildUserPrompt('translation', 'en', 'zh', 'Say "Hello"');
    expect(prompt).toContain('Say "Hello"');
  });
});