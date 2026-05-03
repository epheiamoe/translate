import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../hooks/useAppStore';
import './StyleSettings.css';

const PRESET_STYLES = [
  { value: 'unspecified', label: 'Unspecified' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'academic', label: 'Academic' },
  { value: 'literary', label: 'Literary' },
  { value: 'custom', label: 'Custom' }
] as const;

export function StyleSettings() {
  const { t } = useTranslation();
  const { style, setStyle, customStyle, setCustomStyle, isStreaming, settings, setSettings } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const showCustomInput = style === 'custom' || customStyle;

  const handleStyleChange = (newStyle: string) => {
    setStyle(newStyle);
    if (newStyle !== 'custom') {
      setSettings({ defaultStyle: newStyle });
    }
  };

  return (
    <div className="style-settings">
      <button
        className="style-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="style-label">
          Style: <strong>{t('styleSettings.' + (PRESET_STYLES.find(s => s.value === style)?.value || 'custom'))}</strong>
        </span>
        <svg className={`style-arrow ${isExpanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isExpanded && (
        <div className="style-content">
          <div className="style-presets">
            {PRESET_STYLES.map((s) => (
              <button
                key={s.value}
                className={`style-preset-btn ${style === s.value ? 'active' : ''}`}
                onClick={() => handleStyleChange(s.value)}
                disabled={isStreaming}
              >
                {t('styleSettings.' + s.value)}
              </button>
            ))}
          </div>

          {showCustomInput && (
            <textarea
              className="custom-style-input"
              placeholder={t('styleSettings.customPlaceholder')}
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              disabled={isStreaming}
              rows={3}
            />
          )}
        </div>
      )}
    </div>
  );
}