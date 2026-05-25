import express from 'express';

const router = express.Router();

const ALLOWED_ORDERS = new Set(['latest', 'longest', 'shortest', 'top-rated', 'most-popular', 'top-weekly', 'top-monthly']);

function normalizeVideo(video) {
  if (!video?.id) return null;
  const keywords = String(video.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const thumbnail = video.default_thumb?.src || video.thumbs?.[0]?.src || null;
  const width = Number(video.default_thumb?.width) || null;
  const height = Number(video.default_thumb?.height) || null;
  const lengthSec = Number(video.length_sec) || null;
  const rate = Number.parseFloat(video.rate || '0') || 0;
  const views = Number(video.views) || 0;

  return {
    source: 'eporner',
    id: `eporner_${video.id}`,
    type: 'video',
    title: String(video.title || '').trim() || 'Untitled',
    author: keywords[0] || 'eporner',
    subreddit: 'eporner',
    permalink: video.url || `https://www.eporner.com/video-${video.id}/`,
    createdUtc: video.added ? Math.floor(new Date(video.added.replace(' ', 'T') + 'Z').getTime() / 1000) : null,
    score: Math.round(rate * 10),
    numComments: views,
    flair: keywords.slice(0, 3).join(' · ') || null,
    nsfw: true,
    thumbnail,
    mediaUrl: video.embed,
    galleryItems: [],
    videoUrl: null,
    videoHlsUrl: null,
    videoDashUrl: null,
    videoHasAudio: true,
    videoAudioUrls: [],
    videoDurationSec: lengthSec,
    videoSourceKind: 'embed',
    videoIsPreviewSource: false,
    canPlayFullAudioInApp: true,
    externalVideoProvider: 'Eporner',
    externalVideoId: video.id,
    externalVideoEmbedUrl: video.embed,
    externalVideoPageUrl: video.url,
    externalVideoPosterUrl: thumbnail,
    externalVideoWidth: width,
    externalVideoHeight: height,
    sourceHost: 'eporner.com',
    isRedditHosted: false
  };
}

router.get('/search', async (req, res, next) => {
  try {
    const includeRaw = String(req.query.include || '').split(',').map((s) => s.trim()).filter(Boolean);
    const excludeRaw = String(req.query.exclude || '').split(',').map((s) => s.trim()).filter(Boolean);
    const performersRaw = String(req.query.performers || '').split(',').map((s) => s.trim()).filter(Boolean);
    const baseQuery = String(req.query.q || '').trim();

    const queryParts = [];
    if (baseQuery && baseQuery !== 'all') queryParts.push(baseQuery);
    for (const tag of includeRaw) queryParts.push(tag);
    for (const tag of performersRaw) queryParts.push(tag);
    for (const tag of excludeRaw) queryParts.push(`-${tag}`);
    const query = queryParts.join(' ').trim() || 'all';

    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const perPage = Math.max(1, Math.min(60, Number.parseInt(req.query.per_page, 10) || 30));
    const order = ALLOWED_ORDERS.has(req.query.order) ? req.query.order : 'most-popular';

    const url = new URL('https://www.eporner.com/api/v2/video/search/');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    url.searchParams.set('thumbsize', 'big');
    url.searchParams.set('order', order);
    url.searchParams.set('gay', '0');
    url.searchParams.set('lq', '1');
    url.searchParams.set('format', 'json');

    const upstream = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0'
      }
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: `Eporner returned ${upstream.status}`, detail });
    }

    const payload = await upstream.json();
    const videos = Array.isArray(payload?.videos) ? payload.videos : [];
    const items = videos.map(normalizeVideo).filter(Boolean);

    const totalPages = Number(payload?.total_pages) || 0;
    const after = page < totalPages ? String(page + 1) : null;

    res.json({
      items,
      after,
      page,
      totalPages,
      totalCount: payload?.total_count || 0,
      query,
      order
    });
  } catch (error) {
    next(error);
  }
});

export default router;
