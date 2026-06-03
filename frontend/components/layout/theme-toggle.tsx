'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="size-9" />;
  }

  const current = theme === 'system' ? resolvedTheme : theme;

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={cycleTheme}
      className="relative flex size-9 items-center justify-center rounded-xl border border-foreground/10 bg-white/60 text-foreground/60 transition-all hover:border-foreground/20 hover:bg-white hover:text-foreground dark:border-foreground/10 dark:bg-sidebar-muted dark:text-foreground/60 dark:hover:bg-sidebar-muted/80 dark:hover:text-foreground"
      title={`Tema: ${theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'} (${resolvedTheme === 'dark' ? 'oscuro' : 'claro'})`}
    >
      {current === 'dark' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </button>
  );
}
