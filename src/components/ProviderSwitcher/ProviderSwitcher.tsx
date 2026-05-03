import { useTranslation } from 'react-i18next';
import './ProviderSwitcher.css';

interface ProviderOption {
  id: string;
  name: string;
  isBuiltIn: boolean;
}

interface ProviderSwitcherProps {
  currentProvider: string;
  providers: ProviderOption[];
  onSelect: (providerId: string) => void;
}

export function ProviderSwitcher({ currentProvider, providers, onSelect }: ProviderSwitcherProps) {
  const { t } = useTranslation();
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelect(e.target.value);
  };

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="provider-switcher">
      <select
        className="provider-select"
        value={currentProvider}
        onChange={handleChange}
        aria-label={t('providerSwitcher.selectProvider')}
      >
        {providers.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} {!p.isBuiltIn && '(Custom)'}
          </option>
        ))}
      </select>
    </div>
  );
}