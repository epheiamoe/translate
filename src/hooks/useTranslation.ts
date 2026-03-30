import { useCallback } from 'react';
import { useAppStore } from './useAppStore';
import { buildSystemPrompt, buildUserPrompt, buildDetectionPrompt, getSupportedModels, removeEndMarker } from '../lib/prompts/loadPrompts';
import { streamTranslate, detectLanguage } from '../lib/llmClient';

export function useTranslation() {
  const {
    sourceText,
    targetLang,
    mode,
    style,
    customStyle,
    sourceLang,
    settings,
    setTargetText,
    setThinkingContent,
    setIsStreaming,
    addToHistory
  } = useAppStore();

  const translate = useCallback(async () => {
    if (!sourceText.trim() || !settings.apiKey) {
      return;
    }

    const models = getSupportedModels();
    const currentModel = models[settings.selectedModel];
    
    setIsStreaming(true);
    setTargetText('');
    setThinkingContent('');

    let resolvedSourceLang = sourceLang;
    
    if (sourceLang === 'auto') {
      try {
        const detectionPrompt = buildDetectionPrompt(sourceText.slice(0, 200));
        resolvedSourceLang = await detectLanguage(
          settings.apiBaseUrl,
          settings.apiKey,
          detectionPrompt
        );
      } catch {
        resolvedSourceLang = 'en';
      }
    }

    const systemPrompt = buildSystemPrompt(
      mode,
      resolvedSourceLang,
      targetLang,
      style,
      customStyle
    );

    const userPrompt = buildUserPrompt(
      mode,
      resolvedSourceLang,
      targetLang,
      sourceText
    );

    let fullResponse = '';
    let thinkingContent = '';

    await new Promise<void>((resolve, reject) => {
      streamTranslate(
        settings.apiBaseUrl,
        settings.apiKey,
        settings.selectedModel,
        systemPrompt,
        userPrompt,
        currentModel?.supports_thinking || false,
        {
          onChunk: (text) => {
            fullResponse += text;
            setTargetText(removeEndMarker(fullResponse));
          },
          onThinking: (text) => {
            thinkingContent = text;
            setThinkingContent(text);
          },
          onDone: () => resolve(),
          onError: (error) => reject(error)
        }
      );
    });

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

    setIsStreaming(false);
  }, [
    sourceText,
    sourceLang,
    targetLang,
    mode,
    style,
    customStyle,
    settings,
    setTargetText,
    setThinkingContent,
    setIsStreaming,
    addToHistory
  ]);

  return { translate };
}