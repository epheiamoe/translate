import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, CustomProvider, CustomModel } from '../../hooks/useAppStore';
import {
  getSupportedLanguages, getBuiltInProviders, getModelsForProvider,
  saveSystemPrompts, saveUserPrompts, resetSystemPrompts, resetUserPrompts, resetAllPrompts,
  getCurrentSystemPrompts, getCurrentUserPrompts
} from '../../lib/prompts/loadPrompts';
import { PromptSettings } from './PromptSettings';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const {
    settings,
    setSettings,
    saveSettingsToDb,
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    setMode,
    setStyle
  } = useAppStore();

  const languages = getSupportedLanguages();
  const builtInProviders = getBuiltInProviders();

  const allProviders = [
    ...Object.entries(builtInProviders).map(([id, p]) => ({
      id,
      name: p.name,
      isBuiltIn: true,
      baseUrl: p.baseUrl,
      modelsCount: p.models.length
    })),
    ...settings.customProviders.map(p => ({
      id: p.id,
      name: p.name,
      isBuiltIn: false,
      baseUrl: p.baseUrl,
      modelsCount: p.models.length
    }))
  ];

  const [selectedProvider, setSelectedProvider] = useState(settings.selectedProvider);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>(settings.providerApiKeys);
  const [defaultSourceLang, setDefaultSourceLang] = useState(settings.defaultSourceLang);
  const [defaultTargetLang, setDefaultTargetLang] = useState(settings.defaultTargetLang);
  const [defaultMode, setDefaultMode] = useState(settings.defaultMode);
  const [defaultStyle, setDefaultStyle] = useState(settings.defaultStyle);
  const [customLanguages, setCustomLanguages] = useState(settings.customLanguages);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(settings.customProviders);
  const [jinaApiKey, setJinaApiKey] = useState(settings.jinaApiKey);
  const [thinkingEnabled, setThinkingEnabled] = useState(settings.thinkingEnabled === true);
  const [newLangName, setNewLangName] = useState('');
  const [newLangSuffix, setNewLangSuffix] = useState('');

  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelMaxContext, setNewModelMaxContext] = useState('128000');
  const [newModelSupportsThinking, setNewModelSupportsThinking] = useState(false);

  const currentProviderModels = getModelsForProvider(selectedProvider, settings.customProviders);

  const { t } = useTranslation();

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const models = getModelsForProvider(providerId, settings.customProviders);
    if (models.length > 0) {
      setSelectedModel(models[0].id);
    }
  };

  const handleSave = async () => {
    const newSettings = {
      selectedProvider,
      selectedModel,
      providerApiKeys,
      defaultSourceLang,
      defaultTargetLang,
      defaultMode,
      defaultStyle,
      customLanguages,
      customProviders,
      jinaApiKey,
      thinkingEnabled
    };

    setSettings(newSettings);
    await saveSettingsToDb();

    setSourceLang(defaultSourceLang);
    setTargetLang(defaultTargetLang);
    setMode(defaultMode);
    setStyle(defaultStyle);

    onClose();
  };

  const handleAddCustomLang = () => {
    if (newLangName.trim() && newLangSuffix.trim()) {
      const id = `custom_${Date.now()}`;
      setCustomLanguages([...customLanguages, { id, name: newLangName, promptSuffix: newLangSuffix }]);
      setNewLangName('');
      setNewLangSuffix('');
    }
  };

  const handleRemoveCustomLang = (id: string) => {
    setCustomLanguages(customLanguages.filter(cl => cl.id !== id));
  };

  const handleAddCustomProvider = () => {
    if (newProviderName.trim() && newProviderBaseUrl.trim()) {
      const provider: CustomProvider = {
        id: `custom_${Date.now()}`,
        name: newProviderName.trim(),
        baseUrl: newProviderBaseUrl.trim(),
        models: []
      };
      setCustomProviders([...customProviders, provider]);
      setNewProviderName('');
      setNewProviderBaseUrl('');
    }
  };

  const handleRemoveCustomProvider = (id: string) => {
    setCustomProviders(customProviders.filter(p => p.id !== id));
    const newKeys = { ...providerApiKeys };
    delete newKeys[id];
    setProviderApiKeys(newKeys);
    if (selectedProvider === id) {
      setSelectedProvider('deepseek');
      setSelectedModel('deepseek-v4-flash');
    }
  };

  const handleAddCustomModel = () => {
    if (newModelName.trim() && newModelId.trim()) {
      const model: CustomModel = {
        id: newModelId.trim(),
        name: newModelName.trim(),
        maxContext: parseInt(newModelMaxContext) || 128000,
        supportsThinking: newModelSupportsThinking
      };
      setCustomProviders(
        customProviders.map(p => {
          if (p.id === selectedProvider) {
            return { ...p, models: [...p.models, model] };
          }
          return p;
        })
      );
      setNewModelName('');
      setNewModelId('');
      setNewModelMaxContext('128000');
      setNewModelSupportsThinking(false);
    }
  };

  const handleRemoveCustomModel = (modelId: string) => {
    setCustomProviders(
      customProviders.map(p => {
        if (p.id === selectedProvider) {
          return { ...p, models: p.models.filter(m => m.id !== modelId) };
        }
        return p;
      })
    );
    if (selectedModel === modelId) {
      const models = getModelsForProvider(selectedProvider, customProviders);
      if (models.length > 0) {
        setSelectedModel(models[0].id);
      }
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">{t('settings.title')}</h2>
          <button className="close-btn" onClick={onClose} aria-label={t('settings.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <h3 className="section-title">{t('settings.apiConfig')}</h3>

            <div className="form-group">
              <label className="form-label">{t('settings.provider')}</label>
              <select
                className="form-select"
                value={selectedProvider}
                onChange={e => handleProviderChange(e.target.value)}
              >
                {allProviders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isBuiltIn ? '' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.apiKey')}</label>
              <input
                type="password"
                className="form-input"
                value={providerApiKeys[selectedProvider] || ''}
                onChange={e => setProviderApiKeys({ ...providerApiKeys, [selectedProvider]: e.target.value })}
                placeholder={t('settings.apiKeyPlaceholder') || 'Enter API key for selected provider'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.model')}</label>
              <select
                className="form-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {currentProviderModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.maxContext?.toLocaleString()} {t('settings.tokens')})
                    {m.supportsThinking ? ' 🤖' : ''}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="section-title">{t('settings.customProviders')}</h3>

            {customProviders.length > 0 && (
              <div className="custom-langs-list">
                {customProviders.map(p => (
                  <div key={p.id} className="custom-lang-item">
                    <span className="custom-lang-name">
                      {p.name} ({p.models.length} models)
                    </span>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveCustomProvider(p.id)}
                      aria-label={t('settings.remove')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-custom-lang">
              <input
                type="text"
                className="form-input"
                placeholder={t('settings.providerName') || 'Provider name'}
                value={newProviderName}
                onChange={e => setNewProviderName(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder={t('settings.baseUrl') || 'Base URL (e.g., https://api.openai.com/v1)'}
                value={newProviderBaseUrl}
                onChange={e => setNewProviderBaseUrl(e.target.value)}
              />
              <button className="add-btn" onClick={handleAddCustomProvider}>
                {t('settings.addProvider')}
              </button>
            </div>
          </section>

          {customProviders.some(p => p.id === selectedProvider) && (
            <section className="settings-section">
              <h3 className="section-title">{t('settings.customModels')}</h3>

              {(() => {
                const currentProvider = customProviders.find(p => p.id === selectedProvider);
                if (!currentProvider) return null;
                return (
                  <>
                    {currentProvider.models.length > 0 && (
                      <div className="custom-langs-list">
                        {currentProvider.models.map(m => (
                          <div key={m.id} className="custom-lang-item">
                            <span className="custom-lang-name">
                              {m.name} ({m.maxContext?.toLocaleString()} {t('settings.tokens')})
                              {m.supportsThinking && ' 🤖'}
                            </span>
                            <button
                              className="remove-btn"
                              onClick={() => handleRemoveCustomModel(m.id)}
                              aria-label={t('settings.remove')}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="add-custom-lang">
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('settings.modelName')}
                        value={newModelName}
                        onChange={e => setNewModelName(e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('settings.modelId')}
                        value={newModelId}
                        onChange={e => setNewModelId(e.target.value)}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder={t('settings.maxContext')}
                        value={newModelMaxContext}
                        onChange={e => setNewModelMaxContext(e.target.value)}
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newModelSupportsThinking}
                          onChange={e => setNewModelSupportsThinking(e.target.checked)}
                        />
                        {t('settings.supportsThinking')}
                      </label>
                      <button className="add-btn" onClick={handleAddCustomModel}>
                        {t('settings.addModel')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          <section className="settings-section">
            <h3 className="section-title">{t('settings.jinaApi')}</h3>
            <p className="section-desc">{t('settings.jinaApiDesc')}</p>

            <div className="form-group">
              <label className="form-label">{t('settings.jinaApiKey')}</label>
              <input
                type="password"
                className="form-input"
                value={jinaApiKey}
                onChange={e => setJinaApiKey(e.target.value)}
                placeholder="Optional - for URL fetching"
              />
            </div>
          </section>

          <section className="settings-section">
            <h3 className="section-title">{t('settings.defaultLangSettings')}</h3>

            <div className="form-group">
              <label className="form-label">{t('settings.defaultSourceLang')}</label>
              <select
                className="form-select"
                value={defaultSourceLang}
                onChange={e => setDefaultSourceLang(e.target.value)}
              >
                <option value="auto">{t('languageSelector.autoDetect')}</option>
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.defaultTargetLang')}</label>
              <select
                className="form-select"
                value={defaultTargetLang}
                onChange={e => setDefaultTargetLang(e.target.value)}
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.defaultMode')}</label>
              <select
                className="form-select"
                value={defaultMode}
                onChange={e => setDefaultMode(e.target.value as 'translation' | 'parsing')}
              >
                <option value="translation">{t('tabs.translate')}</option>
                <option value="parsing">{t('tabs.explain')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.defaultStyle')}</label>
              <select
                className="form-select"
                value={defaultStyle}
                onChange={e => setDefaultStyle(e.target.value)}
              >
                <option value="unspecified">{t('styleSettings.unspecified')}</option>
                <option value="formal">{t('styleSettings.formal')}</option>
                <option value="casual">{t('styleSettings.casual')}</option>
                <option value="academic">{t('styleSettings.academic')}</option>
                <option value="literary">{t('styleSettings.literary')}</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="section-title">{t('settings.customLanguages')}</h3>

            {customLanguages.length > 0 && (
              <div className="custom-langs-list">
                {customLanguages.map(cl => (
                  <div key={cl.id} className="custom-lang-item">
                    <span className="custom-lang-name">{cl.name}</span>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveCustomLang(cl.id)}
                      aria-label={t('settings.remove')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="add-custom-lang">
              <input
                type="text"
                className="form-input"
                placeholder={t('settings.langName')}
                value={newLangName}
                onChange={e => setNewLangName(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder={t('settings.promptSuffix')}
                value={newLangSuffix}
                onChange={e => setNewLangSuffix(e.target.value)}
              />
              <button className="add-btn" onClick={handleAddCustomLang}>
                {t('settings.add')}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="section-title">{t('settings.thinkingMode') || 'Thinking Mode'}</h3>
            <p className="section-desc">{t('settings.thinkingModeDesc') || 'Enable thinking output for supported models. The AI will show its reasoning process before the final response.'}</p>
            <div className="form-group">
              <label className="form-label">{t('settings.thinkingToggle') || 'Thinking'}</label>
              <div className="toggle-row">
                <button
                  className={`toggle-btn ${thinkingEnabled ? 'active' : ''}`}
                  onClick={() => setThinkingEnabled(!thinkingEnabled)}
                >
                  {thinkingEnabled ? (t('settings.enabled') || 'Enabled') : (t('settings.disabled') || 'Disabled')}
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="section-title">{t('settings.prompts') || 'Prompt Templates'}</h3>
            <p className="section-desc">{t('settings.promptsDesc') || 'Customize system and user prompts for translation, explanation, and more.'}</p>
            <PromptSettings
              onSave={async (system, user) => {
                await saveSystemPrompts(system);
                await saveUserPrompts(user);
              }}
              onReset={async (type) => {
                if (type === 'system') await resetSystemPrompts();
                else if (type === 'user') await resetUserPrompts();
                else await resetAllPrompts();
              }}
              getCurrent={() => ({
                system: getCurrentSystemPrompts(),
                user: getCurrentUserPrompts()
              })}
              labels={{
                systemPrompts: t('settings.systemPrompts') || 'System Prompts',
                userPrompts: t('settings.userPrompts') || 'User Prompts',
                translation: t('settings.promptTranslation') || 'Short Text Translation',
                translation_long: t('settings.promptTranslationLong') || 'Long Text Translation',
                translation_continue: t('settings.promptTranslationContinue') || 'Continue Cut-off Translation',
                parsing: t('settings.promptParsing') || 'Word/Phrase Explanation',
                language_detection: t('settings.promptLanguageDetection') || 'Language Detection',
                doc_translation: t('settings.promptDocTranslation') || 'Document Translation',
                alternative_translation: t('settings.promptAlternativeTranslation') || 'Alternative Translations',
                edit: t('settings.edit') || 'Edit',
                save: t('settings.save') || 'Save',
                saving: t('settings.saving') || 'Saving...',
                cancel: t('settings.cancel') || 'Cancel',
                apply: t('settings.apply') || 'Apply',
                editing: t('settings.editing') || 'Editing',
                resetCurrent: t('settings.resetCurrent') || 'Reset Current Tab',
                resetAll: t('settings.resetAll') || 'Reset All to Defaults'
              }}
              templateVars={{
                translation: '{{source_lang}} {{target_lang}} {{style}} {{text}} {{custom_style}}',
                translation_long: '{{source_lang}} {{target_lang}} {{style}} {{text}} {{custom_style}}',
                translation_continue: '{{last_content}} {{remaining_text}}',
                parsing: '{{source_lang}} {{target_lang}} {{text}}',
                language_detection: '{{text}}',
                doc_translation: '{{source_lang}} {{target_lang}} {{style}} {{text}} {{custom_style}}',
                alternative_translation: '{{source_lang}} {{target_lang}} {{style}} {{text}} {{custom_style}}'
              }}
            />
          </section>

          <button className="save-btn" onClick={handleSave}>
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}