import { useCallback, useRef } from 'react';
import { useAppStore } from './useAppStore';
import { buildSystemPrompt, buildUserPrompt, buildDetectionPrompt, buildAlternativeSystemPrompt, buildAlternativeUserPrompt, parseAlternatives, resolveModelConfig, removeEndMarker } from '../lib/prompts/loadPrompts';
import { streamTranslate, detectLanguage, TokenUsage } from '../lib/llmClient';
import { addTokenUsage, setLastUsage, getSetting } from '../lib/db';

export function useTranslation() {
  const {
    sourceText,
    targetLang,
    mode,
    style,
    customStyle,
    sourceLang,
    settings,
    targetText,
    setTargetText,
    setThinkingContent,
    setIsStreaming,
    setAlternatives,
    setShowAlternatives,
    setIsLoadingAlternatives,
    setOriginalTranslation,
    setTranslationError,
    addToHistory
  } = useAppStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const getApiConfig = useCallback(() => {
    const config = resolveModelConfig(settings.selectedProvider, settings.selectedModel, settings.customProviders || []);
    if (!config) return null;
    const apiKey = (settings.providerApiKeys || {})[settings.selectedProvider] || '';
    return { ...config, apiKey };
  }, [settings.selectedProvider, settings.selectedModel, settings.providerApiKeys, settings.customProviders]);

  const stopTranslation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const translate = useCallback(async () => {
    const config = getApiConfig();
    setTranslationError('');

    if (!sourceText.trim()) {
      setTranslationError('Please enter text to translate');
      return;
    }

    if (!config?.apiKey) {
      setTranslationError(`Please configure your API key in Settings (${settings.selectedProvider} selected)`);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setTargetText('');
    setThinkingContent('');
    setAlternatives([]);
    setShowAlternatives(false);
    setOriginalTranslation('');

    let resolvedSourceLang = sourceLang;

    if (sourceLang === 'auto') {
      try {
        const detectionPrompt = buildDetectionPrompt(sourceText.slice(0, 200));
        resolvedSourceLang = await detectLanguage(
          config.baseUrl,
          config.apiKey,
          detectionPrompt
        );
      } catch {
        resolvedSourceLang = 'en';
      }
    }

    const [customInstructions, glossary] = await Promise.all([
      getSetting('customInstructions') as Promise<string | undefined>,
      getSetting('glossary') as Promise<string | undefined>
    ]);

    const systemPrompt = buildSystemPrompt(
      mode,
      resolvedSourceLang,
      targetLang,
      style,
      customStyle,
      customInstructions || undefined,
      glossary || undefined
    );

    const userPrompt = buildUserPrompt(
      mode,
      resolvedSourceLang,
      targetLang,
      sourceText
    );

    let fullResponse = '';
    let thinkingContent = '';
    let lastUsage: TokenUsage | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        streamTranslate({
          apiBaseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.modelId,
          systemPrompt,
          userPrompt,
          supportsThinking: config.supportsThinking && settings.thinkingEnabled !== false,
          signal: abortControllerRef.current!.signal,
          callbacks: {
            onChunk: (text) => {
              fullResponse += text;
              setTargetText(removeEndMarker(fullResponse));
            },
            onThinking: (text) => {
              thinkingContent = text;
              setThinkingContent(text);
            },
            onDone: (usage) => {
              lastUsage = usage;
              resolve();
            },
            onError: (error) => reject(error)
          }
        });
      });

      if (lastUsage) {
        await addTokenUsage(lastUsage.total_tokens);
        await setLastUsage(lastUsage.total_tokens);
      }

      await addToHistory({
        sourceText,
        targetText: removeEndMarker(fullResponse),
        sourceLang: resolvedSourceLang,
        targetLang,
        mode,
        style,
        customStyle: style === 'custom' ? customStyle : undefined,
        timestamp: Date.now(),
        isFavorite: false,
        thinkingContent: thinkingContent || undefined
      });
    } catch (error) {
      if ((error as Error).message !== 'Translation cancelled') {
        const errorMessage = (error as Error).message || 'Translation failed';
        setTranslationError(errorMessage);
        console.error('Translation error:', error);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [
    sourceText,
    sourceLang,
    targetLang,
    mode,
    style,
    customStyle,
    settings,
    getApiConfig,
    setTargetText,
    setThinkingContent,
    setIsStreaming,
    setTranslationError,
    addToHistory
  ]);

  const fetchAlternatives = useCallback(async () => {
    const config = getApiConfig();
    if (!sourceText.trim() || !config?.apiKey || !targetText.trim()) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoadingAlternatives(true);
    setAlternatives([]);
    setShowAlternatives(true);
    setOriginalTranslation(targetText);

    let resolvedSourceLang = sourceLang;
    if (sourceLang === 'auto') {
      try {
        const detectionPrompt = buildDetectionPrompt(sourceText.slice(0, 200));
        resolvedSourceLang = await detectLanguage(
          config.baseUrl,
          config.apiKey,
          detectionPrompt,
          config.modelId
        );
      } catch {
        resolvedSourceLang = 'en';
      }
    }

    const [customInstructions, glossary] = await Promise.all([
      getSetting('customInstructions') as Promise<string | undefined>,
      getSetting('glossary') as Promise<string | undefined>
    ]);

    const systemPrompt = buildAlternativeSystemPrompt(
      resolvedSourceLang,
      targetLang,
      style,
      customStyle,
      customInstructions || undefined,
      glossary || undefined
    );

    const userPrompt = buildAlternativeUserPrompt(
      sourceText,
      targetText,
      resolvedSourceLang,
      targetLang
    );

    let fullResponse = '';
    let lastUsage: TokenUsage | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        streamTranslate({
          apiBaseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.modelId,
          systemPrompt,
          userPrompt,
          supportsThinking: false,
          signal: abortControllerRef.current!.signal,
          callbacks: {
            onChunk: (text) => {
              fullResponse += text;
              const alternatives = parseAlternatives(fullResponse);
              setAlternatives(alternatives);
            },
            onDone: (usage) => {
              lastUsage = usage;
              resolve();
            },
            onError: (error) => reject(error)
          }
        });
      });

      if (lastUsage) {
        await addTokenUsage(lastUsage.total_tokens);
        await setLastUsage(lastUsage.total_tokens);
      }
    } catch (error) {
      if ((error as Error).message !== 'Translation cancelled') {
        console.error('Alternatives error:', error);
      }
    } finally {
      setIsLoadingAlternatives(false);
      abortControllerRef.current = null;
    }
  }, [
    sourceText,
    sourceLang,
    targetLang,
    style,
    customStyle,
    settings,
    targetText,
    getApiConfig,
    setAlternatives,
    setShowAlternatives,
    setIsLoadingAlternatives
  ]);

  return { translate, fetchAlternatives, stopTranslation };
}