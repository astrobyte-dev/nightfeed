import { useCallback, useEffect, useState } from 'react';

const AUTHORS_KEY = 'subreddit-media-viewer:hidden-authors';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useHiddenAuthors() {
  const [hidden, setHidden] = useState(() => read(AUTHORS_KEY));

  useEffect(() => {
    try { localStorage.setItem(AUTHORS_KEY, JSON.stringify(hidden)); } catch {}
  }, [hidden]);

  const isHidden = useCallback(
    (author) => hidden.includes(String(author || '').toLowerCase()),
    [hidden]
  );

  const hide = useCallback((author) => {
    const key = String(author || '').toLowerCase();
    if (!key) return;
    setHidden((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const unhide = useCallback((author) => {
    const key = String(author || '').toLowerCase();
    setHidden((prev) => prev.filter((a) => a !== key));
  }, []);

  return { hidden, isHidden, hide, unhide };
}
