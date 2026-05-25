import { useEffect, useState } from 'react';
import { fetchRelatedSubreddits } from '../utils/api';
import { NSFW_DIRECTORY } from '../utils/nsfwDirectory';

const sessionCache = new Map();

function getLocalRelated(subreddit) {
  if (!subreddit || subreddit.includes('+')) return [];
  const key = subreddit.toLowerCase();
  const matchingCategories = NSFW_DIRECTORY.filter((section) =>
    section.items.some((name) => name.toLowerCase() === key)
  );
  if (matchingCategories.length === 0) return [];
  const seen = new Set([key]);
  const out = [];
  for (const section of matchingCategories) {
    for (const name of section.items) {
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ name, title: section.category, source: 'local', subscribers: 0 });
      if (out.length >= 12) break;
    }
    if (out.length >= 12) break;
  }
  return out;
}

export function useRelatedSubreddits(subreddit) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subreddit || subreddit.includes('+')) {
      setItems([]);
      return undefined;
    }

    const local = getLocalRelated(subreddit);
    const key = subreddit.toLowerCase();

    if (sessionCache.has(key)) {
      const cached = sessionCache.get(key);
      setItems(cached);
      return undefined;
    }

    setItems(local);
    setLoading(true);
    let cancelled = false;

    fetchRelatedSubreddits(subreddit)
      .then((payload) => {
        if (cancelled) return;
        const remote = (payload?.items || []).map((s) => ({ ...s, source: 'reddit' }));
        const seen = new Set([key]);
        const merged = [];
        // Interleave: take remote first (2), then local (1), then remote (2), etc.
        // Simpler: prefer remote, fall back to local, dedupe.
        for (const r of remote) {
          const k = r.name.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
        for (const l of local) {
          const k = l.name.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(l);
        }
        const final = merged.slice(0, 18);
        sessionCache.set(key, final);
        setItems(final);
      })
      .catch(() => {
        if (!cancelled) setItems(local);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [subreddit]);

  return { items, loading };
}
