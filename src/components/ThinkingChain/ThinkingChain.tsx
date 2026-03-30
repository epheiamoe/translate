import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../hooks/useAppStore';
import { getLanguageName } from '../../lib/prompts/loadPrompts';
import './ThinkingChain.css';

interface ThinkingChainProps {
  content: string;
}

export function ThinkingChain({ content }: ThinkingChainProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!content) return null;

  return (
    <div className="thinking-chain">
      <button 
        className="thinking-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <div className="thinking-title">
          <span className="thinking-icon">🤖</span>
          <span>{t('thinkingChain.title')}</span>
        </div>
        <svg 
          className={`thinking-arrow ${isCollapsed ? 'collapsed' : ''}`} 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {!isCollapsed && (
        <div className="thinking-content">
          <pre>{content}</pre>
        </div>
      )}
    </div>
  );
}