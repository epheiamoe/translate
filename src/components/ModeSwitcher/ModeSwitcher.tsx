import { useAppStore } from '../../hooks/useAppStore';
import './ModeSwitcher.css';

const MODES = [
  { value: 'translation', label: 'Translate' },
  { value: 'parsing', label: 'Parse' }
] as const;

export function ModeSwitcher() {
  const { mode, setMode, isStreaming } = useAppStore();

  return (
    <div className="mode-switcher">
      <span className="mode-label">Mode:</span>
      <div className="mode-toggle">
        {MODES.map((m) => (
          <button
            key={m.value}
            className={`mode-btn ${mode === m.value ? 'active' : ''}`}
            onClick={() => setMode(m.value)}
            disabled={isStreaming}
            aria-pressed={mode === m.value}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}