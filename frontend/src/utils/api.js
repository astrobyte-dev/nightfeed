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

export async function fetchCoomerMedia({ query = '', after = null, type = 'video', sort = 'newest', limit = 36 } = {}) {
  const url = new URL('/api/coomer/search', API_BASE_URL);
  url.searchParams.set('q', query);
  if (after) url.searchParams.set('after', after);
  if (type) url.searchParams.set('type', type);
  if (sort) url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch Coomer');
  }
  return response.json();
}

export async function fetchYouTubeMedia({ query = '', pageToken = null, order = 'relevance', limit = 25 } = {}) {
  const url = new URL('/api/youtube/search', API_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('order', order);
  url.searchParams.set('limit', String(limit));
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch YouTube');
  }
  return response.json();
}

export async function fetchEpornerMedia({ query = 'all', page = 1, order = 'most-popular', perPage = 30, include = [], exclude = [], performers = [] } = {}) {
  const url = new URL('/api/eporner/search', API_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('order', order);
  url.searchParams.set('per_page', String(perPage));
  if (include.length) url.searchParams.set('include', include.join(','));
  if (exclude.length) url.searchParams.set('exclude', exclude.join(','));
  if (performers.length) url.searchParams.set('performers', performers.join(','));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch Eporner');
  }
  return response.json();
}

export async function fetchRelatedSubreddits(subreddit) {
  if (!subreddit) return { items: [] };
  const url = new URL(`/api/reddit/related/${encodeURIComponent(subreddit)}`, API_BASE_URL);
  const response = await fetch(url.toString());
  if (!response.ok) return { items: [] };
  return response.json();
}

export async function searchSubreddits({ query, includeNsfw = true, limit = 12 } = {}) {
  if (!query || query.trim().length < 2) return { items: [] };
  const url = new URL('/api/reddit/search-subreddits', API_BASE_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('nsfw', includeNsfw ? '1' : '0');
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to search subreddits');
  }
  return response.json();
}

export function getRedgifsStreamUrl(id) {
  if (!id) return null;
  const url = new URL(`/api/external/redgifs/${encodeURIComponent(id)}/stream`, API_BASE_URL);
  return url.toString();
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
