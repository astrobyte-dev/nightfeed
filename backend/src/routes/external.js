import express from 'express';
import { fetchRedgifsGif } from '../services/redgifsClient.js';

const router = express.Router();

router.get('/redgifs/:id', async (req, res, next) => {
  try {
    const payload = await fetchRedgifsGif(req.params.id);
    res.json(payload);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message || 'Invalid RedGIFs id' });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: 'RedGIFs item not found' });
    }
    next(error);
  }
});

router.head('/redgifs/:id/stream', async (req, res, next) => {
  try {
    const payload = await fetchRedgifsGif(req.params.id);
    const sourceUrl = payload?.videoUrl || payload?.previewUrl;
    if (!sourceUrl) return res.status(404).end();
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.status(200).end();
  } catch (error) {
    next(error);
  }
});

router.get('/redgifs/:id/stream', async (req, res, next) => {
  try {
    const payload = await fetchRedgifsGif(req.params.id);
    const sourceUrl = payload?.videoUrl || payload?.previewUrl;
    if (!sourceUrl) {
      return res.status(404).json({ error: 'No playable RedGIFs media' });
    }

    const range = req.headers.range;
    const upstream = await fetch(sourceUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        'User-Agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0',
        Referer: 'https://www.redgifs.com/',
        ...(range ? { Range: range } : {})
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
    }

    const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
    for (const header of passthrough) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    if (!upstream.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.status(upstream.status);

    if (upstream.body) {
      const reader = upstream.body.getReader();
      res.on('close', () => reader.cancel().catch(() => {}));
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!res.write(value)) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
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