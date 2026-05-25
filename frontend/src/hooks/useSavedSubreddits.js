import { useCallback, useEffect, useState } from 'react';

const KEY = 'subreddit-media-viewer:saved-subreddits';
const MAX = 200;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useSavedSubreddits() {
  const [saved, setSaved] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  }, [saved]);

  const isSaved = useCallback(
    (name) => saved.some((s) => s.name.toLowerCase() === String(name || '').toLowerCase()),
    [saved]
  );

  const toggle = useCallback((entry) => {
    if (!entry?.name) return false;
    const key = entry.name.toLowerCase();
    let added = false;
    setSaved((prev) => {
      if (prev.some((s) => s.name.toLowerCase() === key)) {
        return prev.filter((s) => s.name.toLowerCase() !== key);
      }
      added = true;
      return [{ ...entry, savedAt: Date.now() }, ...prev].slice(0, MAX);
    });
    return added;
  }, []);

  const remove = useCallback((name) => {
    const key = String(name || '').toLowerCase();
    setSaved((prev) => prev.filter((s) => s.name.toLowerCase() !== key));
  }, []);

  return { saved, isSaved, toggle, remove };
}
