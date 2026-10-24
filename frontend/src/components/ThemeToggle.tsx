import { useState } from 'react';
import { isDarkTheme, setDarkTheme } from '../lib/theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(isDarkTheme);

  function toggle() {
    setDarkTheme(!dark);
    setDark(!dark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
    >
      {dark ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}
