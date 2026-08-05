const KEY = 'yym:theme';

export type Theme = 'light' | 'dark';

export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolvedTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage unavailable — theme still applies for this session
  }
  applyTheme(theme);
}

/** Follow OS theme changes while no explicit preference is stored. */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    if (storedTheme() !== null) return;
    const theme: Theme = e.matches ? 'dark' : 'light';
    applyTheme(theme);
    onChange(theme);
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
