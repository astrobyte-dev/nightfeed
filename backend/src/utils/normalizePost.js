const ALLOWED_SORTS = new Set(['hot', 'new', 'top']);

function decodeRedditUrl(value) {
  return typeof value === 'string' ? value.replace(/&amp;/g, '&') : null;
}

function isImageUrl(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp)$/i.test(url.split('?')[0]);
}

function isGifLikeUrl(url) {
  if (!url) return false;
  return /\.(gif|gifv|mp4)$/i.test(url.split('?')[0]);
}

function getPreviewImage(post) {
  const images = post?.preview?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  return decodeRedditUrl(images[0]?.source?.url);
}

function getPostVariants(post) {
  const crossposts = Array.isArray(post?.crosspost_parent_list) ? post.crosspost_parent_list : [];
  return [post, ...crossposts].filter(Boolean);
}

function getThumbnail(post) {
  const preview = getPreviewImage(post);
  if (preview) return preview;
  const thumb = post?.thumbnail;
  if (thumb && /^https?:\/\//.test(thumb)) return thumb;
  return null;
}

function getSourceHost(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isRedditHostedHost(hostname) {
  if (!hostname) return false;
  return hostname === 'redd.it' || hostname.endsWith('.redd.it') || hostname.endsWith('reddit.com') || hostname.endsWith('redditmedia.com');
}

function normalizeGallery(post) {
  const galleryItems = post?.gallery_data?.items;
  const mediaMetadata = post?.media_metadata;
  if (!Array.isArray(galleryItems) || !mediaMetadata) return null;

  const items = galleryItems
    .map((item, index) => {
      const mediaId = item?.media_id;
      const metadata = mediaMetadata?.[mediaId];
      if (!metadata) return null;
      const sourceUrl = decodeRedditUrl(metadata?.s?.u || metadata?.s?.gif || metadata?.s?.mp4);
      if (!sourceUrl) return null;

      const mime = metadata?.m || '';
      const kind = mime.startsWith('video/') || isGifLikeUrl(sourceUrl) ? 'video' : 'image';
      return {
        id: mediaId || `${post.id}-gallery-${index}`,
        kind,
        url: sourceUrl,
        width: metadata?.s?.x || null,
        height: metadata?.s?.y || null
      };
    })
    .filter(Boolean);

  return items.length ? items : null;
}

function parseHasAudio(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function extractRedditVideoBase(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'v.redd.it') return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    return `${parsed.origin}/${segments[0]}`;
  } catch {
    return null;
  }
}

function appendSearchParams(url, sourceUrl) {
  if (!url || !sourceUrl) return url;

  try {
    const source = new URL(sourceUrl);
    const target = new URL(url);
    source.searchParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) {
        target.searchParams.set(key, value);
      }
    });
    return target.toString();
  } catch {
    return url;
  }
}

function buildRedditAudioCandidates(video) {
  const fallbackUrl = decodeRedditUrl(video?.fallback_url);
  const hlsUrl = decodeRedditUrl(video?.hls_url);
  const dashUrl = decodeRedditUrl(video?.dash_url);
  const baseUrl = extractRedditVideoBase(fallbackUrl) || extractRedditVideoBase(hlsUrl) || extractRedditVideoBase(dashUrl);

  if (!baseUrl) return [];

  const candidateNames = ['DASH_AUDIO_128.mp4', 'DASH_AUDIO_64.mp4', 'DASH_AUDIO.mp4'];
  return candidateNames.map((name) => {
    const rawUrl = appendSearchParams(`${baseUrl}/${name}`, fallbackUrl || dashUrl || hlsUrl);
    return `/api/reddit/audio-proxy?url=${encodeURIComponent(rawUrl)}`;
  });
}

function extractEmbedSrc(html) {
  if (typeof html !== 'string' || !html) return null;

  const match = html.match(/<iframe[^>]+src="([^"]+)"/i);
  return decodeRedditUrl(match?.[1] || null);
}

function extractRedgifsId(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!/(^|\.)redgifs\.com$/i.test(parsed.hostname)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex((segment) => segment === 'watch' || segment === 'ifr');
    if (markerIndex === -1 || !segments[markerIndex + 1]) return null;
    return segments[markerIndex + 1].toLowerCase();
  } catch {
    return null;
  }
}

