import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveSetting, getSetting } from '../../lib/db';
import './CustomInstructions.css';

interface CustomInstructionsProps {
  onClose: () => void;
}

export function CustomInstructions({ onClose }: CustomInstructionsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'instructions' | 'glossary'>('instructions');
  const [instructions, setInstructions] = useState('');
  const [glossary, setGlossary] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedInstructions = await getSetting('customInstructions');
      const savedGlossary = await getSetting('glossary');
      if (savedInstructions) setInstructions(savedInstructions as string);
      if (savedGlossary) setGlossary(savedGlossary as string);
    } catch (e) {
      console.error('Failed to load custom instructions:', e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSetting('customInstructions', instructions);
      await saveSetting('glossary', glossary);
    } catch (e) {
      console.error('Failed to save custom instructions:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="custom-instructions-overlay" onClick={onClose}>
      <div className="custom-instructions-panel" onClick={e => e.stopPropagation()}>
        <div className="ci-header">
          <h2>{t('customInstructions.title')}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="ci-tabs">
          <button 
            className={`ci-tab ${activeTab === 'instructions' ? 'active' : ''}`}
            onClick={() => setActiveTab('instructions')}
          >
            {t('customInstructions.instructions')}
          </button>
          <button 
            className={`ci-tab ${activeTab === 'glossary' ? 'active' : ''}`}
            onClick={() => setActiveTab('glossary')}
          >
            {t('customInstructions.glossary')}
          </button>
        </div>

        <div className="ci-content">
          {activeTab === 'instructions' && (
            <div className="ci-section">
              <p className="ci-description">
                {t('customInstructions.instructionsDesc')}
              </p>
              <textarea
                className="ci-textarea"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('customInstructions.instructionsPlaceholder')}
                spellCheck={false}
              />
            </div>
          )}

          {activeTab === 'glossary' && (
            <div className="ci-section">
              <p className="ci-description">
                {t('customInstructions.glossaryDesc')}
              </p>
              <textarea
                className="ci-textarea"
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder={t('customInstructions.glossaryPlaceholder')}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="ci-footer">
          <button className="cancel-btn" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('styleCustomization.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}