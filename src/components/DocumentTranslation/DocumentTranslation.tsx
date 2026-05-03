import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../hooks/useAppStore';
import {
  buildDocSystemPrompt,
  buildDocUserPrompt,
  buildUserPromptContinue,
  checkTranslationComplete,
  removeEndMarker,
  getBuiltInProviders,
  getModelsForProvider,
  getSupportedLanguages,
  resolveModelConfig,
  getModelMaxContext
} from '../../lib/prompts/loadPrompts';
import { streamTranslate } from '../../lib/llmClient';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './DocumentTranslation.css';

// TODO: Implement proper tokenizer for accurate token counting
// Current estimation uses: characters / 3.5 ≈ tokens
// When implementing, consider:
// - Different tokenizers for different models (cl100k_base for GPT-4, etc.)
// - Store tokenizer configuration per custom model
// - Use tiktoken or similar library for accurate counting

interface ParsedContent {
  blocks: ContentBlock[];
  plainText: string;
}

interface ContentBlock {
  type: 'text' | 'code';
  content: string;
}

function parseMarkdown(text: string): ParsedContent {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /^(```[\s\S]*?```)/gm;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index).trim();
      if (textPart) {
        blocks.push({ type: 'text', content: textPart });
      }
    }
    blocks.push({ type: 'code', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      blocks.push({ type: 'text', content: remaining });
    }
  }

  if (blocks.length === 0 && text.trim()) {
    blocks.push({ type: 'text', content: text.trim() });
  }

  return {
    blocks,
    plainText: text
  };
}

