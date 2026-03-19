const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const redditCommentsCache = new Map();
const redditCommentsInFlight = new Map();
const REDDIT_COMMENTS_TTL_MS = 5 * 60 * 1000;

function readCachedComments(key) {
  const cached = redditCommentsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    redditCommentsCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCachedComments(key, value) {
  redditCommentsCache.set(key, {
    value,
    expiresAt: Date.now() + REDDIT_COMMENTS_TTL_MS
  });
}

export async function fetchSubredditMedia({
  subreddit,
  sort,
  after,
  includeNsfw,
  limit = 40,
  timeRange = 'all',
  keyword = '',
  includeTerms = '',
  excludeTerms = '',
  flair = '',
  minScore = 0,
  onlyRedditHosted = false,
  searchScope = 'title'
}) {
  const url = new URL(`/api/subreddit/${encodeURIComponent(subreddit)}`, API_BASE_URL);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('includeNsfw', String(includeNsfw));
  url.searchParams.set('timeRange', timeRange);
  url.searchParams.set('minScore', String(minScore));
  url.searchParams.set('onlyRedditHosted', String(onlyRedditHosted));
  url.searchParams.set('searchScope', searchScope);
  if (keyword) url.searchParams.set('keyword', keyword);
  if (includeTerms) url.searchParams.set('includeTerms', includeTerms);
  if (excludeTerms) url.searchParams.set('excludeTerms', excludeTerms);
  if (flair) url.searchParams.set('flair', flair);
  if (after) url.searchParams.set('after', after);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch subreddit media');
  }
  return response.json();
}

export async function fetchRedditComments({ permalink, limit = 12 }) {
  const key = `${permalink}|${limit}`;
  const cached = readCachedComments(key);
  if (cached) return cached;

  const pending = redditCommentsInFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const url = new URL('/api/reddit/comments', API_BASE_URL);
    url.searchParams.set('permalink', permalink);
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString());
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to fetch comments');
    }

    const payload = await response.json();
    writeCachedComments(key, payload);
    return payload;
  })().finally(() => {
    redditCommentsInFlight.delete(key);
  });

  redditCommentsInFlight.set(key, request);
  return request;
}

export async function fetchRedgifsMedia(id) {
  const url = new URL(`/api/external/redgifs/${encodeURIComponent(id)}`, API_BASE_URL);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch RedGIFs media');
  }
  return response.json();
}

export async function fetchRedditUserMedia({ username, sort = 'new', after, includeNsfw, limit = 40 }) {
  const url = new URL(`/api/user/${encodeURIComponent(username)}`, API_BASE_URL);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('includeNsfw', String(includeNsfw));
  if (after) url.searchParams.set('after', after);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch user media');
  }
  return response.json();
}

export async function fetchInstagramMedia({ username, after, limit = 24 }) {
  const url = new URL(`/api/instagram/${encodeURIComponent(username)}`, API_BASE_URL);
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch Instagram media');
  }
  return response.json();
}

export async function fetchNewNsfwSubreddits(limit = 20) {
  const url = new URL('/api/nsfw/new', API_BASE_URL);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch new NSFW subreddits');
  }

  return response.json();
}

export async function fetchSimpcityMedia({ path, query, after, limit = 18 }) {
  const url = new URL('/api/simpcity/feed', API_BASE_URL);
  if (path) url.searchParams.set('path', path);
  if (query) url.searchParams.set('q', query);
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity media');
  }

  return response.json();
}

export async function fetchSimpcitySidebar() {
  const url = new URL('/api/simpcity/sidebar', API_BASE_URL);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity sidebar');
  }
  return response.json();
}

export async function fetchSimpcityTags(limit = 80) {
  const url = new URL('/api/simpcity/tags', API_BASE_URL);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity tags');
  }
  return response.json();
}

export async function fetchSimpcityCreators({ search = '', limit = 60 } = {}) {
  const url = new URL('/api/simpcity/creators', API_BASE_URL);
  if (search) url.searchParams.set('search', search);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity creators');
  }
  return response.json();
}

export async function fetchSimpcityThreads({ category = '', section = '', tag = '', author = '', creator = '', search = '', after, limit = 24 }) {
  const url = new URL('/api/simpcity/threads', API_BASE_URL);
  if (category) url.searchParams.set('category', category);
  if (section) url.searchParams.set('section', section);
  if (tag) url.searchParams.set('tag', tag);
  if (author) url.searchParams.set('author', author);
  if (creator) url.searchParams.set('creator', creator);
  if (search) url.searchParams.set('search', search);
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity threads');
  }
  return response.json();
}

export async function fetchIndexedSimpcityMedia({ category = '', section = '', tag = '', author = '', creator = '', search = '', mediaType = 'all', sourceHost = '', after, limit = 36 }) {
  const url = new URL('/api/simpcity/media', API_BASE_URL);
  if (category) url.searchParams.set('category', category);
  if (section) url.searchParams.set('section', section);
  if (tag) url.searchParams.set('tag', tag);
  if (author) url.searchParams.set('author', author);
  if (creator) url.searchParams.set('creator', creator);
  if (search) url.searchParams.set('search', search);
  if (mediaType) url.searchParams.set('mediaType', mediaType);
  if (sourceHost) url.searchParams.set('sourceHost', sourceHost);
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity media');
  }
  return response.json();
}

export async function fetchSimpcityThreadDetail(threadId) {
  const url = new URL(`/api/simpcity/thread/${encodeURIComponent(threadId)}`, API_BASE_URL);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch SimpCity thread');
  }
  return response.json();
}

export async function triggerSimpcityCrawl({ threadLimitPerSection = 12, scope = 'manual' } = {}) {
  const url = new URL('/api/simpcity/crawl', API_BASE_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadLimitPerSection, scope })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to start SimpCity crawl');
  }
  return response.json();
}

export async function fetchMediaFeed({ after, limit = 24 } = {}) {
  const url = new URL('/api/media/feed', API_BASE_URL);
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch media feed');
  }
  return response.json();
}

export async function fetchMediaSearch({ search = '', creator = '', tag = '', type = 'all', sort = 'newest', after, limit = 24 } = {}) {
  const url = new URL('/api/media/search', API_BASE_URL);
  if (search) url.searchParams.set('q', search);
  if (creator) url.searchParams.set('creator', creator);
  if (tag) url.searchParams.set('tag', tag);
  if (type) url.searchParams.set('type', type);
  if (sort) url.searchParams.set('sort', sort);
  if (after) url.searchParams.set('after', after);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to search media');
  }
  return response.json();
}

export async function fetchMediaCreators({ search = '', service = '', type = 'all' } = {}) {
  const url = new URL('/api/media/creators', API_BASE_URL);
  if (search) url.searchParams.set('q', search);
  if (service) url.searchParams.set('service', service);
  if (type) url.searchParams.set('type', type);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch Coomer creators');
  }
  return response.json();
}

export async function fetchMediaTags({ search = '', creator = '', type = 'all' } = {}) {
  const url = new URL('/api/media/tags', API_BASE_URL);
  if (search) url.searchParams.set('q', search);
  if (creator) url.searchParams.set('creator', creator);
  if (type) url.searchParams.set('type', type);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch Coomer services');
  }
  return response.json();
}
