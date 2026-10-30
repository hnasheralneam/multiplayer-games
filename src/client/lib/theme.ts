import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ms:theme';
const THEME_COLORS: Record<Theme, string> = {
  dark: '#0b0e13',
  light: '#f4f0e8'
};

const listeners = new Set<() => void>();

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

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
  return storedTheme() ?? systemTheme();
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

  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  const onSystemChange = () => {
    if (!storedTheme()) applyTheme(systemTheme());
  };
  media?.addEventListener('change', onSystemChange);

  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', onSystemChange);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'dark' as const);
}
