import { describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  readSystemTheme,
  readThemePreference,
  writeThemePreference,
  type ThemeStorageGetter,
} from './theme-preference';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
  };
}

describe('theme preference', () => {
  it('accepts only the two explicit themes and treats absent/invalid values as system preference', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference(null)).toBeNull();
    expect(parseThemePreference('system')).toBeNull();
    expect(parseThemePreference('LIGHT')).toBeNull();
    expect(parseThemePreference('blue')).toBeNull();
  });

  it('reads a valid value from session storage using the versioned key', () => {
    const storage = memoryStorage('dark');
    const getStorage: ThemeStorageGetter = () => storage;

    expect(readThemePreference(getStorage)).toBe('dark');
    expect(storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });

  it('treats missing storage, invalid values, and read exceptions as no manual choice', () => {
    expect(readThemePreference(() => null)).toBeNull();
    expect(readThemePreference(() => memoryStorage('system'))).toBeNull();
    expect(readThemePreference(() => { throw new Error('blocked accessor'); })).toBeNull();
    expect(readThemePreference(() => ({
      getItem: () => { throw new Error('blocked read'); },
      setItem: () => undefined,
    }))).toBeNull();
  });

  it('writes the explicit theme and contains missing-storage or write failures', () => {
    const storage = memoryStorage();
    const getStorage: ThemeStorageGetter = () => storage;

    expect(writeThemePreference('light', getStorage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    expect(readThemePreference(getStorage)).toBe('light');
    expect(writeThemePreference('dark', () => null)).toBe(false);
    expect(writeThemePreference('dark', () => { throw new Error('blocked accessor'); })).toBe(false);
    expect(writeThemePreference('dark', () => ({
      getItem: () => null,
      setItem: () => { throw new Error('blocked write'); },
    }))).toBe(false);
  });

  it('resolves the system preference and safely falls back to light when media queries fail', () => {
    expect(readSystemTheme(() => true)).toBe('dark');
    expect(readSystemTheme(() => false)).toBe('light');
    expect(readSystemTheme(() => { throw new Error('matchMedia unavailable'); })).toBe('light');
  });
});
