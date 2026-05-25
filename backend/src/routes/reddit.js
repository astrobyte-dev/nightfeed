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

const relatedCache = new Map();
const RELATED_TTL = 30 * 60 * 1000;

router.get('/related/:subreddit', async (req, res, next) => {
  try {
    const raw = String(req.params.subreddit || '').trim().replace(/^r\//i, '');
    if (!raw) return res.json({ items: [] });
    if (raw.includes('+')) {
      // Multireddit — flatten and recurse via search per leaf
      return res.json({ items: [] });
    }

    const cacheKey = raw.toLowerCase();
    const cached = relatedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.value);
    }

    const aboutUrl = new URL(`/r/${encodeURIComponent(raw)}/about.json`, process.env.REDDIT_BASE_URL || 'https://www.reddit.com');
    aboutUrl.searchParams.set('raw_json', '1');

    let publicDescription = '';
    let displayName = raw;
    try {
      const aboutPayload = await fetchRedditJson(aboutUrl.toString());
      publicDescription = decodeRedditText(aboutPayload?.data?.public_description || aboutPayload?.data?.title || '').trim();
      displayName = aboutPayload?.data?.display_name || raw;
    } catch (error) {
      // Continue with just the name
    }

    const queryTokens = new Set();
    queryTokens.add(displayName);
    if (publicDescription) {
      const words = publicDescription
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
      for (const w of words.slice(0, 4)) queryTokens.add(w);
    }
    const searchQuery = Array.from(queryTokens).slice(0, 5).join(' ');

    const searchUrl = new URL('/subreddits/search.json', process.env.REDDIT_BASE_URL || 'https://www.reddit.com');
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('limit', '24');
    searchUrl.searchParams.set('include_over_18', 'on');
    searchUrl.searchParams.set('raw_json', '1');

    const payload = await fetchRedditJson(searchUrl.toString());
    const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
    const items = children
      .map((entry) => {
        const data = entry?.data;
        if (!data) return null;
        const name = String(data.display_name || '').trim();
        if (!name || name.toLowerCase() === raw.toLowerCase()) return null;
        if (!data.over18) return null;
        return {
          name,
          title: decodeRedditText(data.title || data.public_description || ''),
          description: decodeRedditText(data.public_description || ''),
          subscribers: Number.isFinite(data.subscribers) ? data.subscribers : 0,
          nsfw: true,
          icon: decodeRedditText(data.icon_img || data.community_icon || '').split('?')[0] || null
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 14);

    const value = { source: raw, query: searchQuery, items };
    relatedCache.set(cacheKey, { value, expiresAt: Date.now() + RELATED_TTL });
    res.json(value);
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','your','you','our','are','was','were','have','has','will','can','any','all','one','two','three','use','com','www','reddit','subreddit','community','place','about','share','post','posts','daily','only','please','more','more','also'
]);

router.get('/search-subreddits', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ items: [] });
    }
    const includeNsfw = req.query.nsfw !== '0';
    const limit = Math.min(25, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));

    const url = new URL('/subreddits/search.json', process.env.REDDIT_BASE_URL || 'https://www.reddit.com');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('include_over_18', includeNsfw ? 'on' : 'off');
    url.searchParams.set('raw_json', '1');

    const payload = await fetchRedditJson(url.toString());
    const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
    const items = children
      .map((entry) => {
        const data = entry?.data;
        if (!data) return null;
        return {
          name: String(data.display_name || '').trim(),
          title: decodeRedditText(data.title || data.public_description || ''),
          subscribers: Number.isFinite(data.subscribers) ? data.subscribers : 0,
          nsfw: Boolean(data.over18),
          icon: decodeRedditText(data.icon_img || data.community_icon || '').split('?')[0] || null,
          banner: decodeRedditText(data.banner_img || data.banner_background_image || '').split('?')[0] || null,
          description: decodeRedditText(data.public_description || ''),
          createdUtc: data.created_utc || null
        };
      })
      .filter((entry) => entry && entry.name);

    res.json({ q, items });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Reddit. Please retry shortly.' });
    }
    next(error);
  }
});

export default router;