export function DocumentTranslation() {
  const {
    settings,
    docSourceText,
    docTargetText,
    docSourceLang,
    docTargetLang,
    docIsStreaming,
    docProgress,
    setDocSourceText,
    setDocTargetText,
    setDocSourceLang,
    setDocTargetLang,
    setDocIsStreaming,
    setDocProgress,
    appendDocTargetText
  } = useAppStore();

  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [showFullscreenResult, setShowFullscreenResult] = useState(false);

  const { t } = useTranslation();

  const languages = getSupportedLanguages();
  const builtInProviders = getBuiltInProviders();
  const customProviders = settings.customProviders || [];
  const currentProviderModels = getModelsForProvider(settings.selectedProvider, customProviders);
  const models = Object.fromEntries(
    currentProviderModels.map(m => [m.id, { name: m.name, supports_thinking: m.supportsThinking }])
  );

  const getApiConfig = () => {
    return resolveModelConfig(settings.selectedProvider, settings.selectedModel, customProviders);
  };

  const apiConfig = getApiConfig();
  const providerApiKeys = settings.providerApiKeys || {};
  const apiKey = apiConfig ? (providerApiKeys[settings.selectedProvider] || '') : '';

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;
    
    setIsLoadingUrl(true);
    setUrlError('');
    setDocTargetText('');
    
    try {
      const targetUrl = urlInput.trim();
      const encodedUrl = encodeURIComponent(targetUrl);
      const fetchUrl = `https://r.jina.ai/${encodedUrl}`;
      console.log('Fetching URL:', fetchUrl);
      
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      
      if (settings.jinaApiKey) {
        headers['Authorization'] = `Bearer ${settings.jinaApiKey}`;
      }
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers
      });
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.data?.content || data.content || '';
      
      if (!content) {
        setUrlError('Failed to extract content from response');
        return;
      }
      
      setDocSourceText(content);
      setIsMarkdown(true);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const isMd = file.name.toLowerCase().endsWith('.md');
    setIsMarkdown(isMd);
    setDocTargetText('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setDocSourceText(text);
    };
    reader.readAsText(file);
  }, [setDocSourceText]);

  const handleTranslate = async () => {
    if (!docSourceText.trim() || !apiKey || !apiConfig) return;
    
    setDocTargetText('');
    setDocIsStreaming(true);
    setShowFullscreenResult(true);
    setDocProgress(t('docTranslation.starting'));
    
    const sourceLang = docSourceLang === 'auto' ? 'en' : docSourceLang;
    const systemPrompt = buildDocSystemPrompt(sourceLang, docTargetLang, settings.defaultStyle);
    
    const parsed = isMarkdown ? parseMarkdown(docSourceText) : null;
    const textToTranslate = parsed ? parsed.plainText : docSourceText;
    
    let fullResponse = '';
    let isComplete = false;
    let continuationCount = 0;
    const maxContinuations = 10;
    
    const tryTranslate = async (text: string, isContinuation: boolean = false) => {
      let userPrompt: string;
      
      if (isContinuation) {
        userPrompt = buildUserPromptContinue(
          fullResponse.slice(-50),
          text
        );
      } else {
        userPrompt = buildDocUserPrompt(sourceLang, docTargetLang, text);
      }
      
      await new Promise<void>((resolve, reject) => {
        streamTranslate({
          apiBaseUrl: apiConfig!.baseUrl,
          apiKey: apiKey,
          model: apiConfig!.modelId,
          systemPrompt,
          userPrompt,
          supportsThinking: apiConfig!.supportsThinking,
          callbacks: {
            onChunk: (chunk) => {
              fullResponse += chunk;
              setDocTargetText(fullResponse);
            },
            onThinking: () => {},
            onDone: () => {
              isComplete = checkTranslationComplete(fullResponse);
              resolve();
            },
            onError: (err) => reject(err)
          }
        });
      });
    };
    
    try {
      await tryTranslate(textToTranslate);
      
      while (!isComplete && continuationCount < maxContinuations) {
        continuationCount++;
        setDocProgress(`${t('docTranslation.incomplete', { current: continuationCount, max: maxContinuations })}`);
        
        const cleanedResponse = removeEndMarker(fullResponse);
        const lastChar = cleanedResponse.slice(-1);
        
        await tryTranslate('', true);
      }
      
      if (!isComplete) {
        setDocProgress(t('docTranslation.warning'));
      } else {
        setDocProgress(t('docTranslation.complete'));
      }
    } catch (err) {
      setDocProgress(t('docTranslation.error', { message: err instanceof Error ? err.message : 'Translation failed' }));
    } finally {
      setDocIsStreaming(false);
    }
  };

  const handleDownload = () => {
    const content = removeEndMarker(docTargetText);
    const mimeType = isMarkdown ? 'text/markdown' : 'text/plain';
    const extension = isMarkdown ? '.md' : '.txt';
    const filename = `translation${extension}`;
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const estimatedTokens = Math.ceil(docSourceText.length / 3.5);
  const maxContext = getModelMaxContext(settings.selectedModel);
  const isTooLong = estimatedTokens > maxContext;

  return (
    <div className="doc-translation">
      <div className="doc-header">
        <h2 className="doc-title">{t('docTranslation.title')}</h2>
      </div>

      <div className="doc-input-section">
        <div className="url-input-row">
          <input
            type="url"
            className="url-input"
            placeholder={t('docTranslation.urlPlaceholder')}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
          />
          <button 
            className="fetch-btn"
            onClick={handleUrlFetch}
            disabled={isLoadingUrl || !urlInput.trim()}
          >
            {isLoadingUrl ? t('docTranslation.fetching') : t('docTranslation.fetch')}
          </button>
        </div>
        
        {urlError && <div className="error-message">{urlError}</div>}
        
        <div className="divider">
          <span>{t('docTranslation.orUpload')}</span>
        </div>
        
        <div className="file-upload-row">
          <label className="file-upload-label">
            <input
              type="file"
              accept=".txt,.md"
              onChange={handleFileUpload}
              className="file-input"
            />
            <span className="file-upload-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {t('docTranslation.uploadFile')}
            </span>
          </label>
          
          {docSourceText && (
            <span className="file-info">
              {isMarkdown ? 'Markdown' : 'TXT'} - {docSourceText.length} chars (~{estimatedTokens} tokens)
            </span>
          )}
        </div>
        
        {isTooLong && docSourceText && (
          <div className="warning-message">
            {t('docTranslation.warning', { maxContext: maxContext.toLocaleString() })}
          </div>
        )}
      </div>

      <div className="doc-language-row">
        <div className="lang-select-group">
          <label>{t('docTranslation.source')}</label>
          <select
            value={docSourceLang}
            onChange={(e) => setDocSourceLang(e.target.value)}
            className="lang-select"
          >
            <option value="auto">{t('languageSelector.autoDetect')}</option>
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        
        <div className="lang-select-group">
          <label>{t('docTranslation.target')}</label>
          <select
            value={docTargetLang}
            onChange={(e) => setDocTargetLang(e.target.value)}
            className="lang-select"
          >
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {docSourceText && (
        <>
          <div className="doc-preview">
            <div className="preview-label">{t('docTranslation.preview')}</div>
            <div className="preview-content">
              {docSourceText.slice(0, 500)}
              {docSourceText.length > 500 && '...'}
            </div>
          </div>

          <button
            className="translate-doc-btn"
            onClick={handleTranslate}
            disabled={docIsStreaming || !apiKey || isTooLong}
          >
            {docIsStreaming ? (
              <>
                <span className="spinner"></span>
                {t('docTranslation.translating')}
              </>
            ) : (
              t('docTranslation.translateDoc')
            )}
          </button>
        </>
      )}

      {showFullscreenResult && (
        <div className="fullscreen-result-overlay">
          <div className="fullscreen-result-header">
            <button className="fullscreen-result-close" onClick={() => setShowFullscreenResult(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h3>{t('docTranslation.translationResult')}</h3>
            <button className="download-btn" onClick={handleDownload}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t('docTranslation.download', { type: isMarkdown ? 'MD' : 'TXT' })}
            </button>
          </div>
          <div className="fullscreen-result-content">
            {docProgress && (
              <div className="progress-message">{docProgress}</div>
            )}
            {docTargetText ? (
              isMarkdown ? (
                <MarkdownRenderer content={removeEndMarker(docTargetText)} />
              ) : (
                <pre className="plain-text-result">{removeEndMarker(docTargetText)}</pre>
              )
            ) : (
              <div className="placeholder-text">{t('docTranslation.translating')}</div>
            )}
          </div>
        </div>
      )}

      {!showFullscreenResult && docTargetText && (
        <div className="doc-result">
          <div className="result-header">
            <span className="result-label">{t('docTranslation.result')}</span>
            <div className="result-actions">
              <button className="icon-btn" onClick={() => {
                navigator.clipboard.writeText(removeEndMarker(docTargetText));
              }} title={t('buttons.copy')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button className="icon-btn" onClick={() => setShowFullscreenResult(true)} title={t('buttons.fullscreen')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
              <button className="download-btn" onClick={handleDownload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {t('docTranslation.download', { type: isMarkdown ? 'MD' : 'TXT' })}
              </button>
            </div>
          </div>
          <div className="result-content">
            {isMarkdown ? (
              <MarkdownRenderer content={docTargetText} />
            ) : (
              <pre className="plain-text-result">{docTargetText}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}