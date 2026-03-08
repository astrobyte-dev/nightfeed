import express from 'express';

const router = express.Router();

const ALLOWED_ORDER = new Set(['relevance', 'date', 'viewCount', 'rating', 'title']);
const CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map();

function parseLimit(value, fallback = 24) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(50, Math.max(1, parsed));
}

function parseIso8601Duration(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/i);
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function sanitizeErrorMessage(message) {
  if (!message) return 'Failed to fetch YouTube results';
  return String(message).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseYouTubeError(payload, fallbackStatus = 500) {
  const errorObj = payload?.error;
  const reasons = Array.isArray(errorObj?.errors) ? errorObj.errors.map((entry) => entry?.reason).filter(Boolean) : [];
  const quotaReasons = new Set(['quotaExceeded', 'dailyLimitExceeded', 'dailyLimitExceededUnreg', 'rateLimitExceeded']);
  const isQuota = reasons.some((reason) => quotaReasons.has(reason));

  if (isQuota) {
    return {
      status: 429,
      isQuota: true,
      message: 'YouTube API quota exceeded for now. Try again later.'
    };
  }

  return {
    status: fallbackStatus,
    isQuota: false,
    message: sanitizeErrorMessage(errorObj?.message || 'Failed to fetch YouTube results')
  };
}

function makeCacheKey({ query, category, order, pageToken, limit }) {
  return JSON.stringify({ query, category, order, pageToken: pageToken || null, limit });
}

function getCachedResponse(cacheKey, { allowStale = false } = {}) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;

  if (!allowStale && entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return entry.payload;
}

function setCachedResponse(cacheKey, payload) {
  responseCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload
  });

  if (responseCache.size > 150) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
}

function normalizeYouTubeItem(searchItem, videoDetails) {
  const videoId = searchItem?.id?.videoId;
  const snippet = searchItem?.snippet;
  if (!videoId || !snippet) return null;

  if (videoDetails?.status?.embeddable === false) {
    return null;
  }
  if (videoDetails?.status?.privacyStatus && videoDetails.status.privacyStatus !== 'public') {
    return null;
  }
  if (videoDetails?.status?.uploadStatus && videoDetails.status.uploadStatus !== 'processed') {
    return null;
  }

  const ytRating = videoDetails?.contentDetails?.contentRating?.ytRating;
  if (ytRating === 'ytAgeRestricted') {
    return null;
  }

  const thumbnail =
    snippet?.thumbnails?.maxres?.url ||
    snippet?.thumbnails?.standard?.url ||
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.default?.url ||
    null;

  const published = snippet.publishedAt ? Math.floor(new Date(snippet.publishedAt).getTime() / 1000) : null;
  const duration = parseIso8601Duration(videoDetails?.contentDetails?.duration);
  const viewCount = Number.parseInt(videoDetails?.statistics?.viewCount || '0', 10) || 0;

  return {
    id: `yt_${videoId}`,
    source: 'youtube',
    title: snippet.title || 'Untitled video',
    permalink: `https://www.youtube.com/watch?v=${videoId}`,
    author: snippet.channelTitle || 'YouTube Creator',
    subreddit: 'youtube',
    createdUtc: published,
    score: viewCount,
    nsfw: false,
    type: 'video',
    thumbnail,
    mediaUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
    videoHlsUrl: null,
    videoDashUrl: null,
    videoAudioUrls: [],
    videoHasAudio: true,
    videoDurationSec: duration,
    galleryItems: []
  };
}

router.get('/search', async (req, res, next) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API is not configured. Add YOUTUBE_API_KEY.' });
    }

    const rawQuery = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const query = [rawQuery, category].filter(Boolean).join(' ').trim();

    if (!query) {
      return res.status(400).json({ error: 'YouTube search query is required' });
    }

    const order = ALLOWED_ORDER.has(req.query.order) ? req.query.order : 'relevance';
    const pageToken = typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined;
    const limit = parseLimit(req.query.limit, 24);

    const cacheKey = makeCacheKey({ query, category, order, pageToken, limit });
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('videoSyndicated', 'true');
    searchUrl.searchParams.set('order', order);
    searchUrl.searchParams.set('safeSearch', 'none');
    searchUrl.searchParams.set('maxResults', String(limit));
    searchUrl.searchParams.set('key', apiKey);
    if (pageToken) searchUrl.searchParams.set('pageToken', pageToken);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      const payload = await searchResponse.json().catch(() => ({}));
      const parsedError = parseYouTubeError(payload, searchResponse.status);
      const stale = parsedError.isQuota ? getCachedResponse(cacheKey, { allowStale: true }) : null;
      if (stale) {
        return res.json({ ...stale, warning: 'Serving cached YouTube results due to quota limits.' });
      }
      return res.status(parsedError.status).json({ error: parsedError.message });
    }

    const searchJson = await searchResponse.json();
    const searchItems = Array.isArray(searchJson.items) ? searchJson.items : [];
    const videoIds = searchItems.map((item) => item?.id?.videoId).filter(Boolean);

    let detailsMap = new Map();
    if (videoIds.length > 0) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailsUrl.searchParams.set('part', 'contentDetails,statistics,status');
      detailsUrl.searchParams.set('id', videoIds.join(','));
      detailsUrl.searchParams.set('key', apiKey);

      const detailsResponse = await fetch(detailsUrl.toString());
      if (detailsResponse.ok) {
        const detailsJson = await detailsResponse.json();
        const detailsItems = Array.isArray(detailsJson.items) ? detailsJson.items : [];
        detailsMap = new Map(detailsItems.map((item) => [item.id, item]));
      }
    }

    const items = searchItems
      .map((item) => normalizeYouTubeItem(item, detailsMap.get(item?.id?.videoId)))
      .filter(Boolean);

    const result = {
      source: 'youtube',
      query,
      category,
      order,
      after: searchJson.nextPageToken || null,
      count: items.length,
      items
    };

    setCachedResponse(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
