import { useTranslation } from 'react-i18next';
import './ModelSwitcher.css';

interface ModelSwitcherProps {
  currentModel: string;
  models: Record<string, { name: string; supports_thinking: boolean }>;
  onSelect: (model: string) => void;
}

export function ModelSwitcher({ currentModel, models, onSelect }: ModelSwitcherProps) {
  const { t } = useTranslation();
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelect(e.target.value);
  };

  return (
    <div className="model-switcher">
      <select
        className="model-select"
        value={currentModel}
        onChange={handleChange}
        aria-label={t('modelSwitcher.selectModel')}
      >
        {Object.entries(models).map(([key, model]) => (
          <option key={key} value={key}>
            {model.name}
            {model.supports_thinking ? ' 🤖' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}