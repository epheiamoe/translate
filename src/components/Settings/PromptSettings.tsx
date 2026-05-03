import { useState, useEffect } from 'react';
import { SystemPrompts, UserPrompts } from '../../lib/prompts/defaultPrompts';
import './PromptSettings.css';

interface PromptSettingsProps {
  onSave: (systemPrompts: SystemPrompts, userPrompts: UserPrompts) => Promise<void>;
  onReset: (type: 'system' | 'user' | 'all') => Promise<void>;
  getCurrent: () => { system: SystemPrompts; user: UserPrompts };
  labels: Record<string, string>;
  templateVars: Record<string, string>;
}

const SYSTEM_PROMPT_KEYS: (keyof SystemPrompts)[] = ['translation', 'translation_long', 'parsing', 'language_detection', 'doc_translation', 'alternative_translation'];
const USER_PROMPT_KEYS: (keyof UserPrompts)[] = ['translation', 'translation_long', 'translation_continue', 'parsing', 'doc_translation'];

export function PromptSettings({ onSave, onReset, getCurrent, labels, templateVars }: PromptSettingsProps) {
  const [activeSection, setActiveSection] = useState<'system' | 'user'>('system');
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompts>(getCurrent().system);
  const [userPrompts, setUserPrompts] = useState<UserPrompts>(getCurrent().user);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const current = getCurrent();
    setSystemPrompts(current.system);
    setUserPrompts(current.user);
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSaveEdit = () => {
    if (!editingKey) return;
    if (activeSection === 'system') {
      setSystemPrompts(prev => ({ ...prev, [editingKey]: editValue }));
    } else {
      setUserPrompts(prev => ({ ...prev, [editingKey]: editValue }));
    }
    setEditingKey(null);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onSave(systemPrompts, userPrompts);
      showMessage('Prompts saved successfully!');
    } catch (e) {
      showMessage('Failed to save prompts');
    }
    setSaving(false);
  };

  const handleReset = async (type: 'system' | 'user' | 'all') => {
    try {
      await onReset(type);
      const current = getCurrent();
      setSystemPrompts(current.system);
      setUserPrompts(current.user);
      showMessage(`Reset successfully!`);
    } catch (e) {
      showMessage('Reset failed');
    }
  };

  const keys = activeSection === 'system' ? SYSTEM_PROMPT_KEYS : USER_PROMPT_KEYS;

  const getPromptValue = (key: string): string => {
    if (activeSection === 'system') {
      return systemPrompts[key as keyof SystemPrompts] || '';
    }
    return userPrompts[key as keyof UserPrompts] || '';
  };

  return (
    <div className="prompt-settings">
      <div className="prompt-tabs">
        <button
          className={`prompt-tab ${activeSection === 'system' ? 'active' : ''}`}
          onClick={() => setActiveSection('system')}
        >
          {labels.systemPrompts || 'System Prompts'}
        </button>
        <button
          className={`prompt-tab ${activeSection === 'user' ? 'active' : ''}`}
          onClick={() => setActiveSection('user')}
        >
          {labels.userPrompts || 'User Prompts'}
        </button>
      </div>

      <div className="prompt-actions-top">
        <button className="btn btn-reset" onClick={() => handleReset(activeSection)}>
          {labels.resetCurrent || 'Reset'}
        </button>
        <button className="btn btn-reset" onClick={() => handleReset('all')}>
          {labels.resetAll || 'Reset All'}
        </button>
        <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
          {saving ? (labels.saving || 'Saving...') : (labels.save || 'Save')}
        </button>
      </div>

      {message && <div className="prompt-message">{message}</div>}

      <div className="prompt-list">
        {keys.map(key => {
          const value = getPromptValue(key);
          const vars = templateVars[key];
          return (
            <div key={key} className="prompt-item">
              <div className="prompt-item-header">
                <span className="prompt-key">{labels[key] || key}</span>
                <button className="btn btn-edit" onClick={() => handleEdit(key, value)}>
                  {labels.edit || 'Edit'}
                </button>
              </div>
              {vars && (
                <div className="prompt-vars">Variables: {vars.split(' ').map(v => <code key={v} className="var-tag">{v}</code>)}</div>
              )}
              <div className="prompt-preview">
                {value.slice(0, 120)}
                {value.length > 120 ? '...' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {editingKey && (
        <div className="prompt-editor-overlay" onClick={() => handleSaveEdit()}>
          <div className="prompt-editor" onClick={e => e.stopPropagation()}>
            <h3>{labels[editingKey] || editingKey}</h3>
            {templateVars[editingKey] && (
              <div className="editor-vars">
                Available variables: {templateVars[editingKey].split(' ').map(v => <code key={v} className="var-tag">{v}</code>)}
              </div>
            )}
            <textarea
              className="prompt-textarea"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              rows={15}
            />
            <div className="prompt-editor-actions">
              <button className="btn btn-secondary" onClick={() => setEditingKey(null)}>
                {labels.cancel || 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>
                {labels.apply || 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
