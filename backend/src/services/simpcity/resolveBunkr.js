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

export async function resolveBunkr(link, fetchHtml) {
  const media = [];
  if (!link || !fetchHtml) return media;

  if (/\.(?:mp4|webm|mov)(?:\?.*)?$/i.test(link)) {
    media.push({ mediaType: 'video', directUrl: link, thumbnailUrl: null, posterUrl: null, sourceHost: new URL(link).hostname, source: 'bunkr' });
    return media;
  }

  if (/\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(link)) {
    media.push({ mediaType: 'image', directUrl: link, thumbnailUrl: link, posterUrl: link, sourceHost: new URL(link).hostname, source: 'bunkr' });
    return media;
  }

  const html = await fetchHtml(link).catch(() => null);
  if (!html) return media;

  const attrRe = /(src|href|poster)=['"]([^'"]+)['"]/gi;
  const seen = new Set();
  let match;
  while ((match = attrRe.exec(html)) !== null) {
    const raw = decodeHtmlEntities(match[2]);
    if (!raw) continue;
    let absolute;
    try {
      absolute = new URL(raw, link).toString();
    } catch {
      continue;
    }
    if (seen.has(absolute)) continue;
    seen.add(absolute);

    if (/\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(absolute)) {
      media.push({ mediaType: 'image', directUrl: absolute, thumbnailUrl: absolute, posterUrl: absolute, sourceHost: new URL(absolute).hostname, source: 'bunkr' });
    } else if (/\.(?:mp4|webm|mov|m3u8)(?:\?.*)?$/i.test(absolute)) {
      media.push({ mediaType: 'video', directUrl: absolute, thumbnailUrl: null, posterUrl: null, sourceHost: new URL(absolute).hostname, source: 'bunkr' });
    }
  }

  return media;
}
