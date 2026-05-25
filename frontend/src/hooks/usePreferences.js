import { useEffect, useState } from 'react';

const THEME_KEY = 'subreddit-media-viewer:theme';
const DENSITY_KEY = 'subreddit-media-viewer:density';

const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_DENSITIES = new Set(['compact', 'comfortable', 'large']);

function readEnum(key, valid, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v && valid.has(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  let resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

function applyDensity(density) {
  document.documentElement.dataset.density = density;
}

export function usePreferences() {
  const [theme, setTheme] = useState(() => readEnum(THEME_KEY, VALID_THEMES, 'dark'));
  const [density, setDensity] = useState(() => readEnum(DENSITY_KEY, VALID_DENSITIES, 'comfortable'));

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('system');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [theme]);

  useEffect(() => {
    applyDensity(density);
    try { localStorage.setItem(DENSITY_KEY, density); } catch {}
  }, [density]);

  return { theme, setTheme, density, setDensity };
}
