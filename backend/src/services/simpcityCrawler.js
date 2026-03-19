import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  clearSimpcityIndex,
  createCrawlJob,
  finishCrawlJob,
  getSimpcityStats,
  replaceThreadMedia,
  replaceThreadTags,
  slugify,
  upsertCategory,
  upsertSection,
  upsertThread
} from './simpcityDb.js';
import { resolveGofile } from './simpcity/resolveGofile.js';
import { resolveBunkr } from './simpcity/resolveBunkr.js';

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i;
const VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m3u8)(?:\?.*)?$/i;
const GOFILE_HOST_RE = /(?:^|\.)gofile\.io$/i;
const BUNKR_HOST_RE = /(?:^|\.)bunkr\.[a-z.]+$/i;
const REDGIFS_HOST_RE = /(?:^|\.)redgifs\.com$/i;
const THREAD_PATH_RE = /\/threads\//i;
const SECTION_PATH_RE = /\/(forums|tags)\//i;
const EXCLUDED_MEDIA_PATH_RE = /\/(data\/avatars|data\/assets|styles\/|js\/|css\.php|login\/|members\/|forums\/|threads\/|posts\/|misc\/|whats-new\/)/i;
const execFileAsync = promisify(execFile);

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
    .replace(/&#x2F;/gi, '/')
    .replace(/&#([0-9]+);/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function getRequestHeaders() {
  const headers = {
    'user-agent': process.env.SIMPCITY_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1'
  };
  if (process.env.SIMPCITY_COOKIE) headers.cookie = process.env.SIMPCITY_COOKIE;
  return headers;
}

function buildCurlArgs(url) {
  const args = ['-L', url];
  for (const [name, value] of Object.entries(getRequestHeaders())) {
    args.push('-H', `${name}: ${value}`);
  }
  return args;
}

async function fetchHtmlViaCurl(url) {
  const { stdout } = await execFileAsync('curl', buildCurlArgs(url), {
    cwd: process.cwd(),
    windowsHide: true,
    maxBuffer: 25 * 1024 * 1024
  });
  return stdout;
}

export async function fetchHtml(url) {
  const body = await fetchHtmlViaCurl(url);
  const hasExpectedPageMarkup = /message-userContent|message-body|bbWrapper|structItem--thread|p-body-pageContent/i.test(body);
  const blocked = !hasExpectedPageMarkup && /cloudflare|attention required|captcha|just a moment|ddos-guard|403 forbidden/i.test(body);
  if (!body || blocked) {
    const error = new Error('SimpCity blocked public crawl request.');
    error.status = 502;
    throw error;
  }
  return body;
}

export async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': getRequestHeaders()['user-agent'],
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

function toAbsoluteUrl(baseUrl, href) {
  try {
    return new URL(decodeHtmlEntities(href), `${baseUrl}/`).toString();
  } catch {
    return null;
  }
}

function canonicalizeThreadUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/unread\/?$/i, '/');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseDisplayCount(value) {
  const text = cleanText(value).replace(/,/g, '').trim();
  if (!text) return 0;
  const suffix = text.slice(-1).toUpperCase();
  const base = Number.parseFloat(text);
  if (Number.isNaN(base)) return 0;
  if (suffix === 'K') return Math.round(base * 1000);
  if (suffix === 'M') return Math.round(base * 1000000);
  return Math.round(base);
}

function splitBlocks(html, marker) {
  const blocks = [];
  let index = html.indexOf(marker);
  while (index !== -1) {
    const nextIndex = html.indexOf(marker, index + marker.length);
    blocks.push(html.slice(index, nextIndex === -1 ? undefined : nextIndex));
    index = nextIndex;
  }
  return blocks;
}

function extractTagNames(html) {
  const tags = [];
  const re = /<a[^>]+href=["'][^"']*\/tags\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const name = cleanText(match[1]);
    if (name && !tags.includes(name)) tags.push(name);
  }
  return tags;
}