function normalizeExternalVideo(post) {
  for (const candidate of getPostVariants(post)) {
    const media = candidate?.secure_media || candidate?.media;
    const oembed = media?.oembed;
    const embedUrl = extractEmbedSrc(oembed?.html);
    const providerName = String(oembed?.provider_name || media?.type || '').trim();
    const providerUrl = decodeRedditUrl(oembed?.provider_url || null);

    if (!embedUrl || !providerName) continue;

    return {
      externalVideoId: extractRedgifsId(embedUrl) || extractRedgifsId(decodeRedditUrl(candidate?.url_overridden_by_dest || candidate?.url) || providerUrl),
      externalVideoProvider: providerName,
      externalVideoEmbedUrl: embedUrl,
      externalVideoPageUrl: decodeRedditUrl(candidate?.url_overridden_by_dest || candidate?.url) || providerUrl,
      externalVideoPosterUrl: decodeRedditUrl(oembed?.thumbnail_url || null),
      externalVideoWidth: Number.isFinite(oembed?.width) ? Number(oembed.width) : null,
      externalVideoHeight: Number.isFinite(oembed?.height) ? Number(oembed.height) : null
    };
  }

  return null;
}

function getPlayableRedditVideo(post) {
  const crossposts = Array.isArray(post?.crosspost_parent_list) ? post.crosspost_parent_list : [];

  if (post?.secure_media?.reddit_video) {
    return {
      sourceKind: 'reddit',
      usedSecureMedia: true,
      usedMedia: false,
      usedCrosspostMedia: false,
      skippedBecausePreviewOnly: false,
      video: post.secure_media.reddit_video
    };
  }

  if (post?.media?.reddit_video) {
    return {
      sourceKind: 'reddit',
      usedSecureMedia: false,
      usedMedia: true,
      usedCrosspostMedia: false,
      skippedBecausePreviewOnly: false,
      video: post.media.reddit_video
    };
  }

  for (const crosspost of crossposts) {
    if (crosspost?.secure_media?.reddit_video) {
      return {
        sourceKind: 'reddit',
        usedSecureMedia: false,
        usedMedia: false,
        usedCrosspostMedia: true,
        skippedBecausePreviewOnly: false,
        video: crosspost.secure_media.reddit_video
      };
    }

    if (crosspost?.media?.reddit_video) {
      return {
        sourceKind: 'reddit',
        usedSecureMedia: false,
        usedMedia: false,
        usedCrosspostMedia: true,
        skippedBecausePreviewOnly: false,
        video: crosspost.media.reddit_video
      };
    }
  }

  if (post?.preview?.reddit_video_preview) {
    return {
      sourceKind: 'preview',
      usedSecureMedia: false,
      usedMedia: false,
      usedCrosspostMedia: false,
      skippedBecausePreviewOnly: false,
      video: post.preview.reddit_video_preview
    };
  }

  return {
    sourceKind: null,
    usedSecureMedia: false,
    usedMedia: false,
    usedCrosspostMedia: false,
    skippedBecausePreviewOnly: false,
    video: null
  };
}

function logNormalizedVideoSource(post, sourceInfo) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('[normalized-video-source]', {
    id: post?.id,
    title: post?.title,
    usedSecureMedia: sourceInfo.usedSecureMedia,
    usedMedia: sourceInfo.usedMedia,
    usedCrosspostMedia: sourceInfo.usedCrosspostMedia,
    skippedBecausePreviewOnly: sourceInfo.skippedBecausePreviewOnly
  });
}

function normalizeVideo(post) {
  const sourceInfo = getPlayableRedditVideo(post);
  logNormalizedVideoSource(post, sourceInfo);
  if (!sourceInfo.video) return null;

  const reportedHasAudio = parseHasAudio(sourceInfo.video?.has_audio);
  const audioCandidates = reportedHasAudio === true ? [] : buildRedditAudioCandidates(sourceInfo.video);

  const normalizedVideo = {
    videoUrl: decodeRedditUrl(sourceInfo.video?.fallback_url) || null,
    videoHlsUrl: decodeRedditUrl(sourceInfo.video?.hls_url) || null,
    videoDashUrl: decodeRedditUrl(sourceInfo.video?.dash_url) || null,
    videoHasAudio: reportedHasAudio,
    videoAudioUrls: audioCandidates,
    videoDurationSec: Number.isFinite(sourceInfo.video?.duration) ? Number(sourceInfo.video.duration) : null,
    videoSourceKind: sourceInfo.sourceKind === 'preview' ? 'preview' : 'reddit',
    videoIsPreviewSource: sourceInfo.sourceKind === 'preview',
    canPlayFullAudioInApp: reportedHasAudio === true || audioCandidates.length > 0
  };

  if (!normalizedVideo.videoUrl && !normalizedVideo.videoHlsUrl && !normalizedVideo.videoDashUrl) {
    return null;
  }

  return normalizedVideo;
}

