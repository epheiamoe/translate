import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, CustomModel } from '../../hooks/useAppStore';
import { getSupportedLanguages, getSupportedModels } from '../../lib/prompts/loadPrompts';
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
  const models = getSupportedModels();

  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [selectedModel, setSelectedModel] = useState(settings.selectedModel);
  const [defaultSourceLang, setDefaultSourceLang] = useState(settings.defaultSourceLang);
  const [defaultTargetLang, setDefaultTargetLang] = useState(settings.defaultTargetLang);
  const [defaultMode, setDefaultMode] = useState(settings.defaultMode);
  const [defaultStyle, setDefaultStyle] = useState(settings.defaultStyle);
  const [customLanguages, setCustomLanguages] = useState(settings.customLanguages);
  const [customModels, setCustomModels] = useState(settings.customModels);
  const [jinaApiKey, setJinaApiKey] = useState(settings.jinaApiKey);
  const [newLangName, setNewLangName] = useState('');
  const [newLangSuffix, setNewLangSuffix] = useState('');
  
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelMaxContext, setNewModelMaxContext] = useState('128000');
  const [newModelSupportsThinking, setNewModelSupportsThinking] = useState(false);

  const { t } = useTranslation();

  const handleSave = async () => {
    const newSettings = {
      apiBaseUrl,
      apiKey,
      selectedModel,
      defaultSourceLang,
      defaultTargetLang,
      defaultMode,
      defaultStyle,
      customLanguages,
      customModels,
      jinaApiKey
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

  const handleAddCustomModel = () => {
    if (newModelName.trim() && newModelId.trim()) {
      const model: CustomModel = {
        id: newModelId.trim(),
        name: newModelName.trim(),
        apiType: 'openai',
        maxContext: parseInt(newModelMaxContext) || 128000,
        supportsThinking: newModelSupportsThinking
      };
      setCustomModels([...customModels, model]);
      setNewModelName('');
      setNewModelId('');
      setNewModelMaxContext('128000');
      setNewModelSupportsThinking(false);
    }
  };

  const handleRemoveCustomModel = (id: string) => {
    setCustomModels(customModels.filter(m => m.id !== id));
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
              <label className="form-label">{t('settings.apiBaseUrl')}</label>
              <input
                type="text"
                className="form-input"
                value={apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.apiKey')}</label>
              <input
                type="password"
                className="form-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.model')}</label>
              <select
                className="form-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {Object.entries(models).map(([key, model]) => (
                  <option key={key} value={key}>
                    {model.name} ({model.max_context?.toLocaleString() || 128000} {t('settings.tokens')})
                  </option>
                ))}
              </select>
            </div>
          </section>

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
            <h3 className="section-title">{t('settings.customModels')}</h3>
            
            {customModels.length > 0 && (
              <div className="custom-langs-list">
                {customModels.map(m => (
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
                <option value="translation">{t('history.translateMode')}</option>
                <option value="parsing">{t('history.parseMode')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('settings.defaultStyle')}</label>
              <select
                className="form-select"
                value={defaultStyle}
                onChange={e => setDefaultStyle(e.target.value)}
              >
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
        </div>

        <div className="settings-footer">
          <button className="cancel-btn" onClick={onClose}>{t('settings.cancel')}</button>
          <button className="save-btn" onClick={handleSave}>{t('settings.save')}</button>
        </div>
      </div>
    </div>
  );
}