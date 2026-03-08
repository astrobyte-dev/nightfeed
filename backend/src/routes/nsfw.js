import express from 'express';
import { fetchNewSubreddits } from '../services/redditClient.js';
import { sanitizeLimit } from '../utils/normalizePost.js';

const router = express.Router();

router.get('/new', async (req, res, next) => {
  try {
    const limit = sanitizeLimit(req.query.limit || 30);
    const rawListing = await fetchNewSubreddits(limit);

    const items = (rawListing?.data?.children || [])
      .map((child) => child?.data)
      .filter(Boolean)
      .filter((entry) => Boolean(entry.over18))
      .map((entry) => ({
        id: entry.id,
        name: entry.display_name,
        title: entry.title || entry.display_name,
        subscribers: entry.subscribers || 0,
        createdUtc: entry.created_utc || null,
        url: `https://www.reddit.com/r/${entry.display_name}`
      }));

    res.json({
      count: items.length,
      items
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;