function extractAuthor(html) {
  const match = html.match(/data-author=["']([^"']+)["']/i) || html.match(/class=["'][^"']*username[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  return match ? cleanText(match[1]) : null;
}

function extractForumTaxonomy(html, baseUrl) {
  const categories = [];
  const categoryBlocks = splitBlocks(html, '<div class="block block--category');

  for (const [categoryIndex, block] of categoryBlocks.entries()) {
    const categoryName = cleanText(
      block.match(/<div class="block-header">[\s\S]*?<a href="\/#.*?">([\s\S]*?)<\/a>/i)?.[1]
        || block.match(/<h2[^>]*class=["'][^"']*block-header[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]
        || `Category ${categoryIndex + 1}`
    );

    const sections = [];
    const nodeBlocks = splitBlocks(block, '<div class="node node--id');

    for (const nodeBlock of nodeBlocks) {
      const hrefMatch = nodeBlock.match(/<h3 class="node-title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!hrefMatch) continue;
      const sectionUrl = toAbsoluteUrl(baseUrl, hrefMatch[1]);
      if (!sectionUrl || THREAD_PATH_RE.test(sectionUrl) || !SECTION_PATH_RE.test(sectionUrl) || /\/link-forums\//i.test(sectionUrl)) continue;

      const sectionName = cleanText(hrefMatch[2]);
      if (!sectionName || sections.some((item) => item.sectionUrl === sectionUrl)) continue;

      const threadCount = parseDisplayCount(nodeBlock.match(/<dt>Threads<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1] || '0');
      const postCount = parseDisplayCount(nodeBlock.match(/<dt>Posts<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1] || '0');

      sections.push({
        name: sectionName,
        slug: slugify(sectionName),
        sectionUrl,
        position: sections.length,
        threadCount,
        postCount
      });
    }

    if (sections.length) {
      categories.push({
        name: categoryName,
        slug: slugify(categoryName),
        position: categoryIndex,
        sections
      });
    }
  }

  return categories;
}

function extractThreadRows(html, baseUrl) {
  const rows = [];
  const blocks = splitBlocks(html, '<div class="structItem structItem--thread');

  for (const block of blocks) {
    const hrefMatch = block.match(/<div class="structItem-title"[\s\S]*?<a href="([^"]*\/threads\/[^"#?]+(?:\/unread)?)"[^>]*data-tp-primary="on"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<div class="structItem-title"[\s\S]*?<a href="([^"]*\/threads\/[^"#?]+(?:\/unread)?)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!hrefMatch) continue;

    const threadUrl = canonicalizeThreadUrl(toAbsoluteUrl(baseUrl, hrefMatch[1]));
    if (!threadUrl) continue;

    const title = cleanText(hrefMatch[2]);
    if (!title || shouldSkipThreadRow(title)) continue;

    const author = cleanText(block.match(/data-author="([^"]+)"/i)?.[1] || '');
    const replyCount = parseDisplayCount(block.match(/<dt>Replies<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1] || '0');
    const updatedAt = cleanText(block.match(/datetime="([^"]+)"/i)?.[1] || '');

    rows.push({ threadUrl, title, author: author || null, replyCount, updatedAt: updatedAt || null });
  }

  return rows;
}

function decodeRedirectUrl(rawUrl, pageUrl) {
  const absolute = toAbsoluteUrl(pageUrl, rawUrl);
  if (!absolute) return null;

  try {
    const parsed = new URL(absolute);
    if (/^\/redirect\//i.test(parsed.pathname) && parsed.searchParams.get('to')) {
      const target = parsed.searchParams.get('to');
      if (/^https?:\/\//i.test(target)) return target;
      try {
        return Buffer.from(target, 'base64').toString('utf8');
      } catch {
        return decodeHtmlEntities(target);
      }
    }
    return parsed.toString();
  } catch {
    return absolute;
  }
}

function isUsefulCandidate(url) {
  try {
    const parsed = new URL(url);
    if (/(^|\.)simpcity\.(cr|rs|su)$/i.test(parsed.hostname) && (EXCLUDED_MEDIA_PATH_RE.test(parsed.pathname) || /favicon/i.test(parsed.pathname))) return false;
    if (/\.(?:svg|ico|css|js)(?:\?.*)?$/i.test(parsed.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function shouldSkipThreadRow(title) {
  return /category specific rules and guidelines|mirroring policy|ranking up guide|underage content allegations|approved\s*&\s*recommended file hosts|rules and faq/i.test(title);
}

function deriveCreatorIdentity(thread) {
  const creatorName = cleanText(thread?.title || '');
  if (!creatorName || shouldSkipThreadRow(creatorName)) {
    return { creatorName: null, creatorSlug: null };
  }

  return {
    creatorName,
    creatorSlug: slugify(creatorName)
  };
}

function isGuestRestrictedThreadPage(html) {
  return /blockMessage--error[\s\S]*You must be logged-in to do that\./i.test(html)
    && !/message-userContent|message-body|bbWrapper/i.test(html);
}

function extractCandidateUrlsFromThread(html, threadUrl) {
  const blocks = splitBlocks(html, '<div class="message-userContent');
  const seen = new Set();
  const out = [];

  const pushUrl = (raw) => {
    const decoded = decodeRedirectUrl(raw, threadUrl);
    if (!decoded || seen.has(decoded) || !isUsefulCandidate(decoded)) return;
    seen.add(decoded);
    out.push(decoded);
  };

  const attrRe = /(href|src|data-src|data-url|data-lb-src|data-lb-universal-src|poster|srcset)=['"]([^'"]+)['"]/gi;
  const inlineUrlRe = /https?:\/\/[^\s<>'"]+/gi;
  const redgifsRe = /loadMedia\(this,\s*['"]([^'"]+)['"]\)/gi;

  for (const block of blocks.length ? blocks : [html]) {
    let match;
    attrRe.lastIndex = 0;
    inlineUrlRe.lastIndex = 0;
    redgifsRe.lastIndex = 0;
    while ((match = attrRe.exec(block)) !== null) {
      if (match[1] === 'srcset') {
        match[2]
          .split(',')
          .map((entry) => entry.trim().split(/\s+/)[0])
          .filter(Boolean)
          .forEach((url) => pushUrl(url));
        continue;
      }
      pushUrl(match[2]);
    }
    while ((match = inlineUrlRe.exec(block)) !== null) pushUrl(match[0]);
    while ((match = redgifsRe.exec(block)) !== null) pushUrl(match[1]);
  }

  return out;
}

async function resolveMediaCandidates(candidates, pageUrl) {
  const media = [];
  const seen = new Set();
  const pushItem = (item) => {
    if (!item?.directUrl) return;
    const key = item.directUrl;
    if (seen.has(key)) return;
    seen.add(key);
    media.push({
      ...item,
      mediaKey: `${item.source}:${item.directUrl}`,
      pageUrl: item.pageUrl || pageUrl
    });
  };

  for (const candidate of candidates) {
    let host = '';
    try {
      host = new URL(candidate).hostname;
    } catch {
      continue;
    }

    if (IMAGE_EXT_RE.test(candidate)) {
      pushItem({ mediaType: 'image', directUrl: candidate, thumbnailUrl: candidate, posterUrl: candidate, sourceHost: host, source: 'simpcity' });
      continue;
    }

    if (VIDEO_EXT_RE.test(candidate)) {
      pushItem({ mediaType: 'video', directUrl: candidate, thumbnailUrl: null, posterUrl: null, sourceHost: host, source: 'simpcity' });
      continue;
    }

    if (GOFILE_HOST_RE.test(host)) {
      const resolved = await resolveGofile(candidate, fetchJson);
      resolved.forEach(pushItem);
      continue;
    }

    if (BUNKR_HOST_RE.test(host)) {
      const resolved = await resolveBunkr(candidate, fetchHtml);
      resolved.forEach(pushItem);
      continue;
    }

    if (REDGIFS_HOST_RE.test(host)) {
      pushItem({ mediaType: 'video', directUrl: candidate, thumbnailUrl: null, posterUrl: null, sourceHost: host, source: 'redgifs' });
    }
  }

  return media;
}

async function crawlThreadDetail(thread, sectionContext) {
  const html = await fetchHtml(thread.threadUrl);
  const tags = extractTagNames(html);
  const author = thread.author || extractAuthor(html) || null;
  const creatorIdentity = deriveCreatorIdentity(thread);
  const guestRestricted = isGuestRestrictedThreadPage(html);
  const candidateUrls = extractCandidateUrlsFromThread(html, thread.threadUrl);
  const mediaItems = await resolveMediaCandidates(candidateUrls, thread.threadUrl);
  const coverImageUrl = mediaItems.find((item) => item.mediaType === 'image')?.thumbnailUrl || mediaItems[0]?.thumbnailUrl || mediaItems[0]?.posterUrl || mediaItems[0]?.directUrl || null;

  return {
    ...thread,
    author,
    creatorName: creatorIdentity.creatorName,
    creatorSlug: creatorIdentity.creatorSlug,
    tags,
    mediaItems,
    mediaCount: mediaItems.length,
    coverImageUrl,
    guestRestricted,
    categoryName: sectionContext.categoryName,
    sectionName: sectionContext.sectionName
  };
}

async function crawlSection(section, sectionId, categoryName, options) {
  const html = await fetchHtml(section.sectionUrl);
  const threadRows = extractThreadRows(html, getBaseUrl());
  const limit = options.threadLimitPerSection || 12;
  let crawledThreads = 0;
  let crawledMedia = 0;

  for (const thread of threadRows.slice(0, limit)) {
    const detail = await crawlThreadDetail(thread, { categoryName, sectionName: section.name });
    const threadId = upsertThread({
      sectionId,
      threadUrl: detail.threadUrl,
      title: detail.title,
      author: detail.author,
      creatorName: detail.creatorName,
      creatorSlug: detail.creatorSlug,
      createdAt: detail.createdAt || null,
      updatedAt: detail.updatedAt || null,
      replyCount: detail.replyCount,
      mediaCount: detail.mediaCount,
      coverImageUrl: detail.coverImageUrl,
      categoryName,
      sectionName: section.name
    });
    replaceThreadTags(threadId, detail.tags);
    replaceThreadMedia(threadId, detail.mediaItems);
    crawledThreads += 1;
    crawledMedia += detail.mediaItems.length;
  }

  return { crawledThreads, crawledMedia, threadCount: threadRows.length };
}

let activeCrawlPromise = null;

export async function crawlSimpcityIndex(options = {}) {
  if (activeCrawlPromise) return activeCrawlPromise;

  const jobId = createCrawlJob('simpcity_index', options.scope || 'full');
  activeCrawlPromise = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const html = await fetchHtml(baseUrl);
      const categories = extractForumTaxonomy(html, baseUrl);
      if (!categories.length) {
        throw new Error('Failed to parse SimpCity forum taxonomy.');
      }

      clearSimpcityIndex();

      const stats = { categories: 0, sections: 0, threads: 0, media: 0 };
      const categoryLimit = Number.isFinite(options.categoryLimit) ? Number(options.categoryLimit) : null;
      const sectionLimit = Number.isFinite(options.sectionLimit) ? Number(options.sectionLimit) : null;
      let processedCategories = 0;
      let processedSections = 0;
      for (const category of categories) {
        if (categoryLimit && processedCategories >= categoryLimit) break;
        const categoryId = upsertCategory(category);
        stats.categories += 1;
        processedCategories += 1;

        for (const section of category.sections) {
          if (sectionLimit && processedSections >= sectionLimit) break;
          const sectionId = upsertSection({
            categoryId,
            categoryName: category.name,
            name: section.name,
            slug: slugify(section.name),
            sectionUrl: section.sectionUrl,
            position: section.position,
            threadCount: section.threadCount || 0,
            postCount: section.postCount || 0
          });
          stats.sections += 1;
          processedSections += 1;
          const sectionStats = await crawlSection(section, sectionId, category.name, options);
          stats.threads += sectionStats.crawledThreads;
          stats.media += sectionStats.crawledMedia;
        }

        if (sectionLimit && processedSections >= sectionLimit) {
          break;
        }
      }

      const warning = stats.media === 0 && !process.env.SIMPCITY_COOKIE
        ? 'SimpCity thread pages are returning a login wall for guest requests. Add SIMPCITY_COOKIE from a normal logged-in browser session, then recrawl to index thread media and Bunkr mirrors.'
        : null;
      finishCrawlJob(jobId, { status: 'success', stats: { ...stats, db: getSimpcityStats(), warning } });
      return { ok: true, stats: { ...stats, db: getSimpcityStats(), warning } };
    } catch (error) {
      finishCrawlJob(jobId, { status: 'error', error: error.message });
      throw error;
    } finally {
      activeCrawlPromise = null;
    }
  })();

  return activeCrawlPromise;
}
