import { useCallback, useEffect, useRef, useState } from 'react';

const MODE_KEY = 'nightfeed:mode';
const VALID_MODES = new Set(['grid', 'feed']);

function readInitialMode() {
  if (typeof window === 'undefined') return 'grid';
  const url = new URLSearchParams(window.location.search).get('mode');
  if (VALID_MODES.has(url)) return url;
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (VALID_MODES.has(stored)) return stored;
  } catch {
    // localStorage may be unavailable; fall through to default.
  }
  return 'grid';
}

function buildUrl(params) {
  const search = params.toString();
  return `${window.location.pathname}${search ? '?' + search : ''}${window.location.hash}`;
}

export function useMode() {
  const [mode, setModeState] = useState(readInitialMode);
  const gridScrollYRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  // Cold-load history bootstrap: if we landed in feed mode directly (URL or
  // localStorage) and the current history entry was not pushed by us, insert
  // a grid entry below the current one so browser-back exits feed instead of
  // leaving the app.
  useEffect(() => {
    if (mode !== 'feed') return;
    if (window.history.state?.nightfeedMode === 'feed') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('mode');
    const gridUrl = buildUrl(params);
    params.set('mode', 'feed');
    const feedUrl = buildUrl(params);
    window.history.replaceState(
      { ...window.history.state, nightfeedMode: 'grid' },
      '',
      gridUrl
    );
    window.history.pushState({ nightfeedMode: 'feed' }, '', feedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore scroll when returning to grid from feed.
  useEffect(() => {
    if (mode !== 'grid') return;
    const y = gridScrollYRef.current;
    if (y <= 0) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [mode]);

  const setMode = useCallback((next) => {
    if (!VALID_MODES.has(next)) return;
    setModeState((prev) => {
      if (prev === next) return prev;
      const params = new URLSearchParams(window.location.search);
      if (next === 'feed') {
        gridScrollYRef.current = window.scrollY;
        params.set('mode', 'feed');
        window.history.pushState(
          { nightfeedMode: 'feed' },
          '',
          buildUrl(params)
        );
      } else {
        params.delete('mode');
        window.history.replaceState(
          { ...window.history.state, nightfeedMode: 'grid' },
          '',
          buildUrl(params)
        );
      }
      return next;
    });
  }, []);

  return { mode, setMode };
}
