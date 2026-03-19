import express from 'express';
import { crawlSimpcityIndex } from '../services/simpcityCrawler.js';
import {
  getLatestCrawlJob,
  getSimpcityCreators,
  getSimpcityHosts,
  getSimpcityMedia,
  getSimpcitySidebar,
  getSimpcityStats,
  getSimpcityTags,
  getSimpcityThreadById,
  getSimpcityThreads,
  countSimpcityMedia,
  countSimpcityThreads
} from '../services/simpcityDb.js';

const router = express.Router();
const PAGE_SIZE_DEFAULT = 36;
let seeded = false;

function parseLimit(value, fallback = PAGE_SIZE_DEFAULT) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(100, Math.max(1, parsed));
}

function parseOffset(after) {
  const parsed = Number.parseInt(after, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}

function normalizeMediaRow(row) {
  return {
    id: `sc_media_${row.id}`,
    source: 'simpcity',
    title: row.media_title || row.thread_title,
    permalink: row.thread_url,
    author: row.creator_name || row.thread_title || row.thread_author || 'simpcity',
    creator: row.creator_name || row.thread_title || row.thread_author || 'simpcity',
    creatorSlug: row.creator_slug || null,
    threadAuthor: row.thread_author || null,
    subreddit: row.section_name || 'simpcity',
    createdUtc: row.updated_at ? Math.floor(new Date(row.updated_at).getTime() / 1000) : null,
    score: 0,
    numComments: row.reply_count || 0,
    flair: row.category_name || null,
    nsfw: true,
    thumbnail: row.thumbnail_url || row.poster_url || row.direct_url,
    mediaUrl: row.direct_url,
    galleryItems: [],
    videoUrl: row.media_type === 'video' ? row.direct_url : null,
    videoHlsUrl: row.direct_url?.endsWith('.m3u8') ? row.direct_url : null,
    videoDashUrl: null,
    videoHasAudio: null,
    videoDurationSec: row.duration_sec || null,
    videoSourceKind: row.source,
    videoIsPreviewSource: false,
    canPlayFullAudioInApp: row.media_type === 'video' ? !String(row.direct_url || '').endsWith('.m3u8') : false,
    sourceHost: row.source_host,
    isRedditHosted: false,
    type: row.media_type,
    threadId: row.thread_id,
    category: row.category_name,
    section: row.section_name,
    sectionSlug: row.section_slug,
    threadTitle: row.thread_title
  };
}

function normalizeThreadRow(row) {
  return {
    id: row.id,
    title: row.title,
    permalink: row.thread_url,
    author: row.creator_name || row.title || row.thread_author || 'simpcity',
    creator: row.creator_name || row.title || row.thread_author || 'simpcity',
    creatorSlug: row.creator_slug || null,
    threadAuthor: row.thread_author || null,
    category: row.category_name,
    categorySlug: row.category_slug,
    section: row.section_name,
    sectionSlug: row.section_slug,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    replyCount: row.reply_count || 0,
    mediaCount: row.media_count || 0,
    coverImageUrl: row.cover_image_url || null
  };
}

function ensureSeededCache() {
  const stats = getSimpcityStats();
  if (!seeded && (stats.thread_count === 0 || stats.media_count === 0)) {
    seeded = true;
    crawlSimpcityIndex({ threadLimitPerSection: 8, scope: 'auto-seed' }).catch((error) => {
      console.error('[simpcity] auto-seed failed', error.message);
      seeded = false;
    });
  }
}

router.get('/sidebar', (_req, res) => {
  ensureSeededCache();
  const rows = getSimpcitySidebar();
  const grouped = [];
  const categoryMap = new Map();

  for (const row of rows) {
    let category = categoryMap.get(row.category_slug);
    if (!category) {
      category = {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        sections: []
      };
      categoryMap.set(row.category_slug, category);
      grouped.push(category);
    }

    if (row.section_id) {
      category.sections.push({
        id: row.section_id,
        name: row.section_name,
        slug: row.section_slug,
        sectionUrl: row.section_url,
        threadCount: row.thread_count,
        postCount: row.post_count
      });
    }
  }

  res.json({ categories: grouped, stats: getSimpcityStats(), latestJob: getLatestCrawlJob() });
});

router.get('/tags', (req, res) => {
  ensureSeededCache();
  const limit = parseLimit(req.query.limit, 80);
  res.json({ tags: getSimpcityTags(limit), hosts: getSimpcityHosts(24) });
});

router.get('/creators', (req, res) => {
  ensureSeededCache();
  const limit = parseLimit(req.query.limit, 60);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const items = getSimpcityCreators({ search, limit }).map((row) => ({
    slug: row.creator_slug,
    name: row.creator_name,
    threadCount: row.thread_count || 0,
    mediaCount: row.media_count || 0,
    updatedAt: row.updated_at || null,
    coverImageUrl: row.cover_image_url || null
  }));
  res.json({ items });
});

router.get('/threads', (req, res) => {
  ensureSeededCache();
  const limit = parseLimit(req.query.limit, 24);
  const offset = parseOffset(req.query.after);
  const filters = {
    category: typeof req.query.category === 'string' ? req.query.category : '',
    section: typeof req.query.section === 'string' ? req.query.section : '',
    author: typeof req.query.author === 'string' ? req.query.author : '',
    creator: typeof req.query.creator === 'string' ? req.query.creator : '',
    tag: typeof req.query.tag === 'string' ? req.query.tag : '',
    search: typeof req.query.search === 'string' ? req.query.search : ''
  };
  const items = getSimpcityThreads({ ...filters, limit, offset }).map(normalizeThreadRow);
  const total = countSimpcityThreads(filters);
  const nextOffset = offset + items.length;
  res.json({ items, total, after: nextOffset < total ? String(nextOffset) : null });
});

router.get('/media', (req, res) => {
  ensureSeededCache();
  const limit = parseLimit(req.query.limit, PAGE_SIZE_DEFAULT);
  const offset = parseOffset(req.query.after);
  const filters = {
    category: typeof req.query.category === 'string' ? req.query.category : '',
    section: typeof req.query.section === 'string' ? req.query.section : '',
    author: typeof req.query.author === 'string' ? req.query.author : '',
    creator: typeof req.query.creator === 'string' ? req.query.creator : '',
    tag: typeof req.query.tag === 'string' ? req.query.tag : '',
    search: typeof req.query.search === 'string' ? req.query.search : '',
    mediaType: typeof req.query.mediaType === 'string' ? req.query.mediaType : 'all',
    sourceHost: typeof req.query.sourceHost === 'string' ? req.query.sourceHost : ''
  };
  const items = getSimpcityMedia({ ...filters, limit, offset }).map(normalizeMediaRow);
  const total = countSimpcityMedia(filters);
  const nextOffset = offset + items.length;
  res.json({ items, total, after: nextOffset < total ? String(nextOffset) : null });
});

router.get('/thread/:id', (req, res) => {
  ensureSeededCache();
  const thread = getSimpcityThreadById(Number(req.params.id));
  if (!thread) {
    return res.status(404).json({ error: 'SimpCity thread not found' });
  }

  res.json({
    thread: normalizeThreadRow(thread),
    tags: thread.tags || [],
    media: (thread.media || []).map((row) => normalizeMediaRow({
      ...row,
      thread_id: thread.id,
      thread_title: thread.title,
      thread_url: thread.thread_url,
      thread_author: thread.thread_author,
      creator_name: thread.creator_name,
      creator_slug: thread.creator_slug,
      updated_at: thread.updated_at,
      reply_count: thread.reply_count,
      category_name: thread.category_name,
      section_name: thread.section_name,
      section_slug: thread.section_slug,
      media_title: row.title
    }))
  });
});

router.post('/crawl', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Manual crawl is disabled in production' });
  }
  try {
    const result = await crawlSimpcityIndex({
      threadLimitPerSection: Number.parseInt(req.body?.threadLimitPerSection, 10) || 12,
      scope: typeof req.body?.scope === 'string' ? req.body.scope : 'manual'
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/feed', (req, res) => {
  ensureSeededCache();
  const limit = parseLimit(req.query.limit, 18);
  const offset = parseOffset(req.query.after);
  const search = typeof req.query.q === 'string' ? req.query.q : '';
  const section = typeof req.query.path === 'string' ? req.query.path.replace(/^\//, '').replace(/\/$/, '') : '';
  const items = getSimpcityMedia({ search, section, limit, offset }).map(normalizeMediaRow);
  const total = countSimpcityMedia({ search, section });
  const nextOffset = offset + items.length;
  res.json({ source: 'simpcity', count: items.length, items, after: nextOffset < total ? String(nextOffset) : null });
});

export default router;
