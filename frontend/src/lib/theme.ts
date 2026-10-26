export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function setDarkTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {
    // Se o navegador bloquear o localStorage, o tema nao fica salvo
  }
}
