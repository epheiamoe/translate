import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveSetting, getSetting } from '../../lib/db';
import './StyleCustomization.css';

interface CSSVariables {
  '--color-primary': string;
  '--color-primary-hover': string;
  '--color-bg': string;
  '--color-bg-secondary': string;
  '--color-bg-tertiary': string;
  '--color-border': string;
  '--color-text': string;
  '--color-text-secondary': string;
  '--color-error': string;
  '--color-warning': string;
  '--font-size-base': string;
  '--radius-sm': string;
  '--radius-md': string;
  '--radius-lg': string;
  '--transition-fast': string;
}

const DEFAULT_VARIABLES: CSSVariables = {
  '--color-primary': '#0f30e0',
  '--color-primary-hover': '#2548eb',
  '--color-bg': '#ffffff',
  '--color-bg-secondary': '#f5f5f5',
  '--color-bg-tertiary': '#ebebeb',
  '--color-border': '#e0e0e0',
  '--color-text': '#1a1a1a',
  '--color-text-secondary': '#666666',
  '--color-error': '#ef4444',
  '--color-warning': '#f59e0b',
  '--font-size-base': '16px',
  '--radius-sm': '4px',
  '--radius-md': '8px',
  '--radius-lg': '12px',
  '--transition-fast': '0.15s'
};

const PRESETS = {
  light: {
    name: 'Light',
    variables: { ...DEFAULT_VARIABLES }
  },
  dark: {
    name: 'Dark',
    variables: {
      '--color-primary': '#6366f1',
      '--color-primary-hover': '#818cf8',
      '--color-bg': '#0f0f0f',
      '--color-bg-secondary': '#1a1a1a',
      '--color-bg-tertiary': '#262626',
      '--color-border': '#333333',
      '--color-text': '#f5f5f5',
      '--color-text-secondary': '#a3a3a3',
      '--color-error': '#f87171',
      '--color-warning': '#fbbf24',
      '--font-size-base': '16px',
      '--radius-sm': '4px',
      '--radius-md': '8px',
      '--radius-lg': '12px',
      '--transition-fast': '0.15s'
    }
  },
  purple: {
    name: 'Purple',
    variables: {
      '--color-primary': '#8b5cf6',
      '--color-primary-hover': '#a78bfa',
      '--color-bg': '#faf5ff',
      '--color-bg-secondary': '#f3e8ff',
      '--color-bg-tertiary': '#e9d5ff',
      '--color-border': '#d8b4fe',
      '--color-text': '#1a1a1a',
      '--color-text-secondary': '#6b21a8',
      '--color-error': '#ef4444',
      '--color-warning': '#f59e0b',
      '--font-size-base': '16px',
      '--radius-sm': '4px',
      '--radius-md': '8px',
      '--radius-lg': '12px',
      '--transition-fast': '0.15s'
    }
  }
};

const COLOR_VARS: Array<{ key: keyof CSSVariables; label: string }> = [
  { key: '--color-primary', label: 'Primary Color' },
  { key: '--color-primary-hover', label: 'Primary Hover' },
  { key: '--color-bg', label: 'Background' },
  { key: '--color-bg-secondary', label: 'Secondary BG' },
  { key: '--color-bg-tertiary', label: 'Tertiary BG' },
  { key: '--color-border', label: 'Border' },
  { key: '--color-text', label: 'Text' },
  { key: '--color-text-secondary', label: 'Secondary Text' },
  { key: '--color-error', label: 'Error' },
  { key: '--color-warning', label: 'Warning' }
];

interface StyleSettings {
  cssVariables: CSSVariables;
  customCSS: string;
}

interface StyleCustomizationProps {
  onClose: () => void;
}

