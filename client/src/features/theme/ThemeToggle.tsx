import { useTheme } from './ThemeProvider';
import './theme-toggle.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      aria-label="Alternar tema claro e escuro"
      aria-pressed={theme === 'dark'}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      Alternar tema claro e escuro
    </button>
  );
}
