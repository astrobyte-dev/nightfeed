import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'simpcity.sqlite');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS simpcity_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS simpcity_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES simpcity_categories(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    section_url TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL DEFAULT 0,
    thread_count INTEGER NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS simpcity_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER REFERENCES simpcity_sections(id) ON DELETE SET NULL,
    thread_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author TEXT,
    creator_name TEXT,
    creator_slug TEXT,
    created_at TEXT,
    updated_at TEXT,
    reply_count INTEGER NOT NULL DEFAULT 0,
    media_count INTEGER NOT NULL DEFAULT 0,
    cover_image_url TEXT,
    category_name TEXT,
    section_name TEXT,
    last_crawled_at TEXT,
    created_record_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_record_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS simpcity_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS simpcity_thread_tags (
    thread_id INTEGER NOT NULL REFERENCES simpcity_threads(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES simpcity_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (thread_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS simpcity_media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES simpcity_threads(id) ON DELETE CASCADE,
    media_key TEXT NOT NULL UNIQUE,
    media_type TEXT NOT NULL,
    source_host TEXT NOT NULL,
    source TEXT NOT NULL,
    page_url TEXT,
    direct_url TEXT NOT NULL,
    thumbnail_url TEXT,
    poster_url TEXT,
    title TEXT,
    duration_sec INTEGER,
    width INTEGER,
    height INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    scope TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    stats_json TEXT,
    error_text TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sections_category_id ON simpcity_sections(category_id);
  CREATE INDEX IF NOT EXISTS idx_threads_section_id ON simpcity_threads(section_id);
  CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON simpcity_threads(updated_at);
  CREATE INDEX IF NOT EXISTS idx_media_thread_id ON simpcity_media_items(thread_id);
  CREATE INDEX IF NOT EXISTS idx_media_source_host ON simpcity_media_items(source_host);
  CREATE INDEX IF NOT EXISTS idx_media_type ON simpcity_media_items(media_type);
  CREATE INDEX IF NOT EXISTS idx_thread_tags_tag_id ON simpcity_thread_tags(tag_id);
`);

function ensureTextColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT`);
}

ensureTextColumn('simpcity_threads', 'creator_name');
ensureTextColumn('simpcity_threads', 'creator_slug');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_threads_creator_slug ON simpcity_threads(creator_slug);
  CREATE INDEX IF NOT EXISTS idx_threads_creator_name ON simpcity_threads(creator_name);
`);

const statements = {
  insertCategory: db.prepare(`
    INSERT INTO simpcity_categories (slug, name, position, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      position = excluded.position,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `),
  getCategoryBySlug: db.prepare('SELECT id FROM simpcity_categories WHERE slug = ?'),
  insertSection: db.prepare(`
    INSERT INTO simpcity_sections (category_id, slug, name, section_url, position, thread_count, post_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      category_id = excluded.category_id,
      name = excluded.name,
      section_url = excluded.section_url,
      position = excluded.position,
      thread_count = excluded.thread_count,
      post_count = excluded.post_count,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `),
  getSectionBySlug: db.prepare('SELECT id FROM simpcity_sections WHERE slug = ?'),
  insertThread: db.prepare(`
    INSERT INTO simpcity_threads (
      section_id, thread_url, title, author, creator_name, creator_slug, created_at, updated_at, reply_count, media_count,
      cover_image_url, category_name, section_name, last_crawled_at, updated_record_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(thread_url) DO UPDATE SET
      section_id = excluded.section_id,
      title = excluded.title,
      author = excluded.author,
      creator_name = excluded.creator_name,
      creator_slug = excluded.creator_slug,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      reply_count = excluded.reply_count,
      media_count = excluded.media_count,
      cover_image_url = excluded.cover_image_url,
      category_name = excluded.category_name,
      section_name = excluded.section_name,
      last_crawled_at = CURRENT_TIMESTAMP,
      updated_record_at = CURRENT_TIMESTAMP
    RETURNING id
  `),
  getThreadByUrl: db.prepare('SELECT id FROM simpcity_threads WHERE thread_url = ?'),
  clearThreadTags: db.prepare('DELETE FROM simpcity_thread_tags WHERE thread_id = ?'),
  insertTag: db.prepare(`
    INSERT INTO simpcity_tags (slug, name)
    VALUES (?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
    RETURNING id
  `),
  getTagBySlug: db.prepare('SELECT id FROM simpcity_tags WHERE slug = ?'),
  insertThreadTag: db.prepare('INSERT OR IGNORE INTO simpcity_thread_tags (thread_id, tag_id) VALUES (?, ?)'),
  deleteThreadMedia: db.prepare('DELETE FROM simpcity_media_items WHERE thread_id = ?'),
  insertMedia: db.prepare(`
    INSERT INTO simpcity_media_items (
      thread_id, media_key, media_type, source_host, source, page_url, direct_url, thumbnail_url, poster_url,
      title, duration_sec, width, height, position, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(media_key) DO UPDATE SET
      thread_id = excluded.thread_id,
      media_type = excluded.media_type,
      source_host = excluded.source_host,
      source = excluded.source,
      page_url = excluded.page_url,
      direct_url = excluded.direct_url,
      thumbnail_url = excluded.thumbnail_url,
      poster_url = excluded.poster_url,
      title = excluded.title,
      duration_sec = excluded.duration_sec,
      width = excluded.width,
      height = excluded.height,
      position = excluded.position,
      updated_at = CURRENT_TIMESTAMP
  `),
  insertCrawlJob: db.prepare('INSERT INTO crawl_jobs (job_type, status, scope, stats_json, error_text) VALUES (?, ?, ?, ?, ?) RETURNING id'),
  finishCrawlJob: db.prepare('UPDATE crawl_jobs SET status = ?, finished_at = CURRENT_TIMESTAMP, stats_json = ?, error_text = ? WHERE id = ?'),
  latestJob: db.prepare('SELECT * FROM crawl_jobs ORDER BY id DESC LIMIT 1')
};

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function upsertCategory(category) {
  const slug = category.slug || slugify(category.name);
  return statements.insertCategory.get(slug, category.name, category.position || 0).id;
}

export function upsertSection(section) {
  const slug = section.slug || slugify(`${section.categoryName || ''}-${section.name}`);
  return statements.insertSection.get(
    section.categoryId,
    slug,
    section.name,
    section.sectionUrl,
    section.position || 0,
    section.threadCount || 0,
    section.postCount || 0
  ).id;
}

export function upsertThread(thread) {
  return statements.insertThread.get(
    thread.sectionId,
    thread.threadUrl,
    thread.title,
    thread.author || null,
    thread.creatorName || null,
    thread.creatorSlug || null,
    thread.createdAt || null,
    thread.updatedAt || null,
    thread.replyCount || 0,
    thread.mediaCount || 0,
    thread.coverImageUrl || null,
    thread.categoryName || null,
    thread.sectionName || null
  ).id;
}

export function replaceThreadTags(threadId, tags) {
  statements.clearThreadTags.run(threadId);
  for (const tagName of tags) {
    const slug = slugify(tagName);
    const tagId = (statements.insertTag.get(slug, tagName)?.id || statements.getTagBySlug.get(slug)?.id);
    if (tagId) statements.insertThreadTag.run(threadId, tagId);
  }
}

export function replaceThreadMedia(threadId, mediaItems) {
  statements.deleteThreadMedia.run(threadId);
  mediaItems.forEach((item, index) => {
    statements.insertMedia.run(
      threadId,
      item.mediaKey,
      item.mediaType,
      item.sourceHost,
      item.source,
      item.pageUrl || null,
      item.directUrl,
      item.thumbnailUrl || null,
      item.posterUrl || null,
      item.title || null,
      item.durationSec || null,
      item.width || null,
      item.height || null,
      index
    );
  });
}

export function createCrawlJob(jobType, scope) {
  return statements.insertCrawlJob.get(jobType, 'running', scope || null, null, null).id;
}

export function finishCrawlJob(jobId, { status, stats, error }) {
  statements.finishCrawlJob.run(status, stats ? JSON.stringify(stats) : null, error || null, jobId);
}

export function clearSimpcityIndex() {
  db.exec(`
    DELETE FROM simpcity_thread_tags;
    DELETE FROM simpcity_media_items;
    DELETE FROM simpcity_tags;
    DELETE FROM simpcity_threads;
    DELETE FROM simpcity_sections;
    DELETE FROM simpcity_categories;
  `);
}

export function getLatestCrawlJob() {
  return statements.latestJob.get() || null;
}

export function getSimpcitySidebar() {
  return db.prepare(`
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      c.position AS category_position,
      s.id AS section_id,
      s.name AS section_name,
      s.slug AS section_slug,
      s.section_url,
      s.position AS section_position,
      s.thread_count,
      s.post_count
    FROM simpcity_categories c
    LEFT JOIN simpcity_sections s ON s.category_id = c.id
    ORDER BY c.position ASC, c.name COLLATE NOCASE ASC, s.position ASC, s.name COLLATE NOCASE ASC
  `).all();
}

export function getSimpcityTags(limit = 120) {
  return db.prepare(`
    SELECT t.id, t.name, t.slug, COUNT(tt.thread_id) AS thread_count
    FROM simpcity_tags t
    LEFT JOIN simpcity_thread_tags tt ON tt.tag_id = t.id
    GROUP BY t.id
    ORDER BY thread_count DESC, t.name COLLATE NOCASE ASC
    LIMIT ?
  `).all(limit);
}

export function getSimpcityHosts(limit = 24) {
  return db.prepare(`
    SELECT source_host AS host, COUNT(*) AS media_count
    FROM simpcity_media_items
    GROUP BY source_host
    ORDER BY media_count DESC, source_host COLLATE NOCASE ASC
    LIMIT ?
  `).all(limit);
}

export function getSimpcityThreads({ category, section, author, creator, tag, search, limit = 40, offset = 0 }) {
  const filters = [];
  const params = [];
  let joinTags = '';

  if (tag) {
    joinTags = ' INNER JOIN simpcity_thread_tags tt ON tt.thread_id = th.id INNER JOIN simpcity_tags tg ON tg.id = tt.tag_id ';
    filters.push('tg.slug = ?');
    params.push(tag);
  }
  if (category) {
    filters.push('LOWER(COALESCE(th.category_name, c.name)) = LOWER(?)');
    params.push(category);
  }
  if (section) {
    filters.push('s.slug = ?');
    params.push(section);
  }
  if (creator) {
    filters.push('(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?))');
    params.push(creator, creator);
  }
  if (author) {
    filters.push("(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?) OR LOWER(COALESCE(th.author, '')) = LOWER(?))");
    params.push(author, author, author);
  }
  if (search) {
    filters.push("(LOWER(th.title) LIKE LOWER(?) OR LOWER(COALESCE(th.author, '')) LIKE LOWER(?) OR LOWER(COALESCE(th.creator_name, th.title)) LIKE LOWER(?))");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT
      th.id,
      th.title,
      th.thread_url,
      th.author AS thread_author,
      th.creator_name,
      th.creator_slug,
      th.created_at,
      th.updated_at,
      th.reply_count,
      th.media_count,
      th.cover_image_url,
      th.category_name,
      th.section_name,
      c.slug AS category_slug,
      s.slug AS section_slug
    FROM simpcity_threads th
    LEFT JOIN simpcity_sections s ON s.id = th.section_id
    LEFT JOIN simpcity_categories c ON c.id = s.category_id
    ${joinTags}
    ${where}
    GROUP BY th.id
    ORDER BY COALESCE(th.updated_at, th.created_record_at) DESC, th.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return rows;
}

export function countSimpcityThreads({ category, section, author, creator, tag, search }) {
  const filters = [];
  const params = [];
  let joinTags = '';
  if (tag) {
    joinTags = ' INNER JOIN simpcity_thread_tags tt ON tt.thread_id = th.id INNER JOIN simpcity_tags tg ON tg.id = tt.tag_id ';
    filters.push('tg.slug = ?');
    params.push(tag);
  }
  if (category) {
    filters.push('LOWER(COALESCE(th.category_name, c.name)) = LOWER(?)');
    params.push(category);
  }
  if (section) {
    filters.push('s.slug = ?');
    params.push(section);
  }
  if (creator) {
    filters.push('(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?))');
    params.push(creator, creator);
  }
  if (author) {
    filters.push("(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?) OR LOWER(COALESCE(th.author, '')) = LOWER(?))");
    params.push(author, author, author);
  }
  if (search) {
    filters.push("(LOWER(th.title) LIKE LOWER(?) OR LOWER(COALESCE(th.author, '')) LIKE LOWER(?) OR LOWER(COALESCE(th.creator_name, th.title)) LIKE LOWER(?))");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return db.prepare(`
    SELECT COUNT(DISTINCT th.id) AS count
    FROM simpcity_threads th
    LEFT JOIN simpcity_sections s ON s.id = th.section_id
    LEFT JOIN simpcity_categories c ON c.id = s.category_id
    ${joinTags}
    ${where}
  `).get(...params)?.count || 0;
}

export function getSimpcityMedia({ category, section, tag, author, creator, mediaType, sourceHost, search, limit = 40, offset = 0 }) {
  const filters = [];
  const params = [];
  let joinTags = '';
  if (tag) {
    joinTags = ' INNER JOIN simpcity_thread_tags tt ON tt.thread_id = th.id INNER JOIN simpcity_tags tg ON tg.id = tt.tag_id ';
    filters.push('tg.slug = ?');
    params.push(tag);
  }
  if (category) {
    filters.push('LOWER(COALESCE(th.category_name, c.name)) = LOWER(?)');
    params.push(category);
  }
  if (section) {
    filters.push('s.slug = ?');
    params.push(section);
  }
  if (creator) {
    filters.push('(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?))');
    params.push(creator, creator);
  }
  if (author) {
    filters.push("(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?) OR LOWER(COALESCE(th.author, '')) = LOWER(?))");
    params.push(author, author, author);
  }
  if (mediaType && mediaType !== 'all') {
    filters.push('m.media_type = ?');
    params.push(mediaType);
  }
  if (sourceHost) {
    filters.push('m.source_host = ?');
    params.push(sourceHost);
  }
  if (search) {
    filters.push("(LOWER(th.title) LIKE LOWER(?) OR LOWER(COALESCE(m.title, '')) LIKE LOWER(?) OR LOWER(COALESCE(th.creator_name, th.title)) LIKE LOWER(?))");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      m.id,
      m.media_type,
      m.source_host,
      m.source,
      m.page_url,
      m.direct_url,
      m.thumbnail_url,
      m.poster_url,
      m.title AS media_title,
      m.duration_sec,
      m.width,
      m.height,
      m.position,
      th.id AS thread_id,
      th.title AS thread_title,
      th.thread_url,
      th.author AS thread_author,
      th.creator_name,
      th.creator_slug,
      th.created_at,
      th.updated_at,
      th.reply_count,
      th.media_count,
      th.cover_image_url,
      th.category_name,
      th.section_name,
      c.slug AS category_slug,
      s.slug AS section_slug
    FROM simpcity_media_items m
    INNER JOIN simpcity_threads th ON th.id = m.thread_id
    LEFT JOIN simpcity_sections s ON s.id = th.section_id
    LEFT JOIN simpcity_categories c ON c.id = s.category_id
    ${joinTags}
    ${where}
    GROUP BY m.id
    ORDER BY COALESCE(th.updated_at, th.created_record_at) DESC, m.position ASC, m.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
}

export function countSimpcityMedia(filters) {
  const rows = getSimpcityMedia({ ...filters, limit: 1, offset: 0 });
  void rows;
  const clauses = [];
  const params = [];
  let joinTags = '';
  if (filters.tag) {
    joinTags = ' INNER JOIN simpcity_thread_tags tt ON tt.thread_id = th.id INNER JOIN simpcity_tags tg ON tg.id = tt.tag_id ';
    clauses.push('tg.slug = ?');
    params.push(filters.tag);
  }
  if (filters.category) {
    clauses.push('LOWER(COALESCE(th.category_name, c.name)) = LOWER(?)');
    params.push(filters.category);
  }
  if (filters.section) {
    clauses.push('s.slug = ?');
    params.push(filters.section);
  }
  if (filters.author) {
    clauses.push("(th.creator_slug = ? OR LOWER(COALESCE(th.creator_name, th.title)) = LOWER(?) OR LOWER(COALESCE(th.author, '')) = LOWER(?))");
    params.push(filters.author, filters.author, filters.author);
  }
  if (filters.mediaType && filters.mediaType !== 'all') {
    clauses.push('m.media_type = ?');
    params.push(filters.mediaType);
  }
  if (filters.sourceHost) {
    clauses.push('m.source_host = ?');
    params.push(filters.sourceHost);
  }
  if (filters.search) {
    clauses.push("(LOWER(th.title) LIKE LOWER(?) OR LOWER(COALESCE(m.title, '')) LIKE LOWER(?) OR LOWER(COALESCE(th.creator_name, th.title)) LIKE LOWER(?))");
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`
    SELECT COUNT(DISTINCT m.id) AS count
    FROM simpcity_media_items m
    INNER JOIN simpcity_threads th ON th.id = m.thread_id
    LEFT JOIN simpcity_sections s ON s.id = th.section_id
    LEFT JOIN simpcity_categories c ON c.id = s.category_id
    ${joinTags}
    ${where}
  `).get(...params)?.count || 0;
}

export function getSimpcityThreadById(threadId) {
  const thread = db.prepare(`
    SELECT
      th.id,
      th.title,
      th.thread_url,
      th.author AS thread_author,
      th.creator_name,
      th.creator_slug,
      th.created_at,
      th.updated_at,
      th.reply_count,
      th.media_count,
      th.cover_image_url,
      th.category_name,
      th.section_name,
      c.slug AS category_slug,
      s.slug AS section_slug
    FROM simpcity_threads th
    LEFT JOIN simpcity_sections s ON s.id = th.section_id
    LEFT JOIN simpcity_categories c ON c.id = s.category_id
    WHERE th.id = ?
    LIMIT 1
  `).get(threadId);
  if (!thread) return null;

  const tags = db.prepare(`
    SELECT t.name, t.slug
    FROM simpcity_tags t
    INNER JOIN simpcity_thread_tags tt ON tt.tag_id = t.id
    WHERE tt.thread_id = ?
    ORDER BY t.name COLLATE NOCASE ASC
  `).all(threadId);

  const media = db.prepare(`
    SELECT *
    FROM simpcity_media_items
    WHERE thread_id = ?
    ORDER BY position ASC, id ASC
  `).all(threadId);

  return { ...thread, tags, media };
}

export function getSimpcityCreators({ search = '', limit = 60 } = {}) {
  const filters = ["COALESCE(th.creator_name, th.title) <> ''", 'COALESCE(th.media_count, 0) > 0'];
  const params = [];

  if (search) {
    filters.push('(LOWER(COALESCE(th.creator_name, th.title)) LIKE LOWER(?) OR LOWER(th.title) LIKE LOWER(?))');
    params.push(`%${search}%`, `%${search}%`);
  }

  return db.prepare(`
    SELECT
      COALESCE(th.creator_slug, th.thread_url) AS creator_slug,
      COALESCE(th.creator_name, th.title) AS creator_name,
      COUNT(DISTINCT th.id) AS thread_count,
      SUM(COALESCE(th.media_count, 0)) AS media_count,
      MAX(COALESCE(th.updated_at, th.created_record_at)) AS updated_at,
      MAX(th.cover_image_url) AS cover_image_url
    FROM simpcity_threads th
    WHERE ${filters.join(' AND ')}
    GROUP BY COALESCE(th.creator_slug, th.thread_url), COALESCE(th.creator_name, th.title)
    ORDER BY media_count DESC, thread_count DESC, creator_name COLLATE NOCASE ASC
    LIMIT ?
  `).all(...params, limit);
}

export function getSimpcityStats() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM simpcity_categories) AS category_count,
      (SELECT COUNT(*) FROM simpcity_sections) AS section_count,
      (SELECT COUNT(*) FROM simpcity_threads) AS thread_count,
      (SELECT COUNT(*) FROM simpcity_media_items) AS media_count
  `).get();
}
