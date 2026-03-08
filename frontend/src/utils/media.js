const DOWNLOAD_HOST_ALLOWLIST = new Set(['i.redd.it', 'preview.redd.it', 'v.redd.it']);

export function getTypeBadge(type) {
  if (type === 'gallery') return 'Gallery';
  if (type === 'video') return 'Video';
  return 'Image';
}

export function getCardPreview(post) {
  if (post.type === 'video') return post.thumbnail || null;
  if (post.type === 'gallery' && post.galleryItems?.length) return post.galleryItems[0].url;
  return post.thumbnail || post.mediaUrl || null;
}

export function getModalItems(post) {
  if (!post) return [];
  if (post.type === 'gallery') return post.galleryItems || [];
  if (post.type === 'video') {
    if (post.source === 'youtube') {
      return [{ kind: 'youtube', url: post.videoUrl || post.mediaUrl, hasAudio: true }];
    }

    return [
      {
        kind: 'video',
        url: post.videoUrl || post.mediaUrl,
        hlsUrl: post.videoHlsUrl || null,
        dashUrl: post.videoDashUrl || null,
        audioUrls: Array.isArray(post.videoAudioUrls) ? post.videoAudioUrls : [],
        hasAudio: post.videoHasAudio
      }
    ];
  }
  return [{ kind: 'image', url: post.mediaUrl }];
}

export function canDownloadUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return DOWNLOAD_HOST_ALLOWLIST.has(parsed.hostname);
  } catch {
    return false;
  }
}
