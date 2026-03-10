const COOMER_BASE_URL = 'https://coomer.st';
const DEFAULT_QUERY = 'feet';
const SEARCH_PAGE_SIZE = 50;
const SIDEBAR_PAGE_LIMIT = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;

const responseCache = new Map();
const inFlightRequests = new Map();

function isOpaqueCreatorId(value) {
  return /^\d+$/.test(String(value || '').trim());
}

function buildCreatorKey(service, creatorId) {
  return `${String(service || '').trim().toLowerCase()}:${String(creatorId || '').trim()}`;
}

function sanitizeLimit(value, fallback = 24, max = 60) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

function sanitizeOffset(value) {
  const parsed = Number.parseInt(value || '0', 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, COOMER_BASE_URL).toString();
  } catch {
    return null;
  }
}

function getExtension(name = '') {
  const clean = String(name).split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.at(-1).toLowerCase() : '';
}

function inferMediaType(file) {
  const source = file?.path || file?.file || file?.name || file?.url || '';
  const mime = file?.mimetype || file?.mime_type || '';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';

  const ext = getExtension(source);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext)) return 'audio';
  return 'other';
}

function summarizeText(value = '') {
  return stripHtml(value);
}

function searchTermForQuery({ search = '', creator = '' } = {}) {
  return String(search || creator || DEFAULT_QUERY).trim();
}

function buildPostPermalink(post) {
  const service = String(post?.service || '').trim();
  const creator = String(post?.user || post?.creatorId || post?.name || '').trim();
  const id = String(post?.id || '').trim();
  if (!service || !creator || !id) return COOMER_BASE_URL;
  return `${COOMER_BASE_URL}/${service}/user/${encodeURIComponent(creator)}/post/${encodeURIComponent(id)}`;
}

function collectMedia(post) {
  const items = [];
  const primaryFile = post?.file && typeof post.file === 'object' ? post.file : null;

  if (primaryFile && (primaryFile.path || primaryFile.file || primaryFile.url)) {
    items.push({
      name: primaryFile.name || 'Primary file',
      type: inferMediaType(primaryFile),
      url: normalizeUrl(primaryFile.path || primaryFile.file || primaryFile.url)
    });
  }

  for (const attachment of Array.isArray(post?.attachments) ? post.attachments : []) {
    items.push({
      name: attachment.name || 'Attachment',
      type: inferMediaType(attachment),
      url: normalizeUrl(attachment.path || attachment.file || attachment.url)
    });
  }

  const deduped = new Map();
  for (const item of items) {
    if (item.url && item.type !== 'other') deduped.set(item.url, item);
  }
  return Array.from(deduped.values());
}

