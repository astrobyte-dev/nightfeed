export async function resolveGofile(link, fetchJson) {
  const media = [];
  if (!link || !fetchJson) return media;

  try {
    const parsed = new URL(link);
    if (/\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(link)) {
      media.push({ mediaType: 'image', directUrl: link, thumbnailUrl: link, posterUrl: link, sourceHost: parsed.hostname, source: 'gofile' });
      return media;
    }
    if (/\.(?:mp4|webm|mov|m3u8)(?:\?.*)?$/i.test(link)) {
      media.push({ mediaType: 'video', directUrl: link, thumbnailUrl: null, posterUrl: null, sourceHost: parsed.hostname, source: 'gofile' });
      return media;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const id = parts[1] || parts[0];
    if (!id) return media;

    const apiUrl = `https://api.gofile.io/contents/${encodeURIComponent(id)}?wt=4fd6sg89d7s6&cache=true`;
    const payload = await fetchJson(apiUrl);
    const scanNode = (node) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.link === 'string') {
        if (/\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?.*)?$/i.test(node.link)) {
          media.push({ mediaType: 'image', directUrl: node.link, thumbnailUrl: node.link, posterUrl: node.link, sourceHost: new URL(node.link).hostname, source: 'gofile' });
        } else if (/\.(?:mp4|webm|mov|m3u8)(?:\?.*)?$/i.test(node.link)) {
          media.push({ mediaType: 'video', directUrl: node.link, thumbnailUrl: null, posterUrl: null, sourceHost: new URL(node.link).hostname, source: 'gofile' });
        }
      }
      if (node.contents && typeof node.contents === 'object') {
        Object.values(node.contents).forEach(scanNode);
      }
    };
    scanNode(payload?.data);
    return media;
  } catch {
    return media;
  }
}
