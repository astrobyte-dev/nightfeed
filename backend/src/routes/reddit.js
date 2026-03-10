import express from 'express';

const router = express.Router();

function decodeRedditText(value) {
  return typeof value === 'string' ? value.replace(/&amp;/g, '&') : '';
}

function sanitizeLimit(value, fallback = 12) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(25, Math.max(1, parsed));
}

function normalizeComment(comment, depth = 0) {
  const data = comment?.data;
  if (!data || data.body === '[deleted]' || data.body === '[removed]') return null;

  const replies = data?.replies?.data?.children;
  const normalizedReplies = Array.isArray(replies)
    ? replies
        .filter((entry) => entry?.kind === 't1')
        .map((entry) => normalizeComment(entry, depth + 1))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    id: data.id,
    author: data.author || 'unknown',
    body: decodeRedditText(data.body || ''),
    score: data.score || 0,
    createdUtc: data.created_utc || null,
    depth,
    replies: normalizedReplies
  };
}

async function fetchRedditJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0'
    }
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

router.get('/comments', async (req, res, next) => {
  try {
    const permalink = String(req.query.permalink || '').trim();
    if (!permalink) {
      return res.status(400).json({ error: 'permalink is required' });
    }

    const safeLimit = sanitizeLimit(req.query.limit, 12);
    const path = permalink.replace(/^https?:\/\/www\.reddit\.com/i, '');
    const url = new URL(path.endsWith('/') ? `${path}.json` : `${path}/.json`, process.env.REDDIT_BASE_URL || 'https://www.reddit.com');
    url.searchParams.set('raw_json', '1');
    url.searchParams.set('limit', String(safeLimit));
    url.searchParams.set('depth', '2');
    url.searchParams.set('sort', 'top');

    const payload = await fetchRedditJson(url.toString());
    const listing = Array.isArray(payload) ? payload[1] : null;
    const comments = (listing?.data?.children || [])
      .filter((entry) => entry?.kind === 't1')
      .map((entry) => normalizeComment(entry, 0))
      .filter(Boolean)
      .slice(0, safeLimit);

    res.json({
      permalink,
      count: comments.length,
      comments
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'Comments not found' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;