function buildNormalizedItem(post) {
  const media = collectMedia(post);
  if (!media.length) return null;

  const images = media.filter((item) => item.type === 'image');
  const videos = media.filter((item) => item.type === 'video');
  const audios = media.filter((item) => item.type === 'audio');
  const creatorId = String(post?.creatorId || post?.user || post?.name || '');
  const creator = String(post?.creatorName || post?.name || post?.user || 'Unknown creator');
  const service = String(post?.service || 'coomer');
  const content = summarizeText(post?.substring || post?.content || post?.text || '');
  const title = stripHtml(post?.title || content.slice(0, 120) || `${creator} post`);
  const createdUtc = post?.published ? Math.floor(new Date(post.published).getTime() / 1000) : null;
  const permalink = buildPostPermalink(post);
  const serviceLabel = service.charAt(0).toUpperCase() + service.slice(1);

  const base = {
    id: `coomer_${service}_${creator}_${post?.id}`,
    source: 'library',
    creator,
    creatorId,
    creatorKey: buildCreatorKey(service, creatorId || creator),
    author: creator,
    service,
    tags: [service],
    title,
    permalink,
    createdUtc,
    score: 0,
    numComments: 0,
    category: serviceLabel,
    subreddit: serviceLabel,
    sourceHost: 'coomer.st',
    isRedditHosted: false,
    thumbnail: images[0]?.url || null,
    previewUrl: videos[0]?.url || null,
    mediaCount: media.length,
    content
  };

  if (videos.length) {
    const video = videos[0];
    return {
      ...base,
      type: 'video',
      mediaUrl: video.url,
      thumbnail: images[0]?.url || video.url,
      videoUrl: video.url,
      videoHlsUrl: null,
      videoDashUrl: null,
      videoHasAudio: true,
      videoDurationSec: null,
      videoSourceKind: 'url',
      videoIsPreviewSource: false,
      canPlayFullAudioInApp: true,
      galleryItems: images.map((item, index) => ({
        id: `${base.id}_image_${index}`,
        kind: 'image',
        url: item.url,
        width: null,
        height: null
      }))
    };
  }

  if (images.length > 1) {
    return {
      ...base,
      type: 'gallery',
      mediaUrl: images[0].url,
      galleryItems: images.map((item, index) => ({
        id: `${base.id}_gallery_${index}`,
        kind: 'image',
        url: item.url,
        width: null,
        height: null
      })),
      videoUrl: null
    };
  }

  if (images.length === 1) {
    return {
      ...base,
      type: 'image',
      mediaUrl: images[0].url,
      galleryItems: [],
      videoUrl: null
    };
  }

  if (audios.length) {
    const audio = audios[0];
    return {
      ...base,
      type: 'audio',
      mediaUrl: audio.url,
      duration: null,
      galleryItems: [],
      videoUrl: null
    };
  }

  return null;
}

