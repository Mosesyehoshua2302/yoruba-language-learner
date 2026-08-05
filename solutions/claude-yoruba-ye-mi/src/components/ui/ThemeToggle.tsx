import { useEffect, useState } from 'react';
import { resolvedTheme, setTheme, watchSystemTheme, type Theme } from '../../lib/theme';
import { Icon } from './icons';

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => resolvedTheme());

  useEffect(() => watchSystemTheme(setThemeState), []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
