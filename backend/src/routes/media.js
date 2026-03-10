import express from 'express';
import { listMediaCreators, listMediaFeed, listMediaTags, queryMediaCatalog } from '../services/coomerClient.js';

const router = express.Router();

function parseLimit(value, fallback = 24, max = 60) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

router.get('/feed', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 24);
    const payload = await listMediaFeed(limit);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 24);
    const payload = await queryMediaCatalog({
      search: String(req.query.q || ''),
      creator: String(req.query.creator || ''),
      tag: String(req.query.tag || ''),
      service: String(req.query.service || ''),
      type: String(req.query.type || 'all'),
      sort: String(req.query.sort || 'newest'),
      after: req.query.after ? String(req.query.after) : null,
      limit
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/creators', async (req, res, next) => {
  try {
    const items = await listMediaCreators({
      search: String(req.query.q || ''),
      service: String(req.query.service || req.query.tag || ''),
      type: String(req.query.type || 'all')
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get('/tags', async (req, res, next) => {
  try {
    const items = await listMediaTags({
      search: String(req.query.q || ''),
      creator: String(req.query.creator || ''),
      type: String(req.query.type || 'all')
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

export default router;
