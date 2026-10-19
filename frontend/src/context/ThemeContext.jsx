'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  accentColor: '#7f22fe',
  setTheme: () => {},
  setAccentColor: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [accentColor, setAccentColorState] = useState('#7f22fe');
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedTheme = localStorage.getItem('azzuniqe_theme') || 'system';
      const savedAccent = localStorage.getItem('azzuniqe_accent') || '#7f22fe';
      setThemeState(savedTheme);
      setAccentColorState(savedAccent);

      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemIsDark(mql.matches);

      const handleMediaChange = (e) => setSystemIsDark(e.matches);
      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
      }

      return () => {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', handleMediaChange);
        } else if (mql.removeListener) {
          mql.removeListener(handleMediaChange);
        }
      };
    } catch {}
  }, []);

  const resolvedTheme = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.style.setProperty('--primary', accentColor);
    document.documentElement.style.setProperty('--primary-hover', accentColor === '#7f22fe' ? '#6b12df' : accentColor);
    document.documentElement.style.setProperty('--primary-glow', `${accentColor}40`);
  }, [accentColor]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('azzuniqe_theme', newTheme);
    }
  };

  const setAccentColor = (newAccent) => {
    setAccentColorState(newAccent);
    if (typeof window !== 'undefined') {
      localStorage.setItem('azzuniqe_accent', newAccent);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accentColor, setTheme, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
