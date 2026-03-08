function toUnixSeconds(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function mapChildMedia(child, index, parentId) {
  const kind = child?.media_type === 'VIDEO' ? 'video' : 'image';
  const url = child?.media_type === 'VIDEO' ? child?.media_url || child?.thumbnail_url : child?.media_url;
  if (!url) return null;

  return {
    id: child?.id || `${parentId}-child-${index}`,
    kind,
    url,
    width: null,
    height: null
  };
}

export function normalizeInstagramMedia(entry, username) {
  if (!entry) return null;

  const mediaType = entry.media_type;
  const galleryItems = (entry.children?.data || [])
    .map((child, index) => mapChildMedia(child, index, entry.id))
    .filter(Boolean);

  let type = null;
  let mediaUrl = null;
  let videoUrl = null;

  if (mediaType === 'CAROUSEL_ALBUM' && galleryItems.length) {
    type = 'gallery';
    mediaUrl = galleryItems[0].url;
  } else if (mediaType === 'VIDEO') {
    type = 'video';
    videoUrl = entry.media_url || null;
    mediaUrl = videoUrl;
  } else if (mediaType === 'IMAGE') {
    type = 'image';
    mediaUrl = entry.media_url || null;
  }

  if (!type || !mediaUrl) {
    return null;
  }

  const title = (entry.caption || '').split('\n')[0]?.trim() || 'Instagram post';

  return {
    id: entry.id,
    source: 'instagram',
    title,
    permalink: entry.permalink || `https://www.instagram.com/${username}/`,
    author: username,
    subreddit: username,
    createdUtc: toUnixSeconds(entry.timestamp),
    score: 0,
    nsfw: false,
    type,
    thumbnail: entry.thumbnail_url || entry.media_url || mediaUrl,
    mediaUrl,
    galleryItems,
    videoUrl
  };
}