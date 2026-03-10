const REDGIFS_TOKEN_URL = 'https://api.redgifs.com/v2/auth/temporary';
const REDGIFS_GIF_URL = 'https://api.redgifs.com/v2/gifs';
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const GIF_CACHE_TTL_MS = 10 * 60 * 1000;

let tokenCache = null;
const gifCache = new Map();

function readCacheEntry(key) {
  const cached = gifCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    gifCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCacheEntry(key, value) {
  gifCache.set(key, {
    value,
    expiresAt: Date.now() + GIF_CACHE_TTL_MS
  });
}

function decodeJwtExpiry(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(parsed?.exp) ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getTemporaryToken() {
  if (tokenCache?.token && tokenCache.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
    return tokenCache.token;
  }

  const response = await fetch(REDGIFS_TOKEN_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0'
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`RedGIFs token request failed (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const token = payload?.token;
  if (!token) {
    throw new Error('RedGIFs token response was missing a token');
  }

  tokenCache = {
    token,
    expiresAt: decodeJwtExpiry(token) || (Date.now() + 60 * 60 * 1000)
  };

  return token;
}

function normalizeGif(gif) {
  return {
    id: gif?.id || null,
    provider: 'RedGIFs',
    width: Number.isFinite(gif?.width) ? Number(gif.width) : null,
    height: Number.isFinite(gif?.height) ? Number(gif.height) : null,
    duration: Number.isFinite(gif?.duration) ? Number(gif.duration) : null,
    hasAudio: gif?.hasAudio === true,
    videoUrl: gif?.urls?.hd || gif?.urls?.sd || gif?.urls?.silent || null,
    previewUrl: gif?.urls?.sd || gif?.urls?.hd || gif?.urls?.silent || null,
    posterUrl: gif?.urls?.poster || gif?.urls?.thumbnail || null,
    pageUrl: gif?.urls?.html ? String(gif.urls.html).replace('/ifr/', '/watch/') : null,
    embedUrl: gif?.urls?.html || null
  };
}

export async function fetchRedgifsGif(id) {
  const normalizedId = String(id || '').trim().toLowerCase();
  if (!normalizedId) {
    const error = new Error('RedGIFs id is required');
    error.status = 400;
    throw error;
  }

  const cached = readCacheEntry(normalizedId);
  if (cached) return cached;

  const token = await getTemporaryToken();
  const response = await fetch(`${REDGIFS_GIF_URL}/${encodeURIComponent(normalizedId)}?views=yes`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.REDDIT_USER_AGENT || 'SubredditMediaViewer/1.0'
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`RedGIFs gif request failed (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const normalized = normalizeGif(payload?.gif || null);
  writeCacheEntry(normalizedId, normalized);
  return normalized;
}