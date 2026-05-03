import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './hooks/useAppStore';
import { useTranslation as useTranslate } from './hooks/useTranslation';
import { getSupportedLanguages, getBuiltInProviders, getModelsForProvider, removeEndMarker, loadPromptsFromDB, getModelConfig } from './lib/prompts/loadPrompts';
import { getSetting, getTokenStats, getLastUsage, TokenStats } from './lib/db';
import { TranslationArea } from './components/TranslationArea/TranslationArea';
import { LanguageSelector } from './components/LanguageSelector/LanguageSelector';
import { StyleSettings } from './components/StyleSettings/StyleSettings';
import { ModelSwitcher } from './components/ModelSwitcher/ModelSwitcher';
import { ProviderSwitcher } from './components/ProviderSwitcher/ProviderSwitcher';
import { HistoryPanel } from './components/HistoryPanel/HistoryPanel';
import { Settings } from './components/Settings/Settings';
import { DocumentTranslation } from './components/DocumentTranslation';
import { StyleCustomization } from './components/StyleCustomization/StyleCustomization';
import { CustomInstructions } from './components/CustomInstructions/CustomInstructions';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import './styles/global.css';
import './App.css';

function App() {
  const {
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    mode,
    setMode,
    isStreaming,
    thinkingContent,
    showHistory,
    setShowHistory,
    showSettings,
    setShowSettings,
    settings,
    loadHistory,
    loadFavorites,
    loadSettingsFromDb,
    activeTab,
    setActiveTab,
    alternatives,
    showAlternatives,
    isLoadingAlternatives,
    setShowAlternatives,
    setTargetText,
    originalTranslation,
    translationError
  } = useAppStore();

  const { translate, fetchAlternatives, stopTranslation } = useTranslate();
  const { t } = useTranslation();

  const safeSettings = {
    ...settings,
    customProviders: Array.isArray(settings.customProviders) ? settings.customProviders : [],
    providerApiKeys: settings.providerApiKeys && typeof settings.providerApiKeys === 'object' ? settings.providerApiKeys : {},
    selectedProvider: settings.selectedProvider || 'deepseek',
    selectedModel: settings.selectedModel || 'deepseek-v4-flash'
  };

  useEffect(() => {
    if (!Array.isArray(safeSettings.customProviders) || Object.keys(safeSettings.providerApiKeys || {}).length === 0) {
      loadSettingsFromDb();
    }
  }, []);

  const TABS = [
    { id: 'translate' as const, label: t('tabs.translate') },
    { id: 'explain' as const, label: t('tabs.explain') },
    { id: 'doc' as const, label: t('tabs.docTranslate') }
  ];

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStyleCustomization, setShowStyleCustomization] = useState(false);
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [showFullscreenResult, setShowFullscreenResult] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [lastTokenUsage, setLastTokenUsage] = useState<number | null>(null);
  const [renderMarkdown, setRenderMarkdown] = useState(activeTab === 'explain');
  const languages = getSupportedLanguages();

  const builtInProviders = getBuiltInProviders();
  const customProviders = safeSettings.customProviders;
  const allProviders = [
    ...Object.entries(builtInProviders).map(([id, p]) => ({
      id,
      name: p.name,
      isBuiltIn: true
    })),
    ...customProviders.map(p => ({
      id: p.id,
      name: p.name,
      isBuiltIn: false
    }))
  ];

  const currentProviderModels = getModelsForProvider(safeSettings.selectedProvider, customProviders);
  const models = Object.fromEntries(
    currentProviderModels.map(m => [m.id, { name: m.name, supports_thinking: m.supportsThinking }])
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash && ['translate', 'explain', 'doc'].includes(hash)) {
      setActiveTab(hash as 'translate' | 'explain' | 'doc');
    }
  }, [setActiveTab]);

  useEffect(() => {
    window.location.hash = `/${activeTab}`;
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.more-menu-container')) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    loadPromptsFromDB();
    loadSettingsFromDb();
    loadHistory();
    loadFavorites();
  }, [loadSettingsFromDb, loadHistory, loadFavorites]);

  useEffect(() => {
    const loadSavedStyles = async () => {
      try {
        const savedVars = await getSetting('cssVariables');
        const savedCSS = await getSetting('customCSS');
        
        if (savedVars && typeof savedVars === 'object') {
          const vars = savedVars as Record<string, string>;
          const root = document.documentElement;
          for (const [key, value] of Object.entries(vars)) {
            root.style.setProperty(key, value);
          }
        }
        
        if (typeof savedCSS === 'string' && savedCSS) {
          let customStyleEl = document.getElementById('custom-user-styles');
          if (!customStyleEl) {
            customStyleEl = document.createElement('style');
            customStyleEl.id = 'custom-user-styles';
            document.head.appendChild(customStyleEl);
          }
          customStyleEl.textContent = savedCSS;
        }
      } catch (e) {
        console.error('Failed to load saved styles:', e);
      }
    };
    loadSavedStyles();
    getLastUsage().then(setLastTokenUsage);
  }, []);

  const handleTabChange = (tab: 'translate' | 'explain' | 'doc') => {
    setActiveTab(tab);
    if (tab === 'explain') {
      setMode('parsing');
    } else {
      setMode('translation');
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang !== 'auto') {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      useAppStore.getState().setSourceText(text);
    } catch (err) {
      console.error('Failed to read clipboard');
    }
  };

  const handleCopy = async () => {
    const targetText = useAppStore.getState().targetText;
    if (targetText) {
      await navigator.clipboard.writeText(targetText);
    }
  };

  const showThinking = thinkingContent && settings.thinkingEnabled !== false;
  const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

  useEffect(() => {
    if (!isStreaming && thinkingContent) {
      setThinkingCollapsed(true);
    }
    if (isStreaming && thinkingContent) {
      setThinkingCollapsed(false);
    }
  }, [isStreaming, thinkingContent]);

  const renderContent = () => {
    switch (activeTab) {
      case 'doc':
        return <DocumentTranslation />;
      case 'translate':
      case 'explain':
      default:
        return (
          <main 
          ref={containerRef}
          className={`app-main ${isMobile ? 'mobile' : 'desktop'}`}
        >
          <div className="translation-container">
            <div className="translation-panel source-panel">
              <div className="panel-header">
                <LanguageSelector
                  label={t('translation.source')}
                  value={sourceLang}
                  onChange={setSourceLang}
                  languages={languages}
                  showAutoOption={true}
                />
                {isMobile && (
                  <button 
                    className="icon-btn swap-btn-inline"
                    onClick={handleSwapLanguages}
                    disabled={isStreaming}
                    aria-label={t('buttons.swap')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                  </button>
                )}
                <button 
                  className="icon-btn paste-btn"
                  onClick={handlePaste}
                  aria-label={t('buttons.paste')}
                  disabled={isStreaming}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                </button>
              </div>
              <TranslationArea
                value={useAppStore.getState().sourceText}
                onChange={(e) => useAppStore.getState().setSourceText(e.target.value)}
                placeholder={activeTab === 'explain' ? t('explain.placeholder') : t('translation.placeholder')}
                disabled={isStreaming}
              />
              <StyleSettings />
            </div>

            {!isMobile && (
              <button 
                className="swap-btn"
                onClick={handleSwapLanguages}
                disabled={isStreaming}
                aria-label={t('buttons.swap')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </button>
            )}

            <div className="translation-panel target-panel">
              <div className="panel-header">
                <LanguageSelector
                  label={t('translation.target')}
                  value={targetLang}
                  onChange={setTargetLang}
                  languages={languages}
                  showAutoOption={false}
                />
                <button 
                  className="icon-btn copy-btn"
                  onClick={handleCopy}
                  aria-label={t('buttons.copy')}
                  disabled={!useAppStore.getState().targetText || isStreaming}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button 
                  className="icon-btn fullscreen-btn"
                  onClick={() => setShowFullscreenResult(true)}
                  aria-label={t('buttons.fullscreen')}
                  disabled={!useAppStore.getState().targetText}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                </button>
                <button 
                  className={`icon-btn ${renderMarkdown ? 'active' : ''}`}
                  onClick={() => setRenderMarkdown(!renderMarkdown)}
                  aria-label={t('buttons.toggleMarkdown')}
                  title={t('buttons.toggleMarkdown')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4z"/>
                    <path d="M4 9h16"/>
                    <path d="M9 20V9"/>
                  </svg>
                </button>
              </div>
              {renderMarkdown ? (
                <div className="target-result markdown-result">
                  {useAppStore.getState().targetText ? (
                    <MarkdownRenderer content={removeEndMarker(useAppStore.getState().targetText)} />
                  ) : (
                    <div className="placeholder-text">
                      {activeTab === 'explain' ? t('explain.resultPlaceholder') : t('translation.resultPlaceholder')}
                    </div>
                  )}
                </div>
              ) : (
                <TranslationArea
                  value={useAppStore.getState().targetText}
                  onChange={() => {}}
                  placeholder={activeTab === 'explain' ? t('explain.resultPlaceholder') : t('translation.resultPlaceholder')}
                  disabled={true}
                  readOnly={true}
                />
              )}
              {showThinking && (
                <div className="thinking-inline">
                  {isStreaming ? (
                    <>
                      <div className="thinking-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.983 21.186a1 1 0 0 1-1.966 0 10 10 0 0 0-8.203-8.203 1 1 0 0 1 0-1.966 10 10 0 0 0 8.203-8.203 1 1 0 0 1 1.966 0 10 10 0 0 0 8.203 8.203 1 1 0 0 1 0 1.966 10 10 0 0 0-8.203 8.203"/>
                        </svg>
                        <span>{t('thinkingChain.title')}</span>
                      </div>
                      <pre className="thinking-content">{thinkingContent}</pre>
                    </>
                  ) : (
                    <button
                      className="thinking-collapsed-btn"
                      onClick={() => setThinkingCollapsed(!thinkingCollapsed)}
                    >
                      <span className="thinking-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.983 21.186a1 1 0 0 1-1.966 0 10 10 0 0 0-8.203-8.203 1 1 0 0 1 0-1.966 10 10 0 0 0 8.203-8.203 1 1 0 0 1 1.966 0 10 10 0 0 0 8.203 8.203 1 1 0 0 1 0 1.966 10 10 0 0 0-8.203 8.203"/>
                        </svg>
                      </span>
                      <span>{thinkingCollapsed ? t('thinkingChain.view') || 'View thinking' : t('thinkingChain.hide') || 'Hide thinking'}</span>
                      <svg className={`thinking-arrow ${thinkingCollapsed ? '' : 'expanded'}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                  )}
                  {!thinkingCollapsed && !isStreaming && (
                    <pre className="thinking-content">{thinkingContent}</pre>
                  )}
                </div>
              )}
              <button
                onClick={translate}
                disabled={!useAppStore.getState().sourceText.trim() || !safeSettings.providerApiKeys[safeSettings.selectedProvider]}
                className={isStreaming ? 'translate-btn is-streaming' : 'translate-btn'}
              >
                <span className="btn-content">
                  {isStreaming && <span className="spinner"></span>}
                  <span className="btn-text">
                    {isStreaming
                      ? (activeTab === 'explain' ? t('explain.explaining') : t('translation.translating'))
                      : (activeTab === 'explain' ? t('explain.explain') : t('translation.translate'))
                    }
                  </span>
                </span>
                <span className="stop-indicator" onClick={(e) => { e.stopPropagation(); stopTranslation(); }}></span>
              </button>
              {translationError && (
                <div className="translation-error">
                  {translationError}
                </div>
              )}
              {lastTokenUsage && !isStreaming && (
                <div className="token-usage-badge">
                  {(() => {
                    const modelCfg = getModelConfig(safeSettings.selectedModel);
                    const tokens = lastTokenUsage;
                    let cost = '';
                    if (modelCfg?.pricing_input && modelCfg?.pricing_output) {
                      const inputCost = (tokens * 0.5 / 1_000_000) * modelCfg.pricing_input;
                      const outputCost = (tokens * 0.5 / 1_000_000) * modelCfg.pricing_output;
                      cost = ` ~$${(inputCost + outputCost).toFixed(6)}`;
                    }
                    return `${tokens.toLocaleString()} tokens${cost}`;
                  })()}
                </div>
              )}
              {!showAlternatives && !isStreaming && useAppStore.getState().targetText && (
                <button
                  className="show-alternatives-btn"
                  onClick={() => {
                    if (alternatives.length > 0) {
                      setShowAlternatives(true);
                    } else {
                      fetchAlternatives();
                    }
                  }}
                >
                  {t('translation.showAlternatives')}
                </button>
              )}
              {isLoadingAlternatives && (
                <div className="alternatives-loading">
                  <span className="spinner"></span>
                  {t('translation.loadingAlternatives')}
                  <button
                    className="alternatives-stop-btn"
                    onClick={stopTranslation}
                    aria-label={t('translation.stop')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="1"/>
                    </svg>
                  </button>
                </div>
              )}
              {showAlternatives && alternatives.length > 0 && (
                <div className="alternatives-container">
                  <div className="alternatives-header">
                    <span>{t('translation.alternativesLabel')}</span>
                    <div className="alternatives-actions">
                      <button
                        className="alternatives-regenerate"
                        onClick={fetchAlternatives}
                        disabled={isLoadingAlternatives}
                        title={t('translation.regenerateAlternatives')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                      </button>
                      <button
                        className="alternatives-close"
                        onClick={() => setShowAlternatives(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="alternatives-list">
                    {originalTranslation && (
                      <div
                        className="alternative-item current"
                        onClick={() => setTargetText(originalTranslation)}
                      >
                        <span className="alternative-number">1.</span>
                        <span className="alternative-text">{originalTranslation}</span>
                      </div>
                    )}
                    {alternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="alternative-item"
                        onClick={() => setTargetText(alt)}
                      >
                        <span className="alternative-number">{(originalTranslation ? 1 : 0) + i + 1}.</span>
                        <span className="alternative-text" data-full={alt}>{alt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      );
    }
  };

  const targetText = useAppStore.getState().targetText;

  return (
<div className="app">
      <header className="app-header">
        <div className="header-actions">
          <ProviderSwitcher
            currentProvider={safeSettings.selectedProvider}
            providers={allProviders}
            onSelect={(providerId) => {
              const newModels = getModelsForProvider(providerId, customProviders);
              const newModel = newModels.length > 0 ? newModels[0].id : '';
              useAppStore.getState().setSettings({
                selectedProvider: providerId,
                selectedModel: newModel
              });
            }}
          />
          <ModelSwitcher
            currentModel={safeSettings.selectedModel}
            models={models}
            onSelect={(model) => useAppStore.getState().setSettings({ selectedModel: model })}
          />
          {isMobile ? (
            <div className="more-menu-container">
              <button
                className="header-btn"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                aria-label={t('common.more')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              {showMoreMenu && (
                <div className="more-dropdown">
                  <button className="more-dropdown-item" onClick={() => { setShowHistory(!showHistory); setShowMoreMenu(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,6 12,12 16,14"/>
                    </svg>
                    <span>{t('history.title')}</span>
                  </button>
                  <button className="more-dropdown-item" onClick={async () => { try { const stats = await getTokenStats(); setTokenStats(stats); setShowStats(true); } catch (e) { console.error('Failed to load token stats:', e); } setShowMoreMenu(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                    <span>{t('tokenStats.title')}</span>
                  </button>
                  <button className="more-dropdown-item" onClick={() => { setShowSettings(!showSettings); setShowMoreMenu(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>{t('settings.title')}</span>
                  </button>
                  <button className="more-dropdown-item" onClick={() => { setShowStyleCustomization(true); setShowMoreMenu(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                    <span>{t('styleCustomization.title')}</span>
                  </button>
                  <button className="more-dropdown-item" onClick={() => { setShowCustomInstructions(true); setShowMoreMenu(false); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>{t('customInstructions.title')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button 
                className="header-btn"
                onClick={() => setShowHistory(!showHistory)}
                aria-label={t('history.title')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </button>
              <button 
                className="header-btn"
                onClick={async () => {
                  try {
                    const stats = await getTokenStats();
                    setTokenStats(stats);
                    setShowStats(true);
                  } catch (e) {
                    console.error('Failed to load token stats:', e);
                  }
                }}
                aria-label={t('tokenStats.title')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </button>
              <button 
                className="header-btn"
                onClick={() => setShowSettings(!showSettings)}
                aria-label={t('settings.title')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              <button 
                className="header-btn"
                onClick={() => setShowStyleCustomization(true)}
                aria-label={t('styleCustomization.title')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </button>
              <button 
                className="header-btn"
                onClick={() => setShowCustomInstructions(true)}
                aria-label={t('customInstructions.title')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="tab-nav">
        <div className="tab-indicator" style={{ 
          transform: `translateX(${TABS.findIndex(t => t.id === activeTab) * 100}%)` 
        }} />
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {renderContent()}

      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} />
      )}

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      {showStyleCustomization && (
        <StyleCustomization onClose={() => setShowStyleCustomization(false)} />
      )}

      {showCustomInstructions && (
        <CustomInstructions onClose={() => setShowCustomInstructions(false)} />
      )}

      {showFullscreenResult && targetText && (
        <div className="fullscreen-result-overlay">
          <div className="fullscreen-result-header">
            <button className="fullscreen-result-close" onClick={() => setShowFullscreenResult(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h3>{activeTab === 'explain' ? t('explain.title') : t('translation.result')}</h3>
          </div>
          <div className="fullscreen-result-content">
            {activeTab === 'explain' ? (
              <MarkdownRenderer content={removeEndMarker(targetText)} />
            ) : (
              <pre className="plain-text-result">{removeEndMarker(targetText)}</pre>
            )}
          </div>
        </div>
      )}

      {showStats && tokenStats && (
        <div className="stats-modal-overlay" onClick={() => setShowStats(false)}>
          <div className="stats-modal" onClick={e => e.stopPropagation()}>
            <div className="stats-modal-header">
              <h3>{t('tokenStats.title')}</h3>
              <button className="icon-btn" onClick={() => setShowStats(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="stats-modal-content">
              <div className="stats-item">
                <span className="stats-label">{t('tokenStats.total')}</span>
                <span className="stats-value">{tokenStats.totalTokens.toLocaleString()}</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">{t('tokenStats.monthly')}</span>
                <span className="stats-value">{tokenStats.monthlyTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!safeSettings.providerApiKeys[safeSettings.selectedProvider] && (
        <div className="api-key-warning">
          <p>{t('warnings.apiKeyNeeded')}</p>
          <button onClick={() => setShowSettings(true)}>{t('warnings.openSettings')}</button>
        </div>
      )}
    </div>
  );
}

export default App;