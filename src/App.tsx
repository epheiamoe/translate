import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './hooks/useAppStore';
import { useTranslation as useTranslate } from './hooks/useTranslation';
import { getSupportedLanguages, getSupportedModels, removeEndMarker } from './lib/prompts/loadPrompts';
import { getSetting } from './lib/db';
import { TranslationArea } from './components/TranslationArea/TranslationArea';
import { LanguageSelector } from './components/LanguageSelector/LanguageSelector';
import { StyleSettings } from './components/StyleSettings/StyleSettings';
import { ModelSwitcher } from './components/ModelSwitcher/ModelSwitcher';
import { HistoryPanel } from './components/HistoryPanel/HistoryPanel';
import { ThinkingChain } from './components/ThinkingChain/ThinkingChain';
import { Settings } from './components/Settings/Settings';
import { DocumentTranslation } from './components/DocumentTranslation';
import { StyleCustomization } from './components/StyleCustomization/StyleCustomization';
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
    setActiveTab
  } = useAppStore();

  const { translate } = useTranslate();
  const { t } = useTranslation();
  
  const TABS = [
    { id: 'translate' as const, label: t('tabs.translate') },
    { id: 'explain' as const, label: t('tabs.explain') },
    { id: 'doc' as const, label: t('tabs.docTranslate') }
  ];
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showStyleCustomization, setShowStyleCustomization] = useState(false);
  const languages = getSupportedLanguages();
  const models = getSupportedModels();
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
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
  }, []);

  const handleTabChange = (tab: 'translate' | 'explain' | 'doc') => {
    setActiveTab(tab);
    if (tab === 'explain') {
      setMode('parsing');
    } else {
      setMode('translation');
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      const currentIndex = TABS.findIndex(t => t.id === activeTab);
      
      if (diff > 0 && currentIndex < TABS.length - 1) {
        setActiveTab(TABS[currentIndex + 1].id);
      } else if (diff < 0 && currentIndex > 0) {
        setActiveTab(TABS[currentIndex - 1].id);
      }
    }
  }, [activeTab, setActiveTab]);

  const handleSwapLanguages = () => {
    if (sourceLang !== 'auto') {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
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

  const showThinking = thinkingContent && models[settings.selectedModel]?.supports_thinking;

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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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

            <button 
              className="swap-btn"
              onClick={handleSwapLanguages}
              disabled={sourceLang === 'auto' || isStreaming}
              aria-label={t('buttons.swap')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </button>

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
              </div>
              {activeTab === 'explain' ? (
                <div className="target-result markdown-result">
                  {useAppStore.getState().targetText ? (
                    <MarkdownRenderer content={removeEndMarker(useAppStore.getState().targetText)} />
                  ) : (
                    <div className="placeholder-text">
                      {t('explain.resultPlaceholder')}
                    </div>
                  )}
                </div>
              ) : (
                <TranslationArea
                  value={useAppStore.getState().targetText}
                  onChange={() => {}}
                  placeholder={t('translation.resultPlaceholder')}
                  disabled={true}
                  readOnly={true}
                />
              )}
              {showThinking && (
                <ThinkingChain content={thinkingContent} />
              )}
              <button 
                className="translate-btn"
                onClick={translate}
                disabled={!useAppStore.getState().sourceText.trim() || isStreaming || !settings.apiKey}
              >
                {isStreaming ? (
                  <>
                    <span className="spinner"></span>
                    {activeTab === 'explain' ? t('explain.explaining') : t('translation.translating')}
                  </>
                ) : (
                  activeTab === 'explain' ? t('explain.explain') : t('translation.translate')
                )}
              </button>
            </div>
          </div>
        </main>
      );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">{t('app.title')}</h1>
        <div className="header-actions">
          <ModelSwitcher 
            currentModel={settings.selectedModel}
            models={Object.fromEntries(
              Object.entries(models).map(([key, model]) => [
                key,
                { name: model.name, supports_thinking: model.supports_thinking }
              ])
            )}
            onSelect={(model) => useAppStore.getState().setSettings({ selectedModel: model })}
          />
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

      {!settings.apiKey && (
        <div className="api-key-warning">
          <p>{t('warnings.apiKeyNeeded')}</p>
          <button onClick={() => setShowSettings(true)}>{t('warnings.openSettings')}</button>
        </div>
      )}
    </div>
  );
}

export default App;