import promptsYaml from './prompts.yaml?raw';
import { parse } from 'yaml';
import { getDefaultSystemPrompts, getDefaultUserPrompts, SystemPrompts, UserPrompts } from './defaultPrompts';
import { getRawSetting, saveRawSetting } from '../db';

export interface ProviderModel {
  id: string;
  name: string;
  supports_thinking: boolean;
  max_context: number;
  max_output?: number;
  pricing_input?: number;
  pricing_output?: number;
}

export interface Provider {
  id: string;
  name: string;
  is_built_in: boolean;
  base_url: string;
  api_type: string;
  models: ProviderModel[];
}

export interface CustomProvider extends Provider {
  apiKey?: string;
}

interface PromptConfig {
  system: {
    translation: string;
    translation_long: string;
    parsing: string;
    language_detection: string;
    doc_translation: string;
    alternative_translation: string;
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
  providers: Record<string, Omit<Provider, 'id'>>;
  custom_providers: CustomProvider[];
}

let cachedConfig: PromptConfig | null = null;

function loadPrompts(): PromptConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = parse(promptsYaml) as PromptConfig;
  return cachedConfig;
}

const STORAGE_KEY_SYSTEM = 'customSystemPrompts';
const STORAGE_KEY_USER = 'customUserPrompts';

export async function loadPromptsFromDB(): Promise<void> {
  const [customSystem, customUser] = await Promise.all([
    getRawSetting(STORAGE_KEY_SYSTEM) as Promise<SystemPrompts | undefined>,
    getRawSetting(STORAGE_KEY_USER) as Promise<UserPrompts | undefined>
  ]);

  const config = loadPrompts();

  if (customSystem) {
    config.system = { ...config.system, ...customSystem };
  }

  if (customUser) {
    config.user = { ...config.user, ...customUser };
  }
}

export async function saveSystemPrompts(prompts: SystemPrompts): Promise<void> {
  await saveRawSetting(STORAGE_KEY_SYSTEM, prompts);
  loadPrompts().system = { ...loadPrompts().system, ...prompts };
}

export async function saveUserPrompts(prompts: UserPrompts): Promise<void> {
  await saveRawSetting(STORAGE_KEY_USER, prompts);
  loadPrompts().user = { ...loadPrompts().user, ...prompts };
}

export async function resetSystemPrompts(): Promise<void> {
  await saveRawSetting(STORAGE_KEY_SYSTEM, null);
  const config = parse(promptsYaml) as PromptConfig;
  loadPrompts().system = config.system;
}

export async function resetUserPrompts(): Promise<void> {
  await saveRawSetting(STORAGE_KEY_USER, null);
  const config = parse(promptsYaml) as PromptConfig;
  loadPrompts().user = config.user;
}

export async function resetAllPrompts(): Promise<void> {
  await Promise.all([resetSystemPrompts(), resetUserPrompts()]);
}

export function getCurrentSystemPrompts(): SystemPrompts {
  const defaults = getDefaultSystemPrompts();
  const config = loadPrompts();
  return { ...defaults, ...config.system };
}

export function getCurrentUserPrompts(): UserPrompts {
  const defaults = getDefaultUserPrompts();
  const config = loadPrompts();
  return { ...defaults, ...config.user };
}

export interface BuiltInProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiType: string;
  models: ProviderModel[];
}

export interface ModelConfig {
  name: string;
  supports_thinking: boolean;
  api_type: string;
  max_context: number;
  max_output?: number;
  pricing_input?: number;
  pricing_output?: number;
}

export function buildSystemPrompt(
  mode: 'translation' | 'parsing',
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string,
  customInstructions?: string,
  glossary?: string
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

  if (customInstructions) {
    systemPrompt = systemPrompt + '\n\n' + customInstructions;
  }

  if (glossary) {
    systemPrompt = systemPrompt + '\n\nGlossary (use these translations consistently):\n' + glossary;
  }

  return systemPrompt;
}

