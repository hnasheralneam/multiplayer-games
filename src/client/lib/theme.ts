import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ms:theme';
const DEFAULT_THEME: Theme = 'light';
const THEME_COLORS: Record<Theme, string> = {
  dark: '#131417',
  light: '#f7f6f3'
};

const listeners = new Set<() => void>();

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light' || attr === 'dark') return attr;
  return storedTheme() ?? DEFAULT_THEME;
}

export function applyTheme(theme: Theme, persist = false): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
    }
  }
  listeners.forEach((listener) => listener());
}

export function setTheme(theme: Theme): void {
  applyTheme(theme, true);
}

export function toggleTheme(): void {
  setTheme(currentTheme() === 'light' ? 'dark' : 'light');
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);
}
