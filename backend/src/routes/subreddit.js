import express from 'express';
import { fetchSubredditListing } from '../services/redditClient.js';
import { normalizePost, sanitizeLimit, sanitizeSort } from '../utils/normalizePost.js';

const router = express.Router();
const ALLOWED_SEARCH_SCOPES = new Set(['title', 'title_flair', 'post']);

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

function parseNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function tokenize(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function getSearchScope(value) {
  return ALLOWED_SEARCH_SCOPES.has(value) ? value : 'title';
}

function buildRedditQuery({ keyword, includeTerms, excludeTerms, searchScope }) {
  const parts = [];
  const scope = getSearchScope(searchScope);
  const normalizedKeyword = (keyword || '').trim();

  if (normalizedKeyword) {
    if (scope === 'title') parts.push(`title:${normalizedKeyword}`);
    else if (scope === 'title_flair') parts.push(`(${`title:${normalizedKeyword}`} OR flair:${normalizedKeyword})`);
    else parts.push(normalizedKeyword);
  }

  for (const term of includeTerms) {
    if (scope === 'title') parts.push(`title:${term}`);
    else if (scope === 'title_flair') parts.push(`(${`title:${term}`} OR flair:${term})`);
    else parts.push(term);
  }

  for (const term of excludeTerms) {
    if (scope === 'title') parts.push(`-title:${term}`);
    else if (scope === 'title_flair') parts.push(`(-title:${term} AND -flair:${term})`);
    else parts.push(`-${term}`);
  }

  return parts.join(' ').trim();
}

router.get('/:name', async (req, res, next) => {
  try {
    const subreddit = (req.params.name || '').trim();
    if (!subreddit) {
      return res.status(400).json({ error: 'Subreddit name is required' });
    }

    const sort = sanitizeSort(req.query.sort);
    const limit = sanitizeLimit(req.query.limit);
    const includeNsfw = parseBoolean(req.query.includeNsfw, false);
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const topTimeRange = typeof req.query.timeRange === 'string' ? req.query.timeRange : 'all';
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';
    const includeTerms = tokenize(req.query.includeTerms);
    const excludeTerms = tokenize(req.query.excludeTerms);
    const flair = typeof req.query.flair === 'string' ? req.query.flair.trim().toLowerCase() : '';
    const minScore = parseNumber(req.query.minScore, 0);
    const onlyRedditHosted = parseBoolean(req.query.onlyRedditHosted, false);
    const searchScope = getSearchScope(req.query.searchScope);

    const rawListing = await fetchSubredditListing({
      subreddit,
      sort,
      after,
      limit,
      timeRange: topTimeRange,
      query: buildRedditQuery({ keyword, includeTerms, excludeTerms, searchScope })
    });

    const children = rawListing?.data?.children || [];

    const items = children
      .map((child) => normalizePost(child?.data))
      .filter(Boolean)
      .filter((item) => (includeNsfw ? true : !item.nsfw))
      .filter((item) => item.score >= minScore)
      .filter((item) => (onlyRedditHosted ? item.isRedditHosted : true))
      .filter((item) => (flair ? String(item.flair || '').toLowerCase() === flair : true));

    const availableFlairs = [...new Set(items.map((item) => item.flair).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    res.json({
      subreddit,
      sort,
      timeRange: topTimeRange,
      keyword,
      includeTerms,
      excludeTerms,
      flair: flair || null,
      searchScope,
      after: rawListing?.data?.after || null,
      count: items.length,
      availableFlairs,
      items
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'Subreddit not found' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;
