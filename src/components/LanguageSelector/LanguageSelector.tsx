import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../hooks/useAppStore';
import './LanguageSelector.css';

interface LanguageSelectorProps {
  label: string;
  value: string;
  onChange: (lang: string) => void;
  languages: Record<string, string>;
  showAutoOption?: boolean;
}

export function LanguageSelector({
  label,
  value,
  onChange,
  languages,
  showAutoOption = false
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { settings } = useAppStore();

  const getLangName = (code: string): string => {
    const translated = t(`languages.${code}`);
    return translated !== `languages.${code}` ? translated : languages[code] || code;
  };

  const allLanguages: Record<string, string> = {
    ...(showAutoOption ? { auto: t('languageSelector.autoDetect') } : {}),
    ...languages,
    ...Object.fromEntries(settings.customLanguages.map(cl => [cl.id, cl.name]))
  };

  const displayName = getLangName(value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (langCode: string) => {
    onChange(langCode);
    setIsOpen(false);
  };

  return (
    <div className="language-selector" ref={dropdownRef}>
      <span className="selector-label">{label}</span>
      <button 
        className="selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="selector-value">{displayName}</span>
        <svg className={`selector-arrow ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isOpen && (
        <ul className="selector-dropdown" role="listbox">
          {Object.entries(allLanguages).map(([code, name]) => (
            <li 
              key={code}
              className={`dropdown-item ${value === code ? 'selected' : ''}`}
              role="option"
              aria-selected={value === code}
              onClick={() => handleSelect(code)}
            >
              {getLangName(code)}
              {value === code && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}