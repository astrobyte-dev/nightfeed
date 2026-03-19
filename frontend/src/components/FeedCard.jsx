import { useEffect, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { getCardPreview } from '../utils/media';

function isGifUrl(url) {
  if (!url) return false;
  return /\.gif(v)?$/i.test(url.split('?')[0]);
}

function FeedCard({ post, isActive, onOpenLightbox, onOpenAuthorGallery }) {
  const playerRef = useRef(null);
  const muteRef = useRef(null);
  const overlayRef = useRef(null);
  const [persistMuted, setPersistMuted] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const preview = getCardPreview(post);
  const isVideo = post.type === 'video';
  const videoSrc = post.videoUrl || post.mediaUrl;
  const isGif = isVideo && isGifUrl(videoSrc);
  const isReddit = post.source === 'reddit';
  const isInstagram = post.source === 'instagram';
  const isSimpcity = post.source === 'simpcity';
  const isLibrary = post.source === 'library';
  const duration = (post.type === 'video' ? post.videoDurationSec : post.duration)
    ? formatDuration(post.type === 'video' ? post.videoDurationSec : post.duration)
    : null;

  // Keep mute button visible during fullscreen by reparenting it into the fullscreen element
  useEffect(() => {
    function onFullscreenChange() {
      const fsEl = document.fullscreenElement;
      const muteBtn = muteRef.current;
      if (!muteBtn) return;
      if (fsEl) {
        fsEl.appendChild(muteBtn);
      } else {
        overlayRef.current?.appendChild(muteBtn);
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Block native fullscreen on mobile — the card already fills the screen
  useEffect(() => {
    const video = playerRef.current?.getVideoElement?.();
    if (!video) return;
    function onFullscreenRequest(e) {
      if (window.innerWidth <= 960) e.preventDefault();
    }
    video.addEventListener('webkitbeginfullscreen', onFullscreenRequest);
    return () => video.removeEventListener('webkitbeginfullscreen', onFullscreenRequest);
  }, []);

  // Drive play/pause from isActive after initial mount
  useEffect(() => {
    if (!playerRef.current) return;
    if (isActive) {
      playerRef.current.play().catch?.(() => {});
    } else {
      playerRef.current.pause();
    }
  }, [isActive]);

  function handleAuthorClick(e) {
    e.stopPropagation();
    onOpenAuthorGallery(post);
  }

  return (
    <article className="feed-card" onClick={() => onOpenLightbox(post)}>
      <div className="feed-card-media">
        {isVideo && isGif ? (
          <img className="feed-card-img" src={videoSrc} alt={post.title} />
        ) : isVideo ? (
          <VideoPlayer
            ref={playerRef}
            mp4Url={videoSrc}
            hlsUrl={post.videoHlsUrl}
            dashUrl={post.videoDashUrl}
            companionAudioUrls={post.videoAudioUrls || []}
            hasAudio={post.videoHasAudio}
            sourceKind={post.videoSourceKind}
            posterUrl={post.thumbnail || ''}
            autoPlay={isActive}
            loop
            allowUnmutedAutoplay={false}
            preferredMuted={persistMuted}
            onMutedChange={(m) => { setPersistMuted(m); setIsMuted(m); }}
            className="feed-video"
          />
        ) : preview ? (
          <img className="feed-card-img" src={preview} alt={post.title} />
        ) : (
          <div className="feed-card-fallback">No preview</div>
        )}
      </div>

      <div className="feed-card-overlay" ref={overlayRef}>
        {isVideo && !isGif && (
          <button
            ref={muteRef}
            type="button"
            className="feed-hud-btn feed-mute-btn"
            onClick={(e) => { e.stopPropagation(); playerRef.current?.toggleMute?.(); setIsMuted((m) => !m); }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        )}
        <div className="feed-card-meta">
          <p className="feed-card-title">{post.title}</p>
          <p className="feed-card-sub">
            {isReddit && `r/${post.subreddit}`}
            {isInstagram && `@${post.author}`}
            {isSimpcity && (post.section || post.subreddit || 'SimpCity')}
            {isLibrary && (post.creator || post.author)}
          </p>
          <button
            type="button"
            className="feed-card-author"
            onClick={handleAuthorClick}
          >
            {isReddit ? `u/${post.author}` : isInstagram ? `@${post.author}` : post.author || ''}
          </button>
          <div className="feed-card-badges">
            {duration && <span className="feed-badge">{duration}</span>}
            {isReddit && post.score != null && (
              <span className="feed-badge">{formatScore(post.score)} pts</span>
            )}
            {post.createdUtc && (
              <span className="feed-badge">{formatPostDate(post.createdUtc)}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default FeedCard;
