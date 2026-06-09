import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'nash_slon_theme';

export const THEMES = [
  {
    id: 'elephant',
    icon: '🐘',
    title: 'Основная',
    description: 'Фирменная тема Наш Слон',
  },
  {
    id: 'sun',
    icon: '☀️',
    title: 'Светлая',
    description: 'Светлая тема из прототипа',
  },
  {
    id: 'moon',
    icon: '🌙',
    title: 'Темная',
    description: 'Темная тема из прототипа',
  },
];

const ThemeContext = createContext(null);

function getInitialTheme() {
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((theme) => theme.id === storedTheme) ? storedTheme : 'elephant';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    themes: THEMES,
    setTheme: setThemeState,
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme должен использоваться внутри ThemeProvider');
  }
  return context;
}
