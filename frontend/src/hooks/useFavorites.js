import { useCallback, useEffect, useState } from 'react';

const KEY = 'subreddit-media-viewer:favorites';
const MAX = 500;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  const isFavorited = useCallback((id) => favorites.some((f) => f.id === id), [favorites]);

  const toggle = useCallback((post) => {
    if (!post?.id) return false;
    let added = false;
    setFavorites((prev) => {
      if (prev.some((f) => f.id === post.id)) {
        return prev.filter((f) => f.id !== post.id);
      }
      added = true;
      const snapshot = {
        id: post.id,
        title: post.title,
        author: post.author,
        subreddit: post.subreddit,
        type: post.type,
        thumbnail: post.thumbnail || post.previewUrl || post.mediaUrl,
        permalink: post.permalink,
        source: post.source,
        savedAt: Date.now()
      };
      return [snapshot, ...prev].slice(0, MAX);
    });
    return added;
  }, []);

  const remove = useCallback((id) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => setFavorites([]), []);

  return { favorites, isFavorited, toggle, remove, clearAll };
}
