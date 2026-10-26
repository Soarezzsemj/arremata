import { useState } from 'react';
import { isDarkTheme, setDarkTheme } from '../lib/theme';
import { Square } from './Square';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(isDarkTheme);

  function toggle() {
    setDarkTheme(!dark);
    setDark(!dark);
  }

  return (
    <button type="button" onClick={toggle} className={className}>
      <Square />
      {dark ? 'Tema claro' : 'Tema escuro'}
    </button>
  );
}
