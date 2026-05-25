import express from 'express';

const router = express.Router();

const ALLOWED_ORDERS = new Set(['relevance', 'date', 'rating', 'viewCount', 'title']);

function isoDurationToSeconds(iso) {
  if (!iso) return null;
  const match = String(iso).match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

function normalizeYouTubeItem(searchItem, details) {
  const id = searchItem?.id?.videoId;
  if (!id) return null;
  const snippet = searchItem.snippet || {};
  const detail = details?.[id] || {};
  const thumbnails = snippet.thumbnails || {};
  const bestThumb = thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default || {};

  const duration = isoDurationToSeconds(detail.contentDetails?.duration);
  const views = Number(detail.statistics?.viewCount) || 0;
  const likes = Number(detail.statistics?.likeCount) || 0;

  return {
    source: 'youtube',
    id: `youtube_${id}`,
    type: 'video',
    title: snippet.title || 'Untitled',
    author: snippet.channelTitle || 'youtube',
    subreddit: 'youtube',
    permalink: `https://www.youtube.com/watch?v=${id}`,
    createdUtc: snippet.publishedAt ? Math.floor(new Date(snippet.publishedAt).getTime() / 1000) : null,
    score: likes,
    numComments: views,
    flair: snippet.channelTitle || null,
    nsfw: false,
    thumbnail: bestThumb.url || null,
    mediaUrl: `https://www.youtube.com/embed/${id}`,
    galleryItems: [],
    videoUrl: null,
    videoHlsUrl: null,
    videoDashUrl: null,
    videoHasAudio: true,
    videoAudioUrls: [],
    videoDurationSec: duration,
    videoSourceKind: 'embed',
    videoIsPreviewSource: false,
    canPlayFullAudioInApp: true,
    externalVideoProvider: 'YouTube',
    externalVideoId: id,
    externalVideoEmbedUrl: `https://www.youtube.com/embed/${id}`,
    externalVideoPageUrl: `https://www.youtube.com/watch?v=${id}`,
    externalVideoPosterUrl: bestThumb.url || null,
    externalVideoWidth: bestThumb.width || 1280,
    externalVideoHeight: bestThumb.height || 720,
    sourceHost: 'youtube.com',
    isRedditHosted: false
  };
}

router.get('/search', async (req, res, next) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'YouTube source is not configured. Set YOUTUBE_API_KEY in backend/.env' });
    }

    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ items: [], after: null });

    const order = ALLOWED_ORDERS.has(req.query.order) ? req.query.order : 'relevance';
    const pageToken = String(req.query.pageToken || '').trim();
    const maxResults = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 25));

    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('order', order);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('safeSearch', 'none');
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('key', apiKey);
    if (pageToken) searchUrl.searchParams.set('pageToken', pageToken);

    const searchResp = await fetch(searchUrl.toString(), { headers: { Accept: 'application/json' } });
    if (!searchResp.ok) {
      const detail = await searchResp.text();
      return res.status(searchResp.status).json({ error: 'YouTube search failed', detail: detail.slice(0, 300) });
    }

    const searchPayload = await searchResp.json();
    const items = Array.isArray(searchPayload?.items) ? searchPayload.items : [];
    const ids = items.map((it) => it?.id?.videoId).filter(Boolean);

    let detailsMap = {};
    if (ids.length > 0) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailsUrl.searchParams.set('part', 'contentDetails,statistics');
      detailsUrl.searchParams.set('id', ids.join(','));
      detailsUrl.searchParams.set('key', apiKey);
      const detailsResp = await fetch(detailsUrl.toString(), { headers: { Accept: 'application/json' } });
      if (detailsResp.ok) {
        const detailsPayload = await detailsResp.json();
        for (const item of detailsPayload?.items || []) {
          if (item?.id) detailsMap[item.id] = item;
        }
      }
    }

    const normalized = items.map((it) => normalizeYouTubeItem(it, detailsMap)).filter(Boolean);

    res.json({
      items: normalized,
      after: searchPayload?.nextPageToken || null,
      query,
      order
    });
  } catch (error) {
    next(error);
  }
});

export default router;
