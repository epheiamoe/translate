import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../hooks/useAppStore';
import { getLanguageName } from '../../lib/prompts/loadPrompts';
import './HistoryPanel.css';

interface HistoryPanelProps {
  onClose: () => void;
}

type TabType = 'history' | 'favorites';

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const {
    history,
    favorites,
    toggleFavorite,
    deleteRecord,
    clearHistory,
    exportData,
    importData,
    setSourceText,
    setTargetText,
    setSourceLang,
    setTargetLang,
    setMode,
    setStyle
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const currentList = activeTab === 'history' ? history : favorites;

  const filteredList = currentList.filter(record =>
    record.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.targetText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectRecord = (record: typeof history[0]) => {
    setSourceText(record.sourceText);
    setTargetText(record.targetText);
    setSourceLang(record.sourceLang);
    setTargetLang(record.targetLang);
    setMode(record.mode);
    if (record.style) setStyle(record.style);
    onClose();
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translate-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        await importData(text);
      }
    };
    input.click();
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getModeLabel = (mode: string) => mode === 'translation' ? t('history.translateMode') : t('history.parseMode');

  return (
    <div className="history-panel-overlay" onClick={onClose}>
      <div className="history-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2 className="panel-title">{t('history.title')}</h2>
          <button className="close-btn" onClick={onClose} aria-label={t('settings.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="panel-tabs">
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            {`${t('history.history')} (${history.length})`}
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            {`${t('history.favorites')} (${favorites.length})`}
          </button>
        </div>

        <div className="panel-actions">
          <input
            type="text"
            className="search-input"
            placeholder={t('history.search')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button className="action-btn" onClick={handleExport} title={t('history.export')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className="action-btn" onClick={handleImport} title={t('history.import')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          {activeTab === 'history' && (
            <button className="action-btn danger" onClick={clearHistory} title={t('history.clearAll')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </div>

        <div className="panel-content">
          {filteredList.length === 0 ? (
            <div className="empty-state">
              <p>{t('history.noHistory', { type: activeTab === 'history' ? t('history.history') : t('history.favorites') })}</p>
            </div>
          ) : (
            <ul className="history-list">
              {filteredList.map(record => (
                <li key={record.id} className="history-item">
                  <div className="item-header">
                    <span className="item-langs">
                      {getLanguageName(record.sourceLang)} → {getLanguageName(record.targetLang)}
                    </span>
                    <span className="item-mode">{getModeLabel(record.mode)}</span>
                  </div>
                  <div 
                    className="item-text source"
                    onClick={() => handleSelectRecord(record)}
                  >
                    {record.sourceText}
                  </div>
                  <div className="item-text target">
                    {record.targetText}
                  </div>
                  <div className="item-footer">
                    <span className="item-time">{formatTime(record.timestamp)}</span>
                    <div className="item-actions">
                      <button
                        className={`item-action-btn ${record.isFavorite ? 'active' : ''}`}
                        onClick={() => record.id && toggleFavorite(record.id)}
                        aria-label={record.isFavorite ? t('history.removeFavorite') : t('history.addFavorite')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={record.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      <button
                        className="item-action-btn danger"
                        onClick={() => record.id && deleteRecord(record.id)}
                        aria-label={t('history.delete')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}