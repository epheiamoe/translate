import { useTranslation } from 'react-i18next';
import './ModelSwitcher.css';

interface ModelOption {
  name: string;
  supports_thinking: boolean;
}

interface ModelSwitcherProps {
  currentModel: string;
  models: Record<string, ModelOption>;
  onSelect: (model: string) => void;
}

export function ModelSwitcher({ currentModel, models, onSelect }: ModelSwitcherProps) {
  const { t } = useTranslation();
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelect(e.target.value);
  };

  const modelEntries = Object.entries(models);

  if (modelEntries.length === 0) {
    return (
      <div className="model-switcher">
        <select
          className="model-select"
          disabled
          aria-label={t('modelSwitcher.selectModel')}
        >
          <option value="">No models available</option>
        </select>
      </div>
    );
  }

  return (
    <div className="model-switcher">
      <select
        className="model-select"
        value={currentModel}
        onChange={handleChange}
        aria-label={t('modelSwitcher.selectModel')}
      >
        {modelEntries.map(([key, model]) => (
          <option key={key} value={key}>
            {model.name}
            {model.supports_thinking ? ' 🤖' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}