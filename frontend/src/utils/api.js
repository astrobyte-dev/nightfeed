const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

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

export async function fetchYouTubeMedia({ query, category, order = 'relevance', after, limit = 24 }) {
  const url = new URL('/api/youtube/search', API_BASE_URL);
  url.searchParams.set('query', query);
  if (category) url.searchParams.set('category', category);
  url.searchParams.set('order', order);
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('pageToken', after);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to fetch YouTube media');
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