function normalizeImage(post) {
  const direct = decodeRedditUrl(post?.url_overridden_by_dest || post?.url);
  if (isImageUrl(direct)) return direct;
  const preview = getPreviewImage(post);
  if (preview && isImageUrl(preview)) return preview;
  return null;
}

export function normalizePost(post) {
  if (!post || post?.is_self) return null;

  const destinationUrl = decodeRedditUrl(post?.url_overridden_by_dest || post?.url);
  const sourceHost = getSourceHost(destinationUrl);
  const externalVideo = normalizeExternalVideo(post);

  const base = {
    source: 'reddit',
    id: post.id,
    title: post.title || '',
    permalink: `https://www.reddit.com${post.permalink || ''}`,
    author: post.author || 'unknown',
    subreddit: post.subreddit || '',
    createdUtc: post.created_utc || null,
    score: post.score || 0,
    numComments: post.num_comments || 0,
    flair: post.link_flair_text || null,
    nsfw: Boolean(post.over_18),
    thumbnail: getThumbnail(post),
    mediaUrl: null,
    galleryItems: [],
    videoUrl: null,
    videoHlsUrl: null,
    videoDashUrl: null,
    videoHasAudio: null,
    videoAudioUrls: [],
    videoDurationSec: null,
    videoSourceKind: null,
    videoIsPreviewSource: false,
    canPlayFullAudioInApp: false,
    externalVideoProvider: externalVideo?.externalVideoProvider || null,
    externalVideoId: externalVideo?.externalVideoId || null,
    externalVideoEmbedUrl: externalVideo?.externalVideoEmbedUrl || null,
    externalVideoPageUrl: externalVideo?.externalVideoPageUrl || null,
    externalVideoPosterUrl: externalVideo?.externalVideoPosterUrl || null,
    externalVideoWidth: externalVideo?.externalVideoWidth || null,
    externalVideoHeight: externalVideo?.externalVideoHeight || null,
    sourceHost,
    isRedditHosted: isRedditHostedHost(sourceHost),
    type: null
  };

  const galleryItems = normalizeGallery(post);
  if (galleryItems) {
    const first = galleryItems[0];
    return {
      ...base,
      type: 'gallery',
      mediaUrl: first?.url || null,
      thumbnail: base.thumbnail || first?.url || null,
      galleryItems
    };
  }

  const video = normalizeVideo(post);
  if (video?.videoUrl || video?.videoHlsUrl || video?.videoDashUrl) {
    return {
      ...base,
      type: 'video',
      mediaUrl: video.videoHlsUrl || video.videoDashUrl || video.videoUrl,
      videoUrl: video.videoUrl,
      videoHlsUrl: video.videoHlsUrl,
      videoDashUrl: video.videoDashUrl,
      videoHasAudio: video.videoHasAudio,
      videoAudioUrls: video.videoAudioUrls,
      videoDurationSec: video.videoDurationSec,
      videoSourceKind: video.videoSourceKind,
      videoIsPreviewSource: video.videoIsPreviewSource,
      canPlayFullAudioInApp: video.canPlayFullAudioInApp || Boolean(externalVideo?.externalVideoEmbedUrl)
    };
  }

  const imageUrl = normalizeImage(post);
  if (imageUrl) {
    return { ...base, type: 'image', mediaUrl: imageUrl };
  }

  const fallbackUrl = decodeRedditUrl(post?.url_overridden_by_dest || post?.url);
  if (isGifLikeUrl(fallbackUrl)) {
    return {
      ...base,
      type: 'video',
      mediaUrl: fallbackUrl,
      videoUrl: fallbackUrl,
      videoSourceKind: 'url',
      videoIsPreviewSource: false,
      videoAudioUrls: [],
      canPlayFullAudioInApp: false
    };
  }

  return null;
}

export function sanitizeSort(sort) {
  return ALLOWED_SORTS.has(sort) ? sort : 'hot';
}

export function sanitizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed)) return 25;
  return Math.min(100, Math.max(1, parsed));
}
