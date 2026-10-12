import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  readSystemTheme,
  readThemePreference,
  writeThemePreference,
  type Theme,
} from './theme-preference';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [manualTheme, setManualTheme] = useState<Theme | null>(() => readThemePreference());
  const [systemTheme, setSystemTheme] = useState<Theme>(() => readSystemTheme());
  const theme = manualTheme ?? systemTheme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (manualTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', manualTheme);
  }, [manualTheme]);

  useEffect(() => {
    if (manualTheme !== null) return;

    let media: MediaQueryList;
    try {
      media = window.matchMedia(DARK_SCHEME_QUERY);
    } catch {
      setSystemTheme('light');
      return;
    }

    const syncSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light');
    syncSystemTheme();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncSystemTheme);
      return () => media.removeEventListener('change', syncSystemTheme);
    }

    media.addListener(syncSystemTheme);
    return () => media.removeListener(syncSystemTheme);
  }, [manualTheme]);

  const toggleTheme = useCallback(() => {
    const nextTheme = (manualTheme ?? systemTheme) === 'dark' ? 'light' : 'dark';
    setManualTheme(nextTheme);
    writeThemePreference(nextTheme);
  }, [manualTheme, systemTheme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider não está montado.');
  return value;
}
