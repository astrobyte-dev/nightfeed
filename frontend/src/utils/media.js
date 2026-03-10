const DOWNLOAD_HOST_ALLOWLIST = new Set(['i.redd.it', 'preview.redd.it', 'v.redd.it', 'interactive-examples.mdn.mozilla.net', 'www.w3schools.com', 'www.soundhelix.com', 'picsum.photos']);

export function isPreviewVideo(post) {
  return post?.type === 'video' && Boolean(post?.videoIsPreviewSource);
}

export function getTypeBadge(post) {
  if (post?.type === 'gallery') return 'Gallery';
  if (post?.type === 'audio') return 'Audio';
  if (isPreviewVideo(post)) return 'Preview Video';
  if (post?.type === 'video') return 'Video';
  return 'Image';
}

export function getTypeHelper(post) {
  if (post?.externalVideoEmbedUrl) {
    return `${post.externalVideoProvider || 'External'} playback is available in the viewer.`;
  }
  if (isPreviewVideo(post)) {
    return post?.canPlayFullAudioInApp
      ? 'Preview Video uses the Reddit feed stream with synced audio for fast in-app browsing.'
      : 'Preview Video uses the Reddit feed stream for fast in-app browsing.';
  }
  if (post?.type === 'gallery') return 'Gallery posts open with item-by-item navigation.';
  if (post?.type === 'audio') return 'Audio playback is available in the viewer.';
  if (post?.type === 'video') return 'Direct video playback is available in the viewer.';
  return 'Direct image view.';
}

export function getCardPreview(post) {
  if (post.type === 'audio') return post.thumbnail || null;
  if (post.type === 'video') return post.thumbnail || null;
  if (post.type === 'gallery' && post.galleryItems?.length) return post.galleryItems[0].url;
  return post.thumbnail || post.mediaUrl || null;
}

export function getModalItems(post) {
  if (!post) return [];
  if (post.type === 'gallery') return post.galleryItems || [];
  if (post.type === 'video') {
    if (post.externalVideoEmbedUrl) {
      return [
        {
          kind: 'embed',
          url: post.externalVideoEmbedUrl,
          id: post.externalVideoId || null,
          provider: post.externalVideoProvider || null,
          posterUrl: post.externalVideoPosterUrl || post.thumbnail || null,
          width: post.externalVideoWidth || null,
          height: post.externalVideoHeight || null,
          pageUrl: post.externalVideoPageUrl || post.permalink
        }
      ];
    }

    return [
      {
        kind: 'video',
        url: post.videoUrl || post.mediaUrl,
        hlsUrl: post.videoHlsUrl || null,
        dashUrl: post.videoDashUrl || null,
        audioUrls: Array.isArray(post.videoAudioUrls) ? post.videoAudioUrls : [],
        hasAudio: post.videoHasAudio,
        sourceKind: post.videoSourceKind || null,
        isPreviewSource: Boolean(post.videoIsPreviewSource),
        canPlayFullAudioInApp: Boolean(post.canPlayFullAudioInApp)
      }
    ];
  }
  if (post.type === 'audio') {
    return [
      {
        kind: 'audio',
        url: post.mediaUrl,
        posterUrl: post.thumbnail || null,
        duration: post.duration || post.videoDurationSec || null
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
