import express from 'express';

const router = express.Router();

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i;
const VIDEO_EXT_RE = /\.(?:mp4|webm|m3u8|mov)(?:\?.*)?$/i;
const GOFILE_HOST_RE = /(?:^|\.)gofile\.io$/i;
const BUNKR_HOST_RE = /(?:^|\.)bunkr\.[a-z.]+$/i;
const SIMPCITY_HOST_RE = /(?:^|\.)simpcity\.cr$/i;

function parseLimit(value, fallback = 18) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(40, Math.max(1, parsed));
}

function parsePage(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(999, Math.max(1, parsed));
}

function getBaseUrl() {
  return (process.env.SIMPCITY_BASE_URL || 'https://simpcity.cr').replace(/\/$/, '');
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/gi, '/');
}

function normalizePath(value) {
  if (!value) return '/whats-new/posts/';
  const trimmed = value.trim();
  if (!trimmed) return '/whats-new/posts/';

  try {
    const asUrl = new URL(trimmed);
    return `${asUrl.pathname}${asUrl.search}` || '/whats-new/posts/';
  } catch {
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
  }
}

function normalizeQuery(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildListingUrl(baseUrl, { path, query, page, titleOnly = true }) {
  if (query) {
    const url = new URL('/search/', `${baseUrl}/`);
    url.searchParams.set('q', query);
    url.searchParams.set('o', 'relevance');
    if (titleOnly) {
      url.searchParams.set('c[title_only]', '1');
    }
    if (page > 1) url.searchParams.set('page', String(page));
    return url.toString();
  }

  const url = new URL(path, `${baseUrl}/`);
  if (page > 1) {
    url.searchParams.set('page', String(page));
  } else {
    url.searchParams.delete('page');
  }
  return url.toString();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const headers = {
      'user-agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.8'
    };

    if (process.env.SIMPCITY_COOKIE) {
      headers.cookie = process.env.SIMPCITY_COOKIE;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });

    const body = await response.text();
    const looksBlocked = /cloudflare|attention required|captcha|just a moment|ddos-guard/i.test(body);

    if (!response.ok || looksBlocked) {
      const status = looksBlocked ? 502 : response.status;
      const error = new Error(looksBlocked ? 'SimpCity blocked automated requests (Cloudflare/CAPTCHA).' : `SimpCity request failed (${response.status}).`);
      error.status = status;
      throw error;
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0',
        accept: 'application/json,text/plain,*/*'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getQueryTokens(query) {
  return (query || '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function threadRelevanceScore(title, url, tokens) {
  if (!tokens.length) return 1;
  const haystack = `${title || ''} ${url || ''}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function isLikelyNoiseThread(title, url) {
  const text = `${title || ''} ${url || ''}`.toLowerCase();
  return /forum rules|rules and announcements|welcome to simpcity|faq|how to use|privacy policy|terms of service/.test(text);
}

function extractThreadLinks(html, baseUrl, query = '') {
  const threadRe = /<a[^>]+href=["']([^"']*\/threads\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out = [];
  const seen = new Set();
  const tokens = getQueryTokens(query);
  let match;

  while ((match = threadRe.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[1]);
    const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

    let absolute;
    try {
      absolute = new URL(href, `${baseUrl}/`).toString();
    } catch {
      continue;
    }

    if (seen.has(absolute)) continue;
    seen.add(absolute);

    const thread = {
      url: absolute,
      title: text || 'SimpCity thread'
    };

    if (isLikelyNoiseThread(thread.title, thread.url)) continue;

    const score = threadRelevanceScore(thread.title, thread.url, tokens);
    if (tokens.length > 0 && score === 0) continue;

    out.push({ ...thread, score });
  }

  return out.sort((a, b) => (b.score || 0) - (a.score || 0));
}

function isImageUrl(url) {
  return IMAGE_EXT_RE.test(url);
}

function isVideoUrl(url) {
  return VIDEO_EXT_RE.test(url);
}

function isGofileUrl(url) {
  try {
    const parsed = new URL(url);
    return GOFILE_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function isBunkrUrl(url) {
  try {
    const parsed = new URL(url);
    return BUNKR_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function maybeDecodeEmbeddedUrl(url) {
  try {
    const parsed = new URL(url);
    const paramCandidates = ['url', 'u', 'target', 'r', 'redirect'];
    for (const key of paramCandidates) {
      const value = parsed.searchParams.get(key);
      if (!value) continue;
      try {
        return new URL(decodeURIComponent(value), url).toString();
      } catch {
        // ignore
      }
    }

    const pathMatch = parsed.pathname.match(/https?:\/\/[^\s]+/i);
    if (pathMatch?.[0]) {
      return decodeURIComponent(pathMatch[0]);
    }
  } catch {
    // ignore
  }

  return null;
}

function isLikelySimpcityMediaUrl(url) {
  try {
    const parsed = new URL(url);
    if (!SIMPCITY_HOST_RE.test(parsed.hostname)) return true;

    const path = parsed.pathname.toLowerCase();
    if (/^\/(styles|js|css|images|favicon|avatars|emoji)\//.test(path)) return false;
    if (/logo|favicon|sprite|icon/.test(path)) return false;

    return true;
  } catch {
    return false;
  }
}

function extractAuthor(html) {
  const direct = html.match(/data-author=["']([^"']+)["']/i)?.[1];
  if (direct) return decodeHtmlEntities(direct.trim());

  const meta = html.match(/<a[^>]*class=["'][^"']*username[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
  if (!meta) return null;

  const clean = decodeHtmlEntities(meta.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  return clean || null;
}

function extractCandidateUrlsFromThread(html, threadUrl) {
  const attrRe = /(href|src|data-src|data-url|poster)=["']([^"']+)["']/gi;
  const seen = new Set();
  const candidates = [];
  let match;

  while ((match = attrRe.exec(html)) !== null) {
    const raw = decodeHtmlEntities(match[2]);
    if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;

    let absolute;
    try {
      absolute = new URL(raw, threadUrl).toString();
    } catch {
      continue;
    }

    const embedded = maybeDecodeEmbeddedUrl(absolute);
    const urlVariants = embedded ? [absolute, embedded] : [absolute];

    for (const variant of urlVariants) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      candidates.push(variant);
    }
  }

  return candidates;
}

function uniquePush(list, values) {
  for (const value of values) {
    if (!list.includes(value)) list.push(value);
  }
}

async function resolveGofileMedia(url) {
  const out = [];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return out;
  }

  if (isImageUrl(url) || isVideoUrl(url)) {
    out.push(url);
    return out;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  const id = parts[1] || parts[0];
  if (!id) return out;

  const apiUrl = `https://api.gofile.io/contents/${encodeURIComponent(id)}?wt=4fd6sg89d7s6&cache=true`;
  const json = await fetchJson(apiUrl);
  if (!json?.data) return out;

  const scanNode = (node) => {
    if (!node || typeof node !== 'object') return;

    if (typeof node.link === 'string' && (isImageUrl(node.link) || isVideoUrl(node.link))) {
      out.push(node.link);
    }

    const contents = node.contents;
    if (contents && typeof contents === 'object') {
      Object.values(contents).forEach((child) => scanNode(child));
    }
  };

  scanNode(json.data);
  return out;
}

async function resolveBunkrMedia(url) {
  const out = [];

  if (isImageUrl(url) || isVideoUrl(url)) {
    out.push(url);
    return out;
  }

  const html = await fetchHtml(url).catch(() => null);
  if (!html) return out;

  const re = /(src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const raw = decodeHtmlEntities(match[2]);
    if (!raw) continue;

    let absolute;
    try {
      absolute = new URL(raw, url).toString();
    } catch {
      continue;
    }

    if (isImageUrl(absolute) || isVideoUrl(absolute)) {
      out.push(absolute);
    }
  }

  return out;
}

async function resolveExternalMedia(candidates) {
  const directImages = [];
  const directVideos = [];
  const externalCandidates = [];

  for (const candidate of candidates) {
    if (isVideoUrl(candidate)) {
      if (isLikelySimpcityMediaUrl(candidate)) uniquePush(directVideos, [candidate]);
      continue;
    }
    if (isImageUrl(candidate)) {
      if (isLikelySimpcityMediaUrl(candidate)) uniquePush(directImages, [candidate]);
      continue;
    }

    if (isGofileUrl(candidate) || isBunkrUrl(candidate)) {
      externalCandidates.push(candidate);
    }
  }

  for (const candidate of externalCandidates.slice(0, 16)) {
    const resolved = isGofileUrl(candidate) ? await resolveGofileMedia(candidate) : await resolveBunkrMedia(candidate);
    for (const mediaUrl of resolved) {
      if (isVideoUrl(mediaUrl)) uniquePush(directVideos, [mediaUrl]);
      else if (isImageUrl(mediaUrl)) uniquePush(directImages, [mediaUrl]);
    }
  }

  return { images: directImages, videos: directVideos };
}

async function normalizeThreadToMedia(thread, html) {
  const candidates = extractCandidateUrlsFromThread(html, thread.url);
  const { videos, images } = await resolveExternalMedia(candidates);
  if (!videos.length && !images.length) return null;

  const author = extractAuthor(html) || 'simpcity';
  const thumbnail = images[0] || videos[0] || null;
  const id = `sc_${Buffer.from(thread.url).toString('base64url').slice(0, 16)}`;

  if (videos.length) {
    return {
      id,
      source: 'simpcity',
      title: thread.title,
      permalink: thread.url,
      author,
      subreddit: 'simpcity',
      createdUtc: null,
      score: 0,
      nsfw: true,
      type: 'video',
      thumbnail,
      mediaUrl: videos[0],
      galleryItems: images.slice(0, 12).map((url, index) => ({
        id: `${id}_img_${index}`,
        kind: 'image',
        url,
        width: null,
        height: null
      })),
      videoUrl: videos[0],
      videoDurationSec: null
    };
  }

  if (images.length > 1) {
    return {
      id,
      source: 'simpcity',
      title: thread.title,
      permalink: thread.url,
      author,
      subreddit: 'simpcity',
      createdUtc: null,
      score: 0,
      nsfw: true,
      type: 'gallery',
      thumbnail: images[0],
      mediaUrl: images[0],
      galleryItems: images.map((url, index) => ({
        id: `${id}_img_${index}`,
        kind: 'image',
        url,
        width: null,
        height: null
      })),
      videoUrl: null
    };
  }

  return {
    id,
    source: 'simpcity',
    title: thread.title,
    permalink: thread.url,
    author,
    subreddit: 'simpcity',
    createdUtc: null,
    score: 0,
    nsfw: true,
    type: 'image',
    thumbnail: images[0],
    mediaUrl: images[0],
    galleryItems: [],
    videoUrl: null
  };
}

async function buildItemsFromListing({ listingHtml, baseUrl, query, limit }) {
  const threadLinks = extractThreadLinks(listingHtml, baseUrl, query).slice(0, Math.max(18, limit * 4));
  const items = [];

  for (const thread of threadLinks) {
    if (items.length >= limit) break;
    try {
      const threadHtml = await fetchHtml(thread.url);
      const normalized = await normalizeThreadToMedia(thread, threadHtml);
      if (normalized) items.push(normalized);
    } catch {
      // Skip inaccessible threads and continue.
    }
  }

  return items;
}

router.get('/feed', async (req, res, next) => {
  try {
    const baseUrl = getBaseUrl();
    const path = normalizePath(typeof req.query.path === 'string' ? req.query.path : '/whats-new/posts/');
    const query = normalizeQuery(typeof req.query.q === 'string' ? req.query.q : req.query.query);
    const page = parsePage(req.query.after || req.query.page || 1, 1);
    const limit = parseLimit(req.query.limit, 18);

    const listingUrl = buildListingUrl(baseUrl, { path, query, page, titleOnly: true });
    const listingHtml = await fetchHtml(listingUrl);
    let items = await buildItemsFromListing({ listingHtml, baseUrl, query, limit });

    if (items.length === 0 && query) {
      const fallbackUrl = buildListingUrl(baseUrl, { path, query, page, titleOnly: false });
      const fallbackHtml = await fetchHtml(fallbackUrl);
      items = await buildItemsFromListing({ listingHtml: fallbackHtml, baseUrl, query, limit });
    }

    const hasNext = /rel=["']next["']|pageNav-jump--next|\bpage=\d+[^"']*["'][^>]*>\s*Next\s*</i.test(listingHtml);

    res.json({
      source: 'simpcity',
      query: query || null,
      path,
      after: hasNext ? String(page + 1) : null,
      count: items.length,
      items
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'SimpCity request timed out.' });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
