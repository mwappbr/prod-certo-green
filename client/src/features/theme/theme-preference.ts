export type Theme = 'light' | 'dark';

export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ThemeStorageGetter = () => ThemeStorage | null;

export const THEME_STORAGE_KEY = 'hn-modernizacao.theme.preference.v1';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function parseThemePreference(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function readThemePreference(
  getStorage: ThemeStorageGetter = () => window.sessionStorage,
): Theme | null {
  try {
    return parseThemePreference(getStorage()?.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeThemePreference(
  theme: Theme,
  getStorage: ThemeStorageGetter = () => window.sessionStorage,
): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function readSystemTheme(matchesDark: () => boolean = () => window.matchMedia(DARK_SCHEME_QUERY).matches): Theme {
  try {
    return matchesDark() ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