export function StyleCustomization({ onClose }: StyleCustomizationProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'docs'>('basic');
  const [cssVariables, setCssVariables] = useState<CSSVariables>(DEFAULT_VARIABLES);
  const [customCSS, setCustomCSS] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStyleSettings();
  }, []);

  const loadStyleSettings = async () => {
    try {
      const savedVars = await getSetting('cssVariables');
      const savedCSS = await getSetting('customCSS');
      if (savedVars && typeof savedVars === 'object') {
        setCssVariables(savedVars as unknown as CSSVariables);
      }
      if (typeof savedCSS === 'string') {
        setCustomCSS(savedCSS);
      }
    } catch (e) {
      console.error('Failed to load style settings:', e);
    }
  };

  const applyStyles = (vars: CSSVariables, css: string) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    
    let customStyleEl = document.getElementById('custom-user-styles');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'custom-user-styles';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = css;
  };

  const handleApply = async () => {
    setIsSaving(true);
    try {
      await saveSetting('cssVariables', cssVariables as unknown as Record<string, string>);
      await saveSetting('customCSS', customCSS);
      applyStyles(cssVariables, customCSS);
    } catch (e) {
      console.error('Failed to save style settings:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreset = (preset: keyof typeof PRESETS) => {
    setCssVariables(PRESETS[preset].variables);
  };

  const handleReset = () => {
    setCssVariables(DEFAULT_VARIABLES);
    setCustomCSS('');
    applyStyles(DEFAULT_VARIABLES, '');
  };

  const handleVariableChange = (key: keyof CSSVariables, value: string) => {
    setCssVariables(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="style-customization-overlay" onClick={onClose}>
      <div className="style-customization" onClick={e => e.stopPropagation()}>
        <div className="sc-header">
          <h2>{t('styleCustomization.title')}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="sc-tabs">
          <button 
            className={`sc-tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            {t('styleCustomization.basic')}
          </button>
          <button 
            className={`sc-tab ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            {t('styleCustomization.advanced')}
          </button>
          <button 
            className={`sc-tab ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('docs')}
          >
            {t('styleCustomization.docs')}
          </button>
        </div>

        <div className="sc-content">
          {activeTab === 'basic' && (
            <div className="basic-panel">
              <div className="presets-row">
                <span className="presets-label">{t('styleCustomization.presets')}:</span>
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button 
                    key={key} 
                    className="preset-btn"
                    onClick={() => handlePreset(key as keyof typeof PRESETS)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="variables-grid">
                {COLOR_VARS.map(({ key, label }) => (
                  <div key={key} className="var-row">
                    <label>{label}</label>
                    <div className="var-input-group">
                      <input
                        type="color"
                        value={cssVariables[key]}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={cssVariables[key]}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        className="text-input"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="preview-box">
                <span className="preview-label">{t('styleCustomization.preview')}:</span>
                <div 
                  className="preview-card"
                  style={{ 
                    background: cssVariables['--color-bg'],
                    borderColor: cssVariables['--color-border'],
                    color: cssVariables['--color-text']
                  }}
                >
                  <button 
                    className="preview-primary-btn"
                    style={{ 
                      background: cssVariables['--color-primary'],
                      color: '#fff'
                    }}
                  >
                    Primary Button
                  </button>
                  <span 
                    className="preview-secondary"
                    style={{ color: cssVariables['--color-text-secondary'] }}
                  >
                    Secondary text preview
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="advanced-panel">
              <p className="advanced-desc">
                {t('styleCustomization.advancedDesc')}
              </p>
              <textarea
                className="css-textarea"
                value={customCSS}
                onChange={(e) => setCustomCSS(e.target.value)}
                placeholder={t('styleCustomization.cssPlaceholder')}
                spellCheck={false}
              />
              <div className="advanced-hints">
                <p>{t('styleCustomization.hints')}:</p>
                <pre>{`/* Example:
.dark-mode {
  --color-bg: #0f0f0f;
  --color-text: #f5f5f5;
}
.custom-font {
  font-family: 'Your Font', sans-serif;
}
*/`}</pre>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="docs-panel">
              <h3>{t('styleCustomization.cssVarsDoc')}</h3>
              <p className="docs-intro">{t('styleCustomization.docsIntro')}</p>
              
              <table className="vars-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Default</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {COLOR_VARS.map(({ key, label }) => (
                    <tr key={key}>
                      <td><code>{key}</code></td>
                      <td><code>{DEFAULT_VARIABLES[key]}</code></td>
                      <td>{label}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><code>--font-size-base</code></td>
                    <td><code>16px</code></td>
                    <td>Base font size</td>
                  </tr>
                  <tr>
                    <td><code>--radius-sm</code></td>
                    <td><code>4px</code></td>
                    <td>Small border radius</td>
                  </tr>
                  <tr>
                    <td><code>--radius-md</code></td>
                    <td><code>8px</code></td>
                    <td>Medium border radius</td>
                  </tr>
                  <tr>
                    <td><code>--radius-lg</code></td>
                    <td><code>12px</code></td>
                    <td>Large border radius</td>
                  </tr>
                  <tr>
                    <td><code>--transition-fast</code></td>
                    <td><code>0.15s</code></td>
                    <td>Fast transition duration</td>
                  </tr>
                </tbody>
              </table>

              <h3>{t('styleCustomization.usage')}</h3>
              <pre className="usage-code">{`/* Override in Advanced mode */
:root {
  --color-primary: #8b5cf6;
  --font-size-base: 18px;
}

/* Or use dark mode */
.dark-mode {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
}`}</pre>
            </div>
          )}
        </div>

        <div className="sc-footer">
          <button className="reset-btn" onClick={handleReset}>
            {t('styleCustomization.reset')}
          </button>
          <div className="footer-right">
            <button className="cancel-btn" onClick={onClose}>
              {t('settings.cancel')}
            </button>
            <button className="save-btn" onClick={handleApply} disabled={isSaving}>
              {isSaving ? t('styleCustomization.saving') : t('styleCustomization.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}