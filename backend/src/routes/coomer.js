import express from 'express';
import { queryMediaCatalog } from '../services/coomerClient.js';

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim();
    const after = req.query.after ? String(req.query.after) : null;
    const type = ['video', 'image', 'audio', 'all'].includes(req.query.type) ? req.query.type : 'all';
    const sort = req.query.sort === 'popular' ? 'popular' : 'newest';
    const limit = Math.max(1, Math.min(60, Number.parseInt(req.query.limit, 10) || 36));

    const data = await queryMediaCatalog({
      search,
      type,
      sort,
      after,
      limit
    });

    res.json({
      items: data.items || [],
      after: data.after || null,
      total: data.total || 0,
      query: data.query
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: 'Coomer rate-limited. Please retry shortly.' });
    }
    next(error);
  }
});

router.get('/stream', async (req, res, next) => {
  try {
    const target = String(req.query.url || '');
    if (!target || !/^https?:\/\/[a-z0-9.-]*coomer\.(?:su|st|party)\//i.test(target)) {
      return res.status(400).json({ error: 'Invalid coomer media URL' });
    }

    const range = req.headers.range;
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Referer: 'https://coomer.st/',
        ...(range ? { Range: range } : {})
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).end();
    }

    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    if (!upstream.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(upstream.status);

    if (upstream.body) {
      const reader = upstream.body.getReader();
      res.on('close', () => reader.cancel().catch(() => {}));
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!res.write(value)) await new Promise((resolve) => res.once('drain', resolve));
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
