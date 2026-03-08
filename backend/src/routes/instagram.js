import express from 'express';
import { fetchInstagramBusinessDiscovery } from '../services/redditClient.js';
import { normalizeInstagramMedia } from '../utils/normalizeInstagram.js';
import { sanitizeLimit } from '../utils/normalizePost.js';

const router = express.Router();

router.get('/:username', async (req, res, next) => {
  try {
    const username = (req.params.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Instagram username is required' });
    }

    const limit = sanitizeLimit(req.query.limit || 24);
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;

    const raw = await fetchInstagramBusinessDiscovery({ username, after, limit });

    const discovery = raw?.business_discovery;
    const mediaNode = discovery?.media;

    if (!discovery) {
      return res.status(404).json({ error: 'Instagram user not found or inaccessible' });
    }

    const items = (mediaNode?.data || [])
      .map((entry) => normalizeInstagramMedia(entry, discovery.username || username))
      .filter(Boolean);

    res.json({
      source: 'instagram',
      username: discovery.username || username,
      after: mediaNode?.paging?.cursors?.after || null,
      count: items.length,
      items
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.status === 500 && error.message === 'Instagram API is not configured') {
      return res.status(500).json({ error: 'Instagram API is not configured. Add INSTAGRAM_APP_USER_ID and INSTAGRAM_ACCESS_TOKEN.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Instagram. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;