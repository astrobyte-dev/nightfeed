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

function getThumbnail(post) {
  const preview = getPreviewImage(post);
  if (preview) return preview;
  const thumb = post?.thumbnail;
  if (thumb && /^https?:\/\//.test(thumb)) return thumb;
  return null;
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

function collectRedditVideoCandidates(post) {
  const cross = Array.isArray(post?.crosspost_parent_list) ? post.crosspost_parent_list : [];
  return [
    post?.secure_media?.reddit_video,
    post?.media?.reddit_video,
    ...cross.map((item) => item?.secure_media?.reddit_video),
    ...cross.map((item) => item?.media?.reddit_video),
    post?.preview?.reddit_video_preview
  ].filter(Boolean);
}

function parseHasAudio(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function buildRedditAudioCandidates({ fallbackUrl, dashUrl }) {
  const rawSources = [fallbackUrl, dashUrl].filter(Boolean);
  const filenames = ['DASH_AUDIO_192.mp4', 'DASH_AUDIO_128.mp4', 'DASH_AUDIO_96.mp4', 'DASH_AUDIO_64.mp4', 'DASH_audio.mp4', 'audio'];
  const results = [];

  for (const raw of rawSources) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname !== 'v.redd.it') continue;

      const dashIndex = parsed.pathname.indexOf('/DASH_');
      const playlistIndex = parsed.pathname.indexOf('/DASHPlaylist');
      const splitIndex = dashIndex >= 0 ? dashIndex : playlistIndex;
      if (splitIndex < 0) continue;

      const basePath = parsed.pathname.slice(0, splitIndex);
      for (const filename of filenames) {
        const variants = [`${parsed.origin}${basePath}/${filename}${parsed.search}`, `${parsed.origin}${basePath}/${filename}`];
        for (const candidate of variants) {
          if (!results.includes(candidate)) results.push(candidate);
        }
      }
    } catch {
      // Ignore invalid URLs.
    }
  }

  return results;
}

function normalizeVideo(post) {
  const candidates = collectRedditVideoCandidates(post)
    .map((video) => {
      const fallbackUrl = decodeRedditUrl(video?.fallback_url);
      const hlsUrl = decodeRedditUrl(video?.hls_url);
      const dashUrl = decodeRedditUrl(video?.dash_url);
      return {
        fallbackUrl,
        hlsUrl,
        dashUrl,
        hasAudio: parseHasAudio(video?.has_audio),
        durationSec: Number.isFinite(video?.duration) ? Number(video.duration) : null,
        audioUrls: buildRedditAudioCandidates({ fallbackUrl, dashUrl })
      };
    })
    .filter((video) => video.fallbackUrl || video.hlsUrl);

  if (!candidates.length) return null;

  const best = candidates
    .map((video) => ({
      ...video,
      score:
        (video.hasAudio === true ? 100 : video.hasAudio === null ? 40 : 0) +
        (video.hlsUrl ? 20 : 0) +
        (video.fallbackUrl ? 10 : 0) +
        (video.audioUrls.length ? 5 : 0)
    }))
    .sort((a, b) => b.score - a.score)[0];

  return {
    videoUrl: best.fallbackUrl || best.hlsUrl,
    videoHlsUrl: best.hlsUrl || null,
    videoDashUrl: best.dashUrl || null,
    videoAudioUrls: best.audioUrls || [],
    videoHasAudio: best.hasAudio,
    videoDurationSec: best.durationSec
  };
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

  const base = {
    id: post.id,
    title: post.title || '',
    permalink: `https://www.reddit.com${post.permalink || ''}`,
    author: post.author || 'unknown',
    subreddit: post.subreddit || '',
    createdUtc: post.created_utc || null,
    score: post.score || 0,
    nsfw: Boolean(post.over_18),
    thumbnail: getThumbnail(post),
    mediaUrl: null,
    galleryItems: [],
    videoUrl: null,
    videoHlsUrl: null,
    videoDashUrl: null,
    videoAudioUrls: [],
    videoHasAudio: null,
    videoDurationSec: null,
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
  if (video?.videoUrl) {
    return {
      ...base,
      type: 'video',
      mediaUrl: video.videoUrl,
      videoUrl: video.videoUrl,
      videoHlsUrl: video.videoHlsUrl,
      videoDashUrl: video.videoDashUrl,
      videoAudioUrls: video.videoAudioUrls,
      videoHasAudio: video.videoHasAudio,
      videoDurationSec: video.videoDurationSec
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
      videoAudioUrls: buildRedditAudioCandidates({ fallbackUrl, dashUrl: null }),
      videoHasAudio: null
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