export function buildSystemPromptLong(
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string,
  customInstructions?: string,
  glossary?: string
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

  if (customInstructions) {
    systemPrompt = systemPrompt + '\n\n' + customInstructions;
  }

  if (glossary) {
    systemPrompt = systemPrompt + '\n\nGlossary (use these translations consistently):\n' + glossary;
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
  customStyle?: string,
  customInstructions?: string,
  glossary?: string
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

  if (customInstructions) {
    systemPrompt = systemPrompt + '\n\n' + customInstructions;
  }

  if (glossary) {
    systemPrompt = systemPrompt + '\n\nGlossary (use these translations consistently):\n' + glossary;
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

export function getBuiltInProviders(): Record<string, BuiltInProvider> {
  const prompts = loadPrompts();
  const result: Record<string, BuiltInProvider> = {};

  for (const [key, provider] of Object.entries(prompts.providers)) {
    result[key] = {
      id: key,
      name: provider.name,
      baseUrl: provider.base_url,
      apiType: provider.api_type,
      models: provider.models.map(m => ({
        id: m.id,
        name: m.name,
        supports_thinking: m.supports_thinking,
        max_context: m.max_context || 128000
      }))
    };
  }

  return result;
}

export function getProviderById(providerId: string): BuiltInProvider | undefined {
  const providers = getBuiltInProviders();
  return providers[providerId];
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  const providers = getBuiltInProviders();

  for (const provider of Object.values(providers)) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) {
      return {
        name: model.name,
        supports_thinking: model.supports_thinking,
        api_type: provider.apiType,
        max_context: model.max_context,
        max_output: model.max_output,
        pricing_input: model.pricing_input,
        pricing_output: model.pricing_output
      };
    }
  }

  return undefined;
}

export function getModelMaxContext(modelId: string): number {
  const config = getModelConfig(modelId);
  return config?.max_context || 128000;
}

export function getAllModelsFromBuiltInProviders(): Record<string, { providerId: string; providerName: string; model: ProviderModel }> {
  const providers = getBuiltInProviders();
  const result: Record<string, { providerId: string; providerName: string; model: ProviderModel }> = {};

  for (const [providerId, provider] of Object.entries(providers)) {
    for (const model of provider.models) {
      result[model.id] = {
        providerId,
        providerName: provider.name,
        model
      };
    }
  }

  return result;
}

export interface ResolvedModelConfig {
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiType: string;
  modelId: string;
  modelName: string;
  supportsThinking: boolean;
  maxContext: number;
  maxOutput?: number;
  pricingInput?: number;
  pricingOutput?: number;
}

export function resolveModelConfig(
  selectedProvider: string,
  selectedModel: string,
  customProviders: { id: string; name: string; baseUrl: string; models: { id: string; name: string; maxContext: number; supportsThinking: boolean }[] }[]
): ResolvedModelConfig | null {
  const builtInProviders = getBuiltInProviders();

  if (builtInProviders[selectedProvider]) {
    const provider = builtInProviders[selectedProvider];
    let model = provider.models.find(m => m.id === selectedModel);

    if (!model) {
      model = provider.models[0];
    }

    if (model) {
      return {
        providerId: selectedProvider,
        providerName: provider.name,
        baseUrl: provider.baseUrl,
        apiType: provider.apiType,
        modelId: model.id,
        modelName: model.name,
        supportsThinking: model.supports_thinking,
        maxContext: model.max_context,
        maxOutput: model.max_output,
        pricingInput: model.pricing_input,
        pricingOutput: model.pricing_output
      };
    }
  }

  const customProvider = customProviders.find(p => p.id === selectedProvider);
  if (customProvider) {
    const model = customProvider.models.find(m => m.id === selectedModel);
    if (model) {
      return {
        providerId: customProvider.id,
        providerName: customProvider.name,
        baseUrl: customProvider.baseUrl,
        apiType: 'openai',
        modelId: model.id,
        modelName: model.name,
        supportsThinking: model.supportsThinking,
        maxContext: model.maxContext,
        maxOutput: model.maxContext,
        pricingInput: undefined,
        pricingOutput: undefined
      };
    }
  }

  return null;
}

export function getModelsForProvider(
  providerId: string,
  customProviders: { id: string; name: string; baseUrl: string; models: { id: string; name: string; maxContext: number; supportsThinking: boolean }[] }[]
): { id: string; name: string; supportsThinking: boolean; maxContext: number }[] {
  const builtInProviders = getBuiltInProviders();

  if (builtInProviders[providerId]) {
    return builtInProviders[providerId].models.map(m => ({
      id: m.id,
      name: m.name,
      supportsThinking: m.supports_thinking,
      maxContext: m.max_context
    }));
  }

  const customProvider = customProviders.find(p => p.id === providerId);
  if (customProvider) {
    return customProvider.models;
  }

  return [];
}

export const TRANSLATION_END_MARKER = '<!-- TRANSLATION_END -->';

export function checkTranslationComplete(content: string): boolean {
  return content.includes(TRANSLATION_END_MARKER);
}

export function removeEndMarker(content: string): string {
  return content.replace(TRANSLATION_END_MARKER, '').trim();
}

export function buildAlternativeSystemPrompt(
  sourceLang: string,
  targetLang: string,
  style: string,
  customStyle?: string,
  customInstructions?: string,
  glossary?: string
): string {
  const prompts = loadPrompts();
  let systemPrompt = prompts.system.alternative_translation;

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
    const styleText = prompts.styles[style] || prompts.styles.unspecified;
    systemPrompt = systemPrompt.replace('{{style}}', styleText);
  }

  if (customInstructions) {
    systemPrompt = systemPrompt + '\n\n' + customInstructions;
  }

  if (glossary) {
    systemPrompt = systemPrompt + '\n\nGlossary (use these translations consistently):\n' + glossary;
  }

  return systemPrompt;
}

export function buildAlternativeUserPrompt(
  sourceText: string,
  firstTranslation: string,
  sourceLang: string,
  targetLang: string
): string {
  const prompts = loadPrompts();
  const langName = prompts.languages[sourceLang] || sourceLang;
  const targetLangName = prompts.languages[targetLang] || targetLang;

  return `<user_content>\nOriginal ${langName} text:\n${sourceText}\n</user_content>\n\n<user_content>\nExisting ${targetLangName} translation:\n${firstTranslation}\n</user_content>`;
}

export function parseAlternatives(response: string): string[] {
  const matches = response.match(/\d\.\s*([^\n]+(?:\n(?!\d\.)[^\n]+)*)/g);
  if (!matches) {
    const lines = response.split('\n').filter(l => l.trim());
    return lines.map(l => l.replace(/^\d\.\s*/, '').trim()).filter(l => l.length > 0);
  }
  return matches.map(m => {
    const cleaned = m.replace(/^\d\.\s*/, '').trim();
    return cleaned.split('\n').filter(l => l.trim()).join(' ');
  }).filter(l => l.length > 0);
}