async function fetchCoomerJson(path, searchParams = {}) {
  const url = new URL(path, COOMER_BASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = fetch(url, {
    headers: {
      Accept: 'text/css',
      'User-Agent': 'Mozilla/5.0 Nightfeed/1.0'
    }
  })
    .then(async (response) => {
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if (response.status === 429) {
          if (cached?.value) {
            return cached.value;
          }

          if (path.includes('/api/v1/posts')) {
            return { count: 0, true_count: 0, posts: [] };
          }
        }

        const error = new Error(detail || `Coomer request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      responseCache.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return payload;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

async function fetchSearchPage({ query, offset = 0 }) {
  const payload = await fetchCoomerJson('/api/v1/posts', {
    q: query,
    o: offset
  });

  const posts = Array.isArray(payload?.posts) ? payload.posts : [];
  return {
    total: Number(payload?.true_count || payload?.count || posts.length || 0),
    posts
  };
}

async function fetchCreatorPostsPage({ service, creatorId, offset = 0 }) {
  const payload = await fetchCoomerJson(`/api/v1/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/posts`, {
    o: offset
  });

  const posts = Array.isArray(payload) ? payload : Array.isArray(payload?.posts) ? payload.posts : [];
  return {
    total: posts.length,
    posts
  };
}

async function fetchCreatorSearchResults({ query }) {
  const payload = await fetchCoomerJson('/api/v1/creators', {
    query
  });

  return Array.isArray(payload) ? payload : [];
}

async function fetchCreatorProfile({ service, creatorId }) {
  const payload = await fetchCoomerJson(`/api/v1/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/profile`);
  return payload && typeof payload === 'object' ? payload : null;
}

async function enrichPostsWithCreatorProfiles(posts) {
  const unresolved = new Map();

  for (const post of posts) {
    const creatorId = String(post?.user || '').trim();
    const service = String(post?.service || '').trim();
    if (!creatorId || !service || !isOpaqueCreatorId(creatorId)) continue;
    const key = buildCreatorKey(service, creatorId);
    if (!unresolved.has(key)) {
      unresolved.set(key, { service, creatorId });
    }
  }

  const resolutions = new Map();
  for (const item of Array.from(unresolved.values()).slice(0, 12)) {
    try {
      const profile = await fetchCreatorProfile(item);
      resolutions.set(buildCreatorKey(item.service, item.creatorId), profile?.name || item.creatorId);
    } catch {
      resolutions.set(buildCreatorKey(item.service, item.creatorId), item.creatorId);
    }
  }

  return posts.map((post) => {
    const creatorId = String(post?.user || '').trim();
    const service = String(post?.service || '').trim();
    const key = buildCreatorKey(service, creatorId);
    return {
      ...post,
      creatorId,
      creatorName: resolutions.get(key) || post?.creatorName || post?.user || 'Unknown creator'
    };
  });
}

function filterItems(items, { creator = '', service = '', type = 'all' }) {
  return items.filter((item) => {
    if (creator) {
      const creatorFilter = String(creator).toLowerCase();
      const matchesCreator = String(item.creator).toLowerCase() === creatorFilter || String(item.creatorId || '').toLowerCase() === creatorFilter;
      if (!matchesCreator) return false;
    }
    if (service && String(item.service).toLowerCase() !== String(service).toLowerCase()) return false;
    if (type !== 'all' && item.type !== type) return false;
    return true;
  });
}

function sortItems(items, sort = 'newest') {
  const copy = [...items];
  if (sort === 'popular') {
    return copy.sort((left, right) => String(left.creator).localeCompare(String(right.creator)) || (right.createdUtc || 0) - (left.createdUtc || 0));
  }
  return copy.sort((left, right) => (right.createdUtc || 0) - (left.createdUtc || 0));
}

async function collectSidebarPosts({ query }) {
  const pages = [0];
  const results = [];

  for (const offset of pages) {
    const payload = await fetchSearchPage({ query, offset });
    results.push(...payload.posts);
    if (payload.posts.length < SEARCH_PAGE_SIZE || results.length >= SIDEBAR_PAGE_LIMIT) break;
    pages.push(offset + SEARCH_PAGE_SIZE);
  }

  return results.slice(0, SIDEBAR_PAGE_LIMIT);
}

export async function queryMediaCatalog({ search = '', creator = '', tag = '', service = '', type = 'all', sort = 'newest', after = null, limit = 24 } = {}) {
  const query = searchTermForQuery({ search, creator });
  const offset = sanitizeOffset(after);
  const safeLimit = sanitizeLimit(limit, 24);
  const serviceFilter = String(service || tag || '').trim().toLowerCase();
  const payload = creator && serviceFilter
    ? await fetchCreatorPostsPage({ service: serviceFilter, creatorId: creator, offset })
    : await fetchSearchPage({ query, offset });
  const enrichedPosts = await enrichPostsWithCreatorProfiles(payload.posts);
  const normalized = enrichedPosts.map(buildNormalizedItem).filter(Boolean);
  const filtered = filterItems(normalized, { creator, service: serviceFilter, type });
  const sorted = sortItems(filtered, sort);
  const nextAfter = payload.posts.length === SEARCH_PAGE_SIZE ? String(offset + SEARCH_PAGE_SIZE) : null;

  return {
    items: sorted.slice(0, safeLimit),
    after: nextAfter,
    total: payload.total,
    query
  };
}

export async function listMediaFeed(limit = 24) {
  return queryMediaCatalog({ search: DEFAULT_QUERY, limit });
}

export async function listMediaCreators({ search = '', service = '', type = 'all' } = {}) {
  const query = searchTermForQuery({ search });
  const creators = await fetchCreatorSearchResults({ query });
  return creators
    .filter((creator) => !service || String(creator.service).toLowerCase() === String(service).toLowerCase())
    .map((creator) => ({
      id: String(creator.id),
      name: String(creator.name || creator.id),
      label: String(creator.name || creator.id),
      service: String(creator.service || ''),
      count: Number(creator.favorited || 0),
      favorited: Number(creator.favorited || 0)
    }))
    .sort((left, right) => right.favorited - left.favorited || left.name.localeCompare(right.name))
    .slice(0, 60);
}

export async function listMediaTags({ search = '', creator = '', type = 'all' } = {}) {
  const query = searchTermForQuery({ search, creator });
  const creators = await fetchCreatorSearchResults({ query });
  const services = new Map();

  for (const item of creators) {
    const key = String(item.service || 'unknown');
    const current = services.get(key) || { name: key, count: 0 };
    current.count += 1;
    services.set(key, current);
  }

  return Array.from(services.values()).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}