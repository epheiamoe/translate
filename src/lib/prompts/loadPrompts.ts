import promptsYaml from './prompts.yaml?raw';
import { parse } from 'yaml';

interface ModelConfig {
  name: string;
  supports_thinking: boolean;
  api_type: string;
  max_context: number;
}

interface PromptConfig {
  system: {
    translation: string;
    translation_long: string;
    parsing: string;
    language_detection: string;
    doc_translation: string;
  };
  detection_prompt: string;
  user: {
    translation: string;
    translation_long: string;
    translation_continue: string;
    parsing: string;
    doc_translation: string;
  };
  styles: Record<string, string>;
  languages: Record<string, string>;
  models: Record<string, ModelConfig>;
  custom_models: Array<ModelConfig & { id: string }>;
}

let cachedConfig: PromptConfig | null = null;

export function loadPrompts(): PromptConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = parse(promptsYaml) as PromptConfig;
  return cachedConfig;
}

export function buildSystemPrompt(
  mode: 'translation' | 'parsing',
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string
): string {
  const prompts = loadPrompts();
  let systemPrompt = mode === 'translation' 
    ? prompts.system.translation 
    : prompts.system.parsing;

  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  systemPrompt = systemPrompt
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName);

  if (style === 'custom' && customStyle) {
    systemPrompt = systemPrompt.replace(
      '{{style}}',
      prompts.styles.custom.replace('{{custom_style}}', customStyle)
    );
  } else {
    const styleText = prompts.styles[style] || prompts.styles.formal;
    systemPrompt = systemPrompt.replace('{{style}}', styleText);
  }

  return systemPrompt;
}

export function buildSystemPromptLong(
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string
): string {
  const prompts = loadPrompts();
  let systemPrompt = prompts.system.translation_long;

  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  systemPrompt = systemPrompt
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName);

  if (style === 'custom' && customStyle) {
    systemPrompt = systemPrompt.replace(
      '{{style}}',
      prompts.styles.custom.replace('{{custom_style}}', customStyle)
    );
  } else {
    const styleText = prompts.styles[style] || prompts.styles.formal;
    systemPrompt = systemPrompt.replace('{{style}}', styleText);
  }

  return systemPrompt;
}

export function buildUserPrompt(
  mode: 'translation' | 'parsing',
  sourceLang: string,
  targetLang: string,
  text: string
): string {
  const prompts = loadPrompts();
  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  const template = mode === 'translation' 
    ? prompts.user.translation 
    : prompts.user.parsing;

  return template
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName)
    .replace('{{text}}', text);
}

export function buildUserPromptLong(
  sourceLang: string,
  targetLang: string,
  text: string
): string {
  const prompts = loadPrompts();
  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  return prompts.user.translation_long
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName)
    .replace('{{text}}', text);
}

export function buildUserPromptContinue(
  lastContent: string,
  remainingText: string
): string {
  const prompts = loadPrompts();
  return prompts.user.translation_continue
    .replace('{{last_content}}', lastContent)
    .replace('{{remaining_text}}', remainingText);
}

export function buildDocSystemPrompt(
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string
): string {
  const prompts = loadPrompts();
  let systemPrompt = prompts.system.doc_translation;

  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  systemPrompt = systemPrompt
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName);

  if (style === 'custom' && customStyle) {
    systemPrompt = systemPrompt.replace(
      '{{style}}',
      prompts.styles.custom.replace('{{custom_style}}', customStyle)
    );
  } else {
    const styleText = prompts.styles[style] || prompts.styles.formal;
    systemPrompt = systemPrompt.replace('{{style}}', styleText);
  }

  return systemPrompt;
}

export function buildDocUserPrompt(
  sourceLang: string,
  targetLang: string,
  text: string
): string {
  const prompts = loadPrompts();
  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  return prompts.user.doc_translation
    .replace('{{source_lang}}', langName)
    .replace('{{target_lang}}', targetLangName)
    .replace('{{text}}', text);
}

export function buildDetectionPrompt(text: string): string {
  const prompts = loadPrompts();
  return prompts.detection_prompt.replace('{{text}}', text);
}

export function getLanguageName(code: string): string {
  const prompts = loadPrompts();
  return prompts.languages[code] || code;
}

export function getSupportedLanguages(): Record<string, string> {
  const prompts = loadPrompts();
  return { ...prompts.languages };
}

export function getSupportedModels(): Record<string, ModelConfig> {
  const prompts = loadPrompts();
  const result: Record<string, ModelConfig> = {};
  
  for (const [key, model] of Object.entries(prompts.models)) {
    result[key] = {
      name: model.name,
      supports_thinking: model.supports_thinking,
      api_type: model.api_type,
      max_context: model.max_context || 128000
    };
  }
  
  for (const model of prompts.custom_models) {
    result[model.id] = {
      name: model.name,
      supports_thinking: model.supports_thinking,
      api_type: model.api_type,
      max_context: model.max_context || 128000
    };
  }
  
  return result;
}

export function getModelMaxContext(modelId: string): number {
  const models = getSupportedModels();
  return models[modelId]?.max_context || 128000;
}

export const TRANSLATION_END_MARKER = '<!-- TRANSLATION_END -->';

export function checkTranslationComplete(content: string): boolean {
  return content.includes(TRANSLATION_END_MARKER);
}

export function removeEndMarker(content: string): string {
  return content.replace(TRANSLATION_END_MARKER, '').trim();
}