import express from 'express';
import { fetchUserSubmittedListing } from '../services/redditClient.js';
import { normalizePost, sanitizeLimit, sanitizeSort } from '../utils/normalizePost.js';

const router = express.Router();

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

router.get('/:username', async (req, res, next) => {
  try {
    const username = (req.params.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const sort = sanitizeSort(req.query.sort);
    const limit = sanitizeLimit(req.query.limit);
    const includeNsfw = parseBoolean(req.query.includeNsfw, false);
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;

    const rawListing = await fetchUserSubmittedListing({
      username,
      sort,
      after,
      limit
    });

    const children = rawListing?.data?.children || [];
    const items = children
      .map((child) => normalizePost(child?.data))
      .filter(Boolean)
      .filter((item) => (includeNsfw ? true : !item.nsfw));

    res.json({
      username,
      sort,
      after: rawListing?.data?.after || null,
      count: items.length,
      items
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'Reddit user not found' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;