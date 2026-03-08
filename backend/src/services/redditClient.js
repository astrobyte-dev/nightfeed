import { sanitizeLimit, sanitizeSort } from '../utils/normalizePost.js';

const DEFAULT_BASE_URL = 'https://www.reddit.com';
const DEFAULT_GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';
const ALLOWED_TIME_RANGES = new Set(['hour', 'day', 'week', 'month', 'year', 'all']);

function sanitizeTimeRange(value) {
  return ALLOWED_TIME_RANGES.has(value) ? value : 'all';
}

function buildListingUrl({ subreddit, sort, after, limit, timeRange, query }) {
  const baseUrl = process.env.REDDIT_BASE_URL || DEFAULT_BASE_URL;
  const safeSubreddit = (subreddit || '').trim();
  const hasQuery = Boolean((query || '').trim());
  const pathname = hasQuery ? `/r/${safeSubreddit}/search.json` : `/r/${safeSubreddit}/${sort}.json`;
  const url = new URL(pathname, baseUrl);
  url.searchParams.set('raw_json', '1');
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);
  if (hasQuery) {
    url.searchParams.set('q', query.trim());
    url.searchParams.set('restrict_sr', 'on');
    url.searchParams.set('sort', sort);
  }
  if (sort === 'top' || hasQuery) {
    url.searchParams.set('t', sanitizeTimeRange(timeRange));
  }
  return url.toString();
}

function buildUserListingUrl({ username, sort, after, limit, timeRange }) {
  const baseUrl = process.env.REDDIT_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(`/user/${username}/submitted/${sort}.json`, baseUrl);
  url.searchParams.set('raw_json', '1');
  url.searchParams.set('limit', String(limit));
  if (after) {
    url.searchParams.set('after', after);
  }
  if (sort === 'top') {
    url.searchParams.set('t', sanitizeTimeRange(timeRange));
  }
  return url.toString();
}

function buildNewSubredditsUrl(limit) {
  const baseUrl = process.env.REDDIT_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL('/subreddits/new.json', baseUrl);
  url.searchParams.set('raw_json', '1');
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

function buildInstagramDiscoveryUrl({ appUserId, username, accessToken, after, limit }) {
  const baseUrl = process.env.INSTAGRAM_GRAPH_BASE_URL || DEFAULT_GRAPH_BASE_URL;
  const url = new URL(`/${appUserId}`, baseUrl);

  const afterSegment = after ? `.after(${after})` : '';
  const mediaSelection = `media.limit(${limit})${afterSegment}{id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}}`;
  const fields = `business_discovery.username(${username}){username,${mediaSelection}}`;

  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);
  return url.toString();
}

async function fetchJson(url, options = {}) {
  const userAgent = process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0';
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
      ...(options.headers || {})
    },
    method: options.method || 'GET'
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

export async function fetchSubredditListing({ subreddit, sort, after, limit, timeRange, query }) {
  const safeSort = sanitizeSort(sort);
  const safeLimit = sanitizeLimit(limit);
  const url = buildListingUrl({ subreddit, sort: safeSort, after, limit: safeLimit, timeRange, query });
  return fetchJson(url);
}

export async function fetchUserSubmittedListing({ username, sort, after, limit, timeRange }) {
  const safeSort = sanitizeSort(sort);
  const safeLimit = sanitizeLimit(limit);
  const safeUser = (username || '').trim();
  const url = buildUserListingUrl({ username: safeUser, sort: safeSort, after, limit: safeLimit, timeRange });
  return fetchJson(url);
}

export async function fetchNewSubreddits(limit = 40) {
  const safeLimit = sanitizeLimit(limit);
  const url = buildNewSubredditsUrl(safeLimit);
  return fetchJson(url);
}

export async function fetchInstagramBusinessDiscovery({ username, after, limit }) {
  const appUserId = process.env.INSTAGRAM_APP_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!appUserId || !accessToken) {
    const error = new Error('Instagram API is not configured');
    error.status = 500;
    throw error;
  }

  const safeUsername = (username || '').trim().toLowerCase();
  if (!/^[a-z0-9._]+$/.test(safeUsername)) {
    const error = new Error('Invalid Instagram username');
    error.status = 400;
    throw error;
  }

  const safeLimit = sanitizeLimit(limit);
  const url = buildInstagramDiscoveryUrl({
    appUserId,
    username: safeUsername,
    accessToken,
    after,
    limit: safeLimit
  });

  return fetchJson(url);
}
