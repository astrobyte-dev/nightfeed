import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRedditComments, getRedgifsStreamUrl } from '../utils/api';
import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { canDownloadUrl, getModalItems, getTypeBadge, getTypeHelper, isPreviewVideo } from '../utils/media';
import VideoPlayer from './VideoPlayer';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useToast } from './Toast';

const isDev = import.meta.env.DEV;

function renderCommentBody(text) {
  if (!text) return null;

  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/i.test(part)) {
      return (
        <a key={'link-' + index} href={part} target="_blank" rel="noopener noreferrer" className="comment-link">
          {part}
        </a>
      );
    }

    return <span key={'text-' + index}>{part}</span>;
  });
}

function CommentThread({ comment }) {
  return (
    <article className="comment-card">
      <div className="comment-head">
        <strong>u/{comment.author}</strong>
        <span>{formatScore(comment.score)}</span>
      </div>
      <p>{renderCommentBody(comment.body)}</p>
      {comment.replies?.length ? (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <article key={reply.id} className="comment-reply">
              <div className="comment-head">
                <strong>u/{reply.author}</strong>
                <span>{formatScore(reply.score)}</span>
              </div>
              <p>{renderCommentBody(reply.body)}</p>
            </article>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function buildAutoplayUrl(rawSrc) {
  if (!rawSrc) return rawSrc;
  try {
    const url = new URL(rawSrc, 'https://www.example.com');
    if (/youtube(-nocookie)?\.com$/i.test(url.hostname) || /youtu\.be$/i.test(url.hostname)) {
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '0');
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('rel', '0');
      url.searchParams.set('modestbranding', '1');
    } else if (/vimeo\.com$/i.test(url.hostname) || /player\.vimeo\.com$/i.test(url.hostname)) {
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('muted', '0');
      url.searchParams.set('dnt', '1');
    } else if (/streamable\.com$/i.test(url.hostname)) {
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('muted', '0');
    } else if (/redgifs\.com$/i.test(url.hostname)) {
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('controls', '1');
      url.searchParams.set('muted', '0');
    }
    return url.toString();
  } catch {
    return rawSrc;
  }
}

function IframeEmbed({ src, title, width, height }) {
  const [loaded, setLoaded] = useState(false);
  const finalSrc = useMemo(() => buildAutoplayUrl(src), [src]);

  const w = Number(width) || 16;
  const h = Number(height) || 9;
  const isPortrait = h > w;
  const frameStyle = isPortrait
    ? { height: '100%', width: 'auto', aspectRatio: `${w} / ${h}` }
    : { width: '100%', height: 'auto', aspectRatio: `${w} / ${h}` };

  return (
    <div className="modal-iframe-wrap">
      <div className="modal-iframe-frame" style={frameStyle}>
        {!loaded && (
          <div className="modal-iframe-loading" aria-hidden="true">
            <span className="spinner" />
          </div>
        )}
        <iframe
          src={finalSrc}
          title={title || 'External video'}
          className="modal-iframe"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

function LightboxModal({
  post,
  onClose,
  onPrevPost,
  onNextPost,
  onOpenAuthorGallery,
  onFirstPost,
  onLastPost,
  canNavigate,
  enableWheelNavigation,
  nextVideoToPrebuffer,
  isFavorited,
  onToggleFavorite
}) {
  const toast = useToast();
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCompactModal, setIsCompactModal] = useState(false);
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [comments, setComments] = useState([]);
  const [persistMuted, setPersistMuted] = useState(null);
  const [resolvedEmbedPlayback, setResolvedEmbedPlayback] = useState(null);
  const [embedPlaybackError, setEmbedPlaybackError] = useState('');
  const lastWheelAt = useRef(0);
  const touchStartY = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const videoPlayerRef = useRef(null);

  const items = useMemo(() => getModalItems(post), [post]);
  const isGalleryPost = post?.type === 'gallery' && items.length > 1;
  const current = items[index];
  const companionAudioUrls = useMemo(
    () => current?.audioUrls || post?.videoAudioUrls || [],
    [current?.audioUrls, post?.videoAudioUrls]
  );

  useEffect(() => {
    setIndex(0);
    setHasUserInteracted(false);
    setShowComments(false);
    setCommentsLoading(false);
    setCommentsError('');
    setComments([]);
    setResolvedEmbedPlayback(null);
    setEmbedPlaybackError('');
  }, [post?.id]);

  const isRedgifsEmbed = current?.kind === 'embed' && current?.provider === 'RedGIFs' && Boolean(current?.id);
  const [redgifsProxyFailed, setRedgifsProxyFailed] = useState(false);
  const isIframeEmbed = current?.kind === 'embed'
    && Boolean(current?.url)
    && (!isRedgifsEmbed || redgifsProxyFailed);
  const redgifsStreamUrl = useMemo(
    () => (isRedgifsEmbed && !redgifsProxyFailed ? getRedgifsStreamUrl(current.id) : null),
    [isRedgifsEmbed, redgifsProxyFailed, current?.id]
  );

  useEffect(() => {
    setResolvedEmbedPlayback(null);
    setEmbedPlaybackError('');
    setRedgifsProxyFailed(false);
  }, [current]);

  useEffect(() => {
    if (!redgifsStreamUrl) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    fetch(redgifsStreamUrl, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) setRedgifsProxyFailed(true);
      })
      .catch(() => {
        if (!cancelled) setRedgifsProxyFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [redgifsStreamUrl]);

  useEffect(() => {
    function updateViewport() {
      setIsMobileViewport(window.innerWidth <= 900);
      setIsCompactModal(window.innerWidth <= 1050);
    }

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!post) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [post]);

  useEffect(() => {
    if (!post) return undefined;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [post]);

  useFocusTrap(modalRef, Boolean(post));
  const canDownload = canDownloadUrl(current?.url);
  const canOpenAuthorGallery = post?.source === 'reddit' || post?.source === 'library';
  const canShowComments = post?.source === 'reddit' && post?.permalink;
  const isTikTokMobileMode = isMobileViewport && current?.kind === 'video' && enableWheelNavigation;
  const isPreview = isPreviewVideo(post);
  const hasCompanionAudio = Boolean(current?.audioUrls?.length || post?.videoAudioUrls?.length);
  const hasExternalVideoEmbed = current?.kind === 'embed';
  const hasResolvedEmbedPlayback = Boolean(resolvedEmbedPlayback?.previewUrl || resolvedEmbedPlayback?.videoUrl);
  const needsRedditHandoff = post?.source === 'reddit' && post?.type === 'video' && post?.canPlayFullAudioInApp === false;
  const isVideo = current?.kind === 'video';
  const isAudio = current?.kind === 'audio';
  const hasDirectEmbedControls = hasExternalVideoEmbed && hasResolvedEmbedPlayback;
  const canControlPlayback = isVideo || hasDirectEmbedControls;
  const isPortraitEmbed = hasExternalVideoEmbed && Number(current?.height || 0) > Number(current?.width || 0);
  const embedWidth = isPortraitEmbed ? 'min(100%, 440px)' : 'min(100%, 760px)';
  const previewInfo = isPreview
    ? hasExternalVideoEmbed
      ? {
          label: `${current?.provider || post?.externalVideoProvider || 'External'} video`,
          copy: 'Playing directly from the source with full controls.'
        }
      : post?.canPlayFullAudioInApp
      ? {
          label: hasCompanionAudio ? 'Preview Video with Synced Audio' : 'Preview Video',
          copy: hasCompanionAudio
            ? 'This Reddit preview keeps the fast-loading video stream and syncs a companion audio track in the modal.'
            : 'This Reddit preview keeps the fast-loading feed stream and can play with sound in the modal.'
        }
      : {
          label: 'Preview Video Only',
          copy: "Reddit's public feed often exposes lightweight preview streams for in-app playback. Open the original Reddit post for the full Reddit player experience."
        }
    : needsRedditHandoff
      ? {
          label: 'Open on Reddit for Full Playback',
          copy: 'This in-app stream is optimized for fast browsing. Open the original Reddit post when you want the full Reddit playback experience.'
        }
      : null;
  const typeLabel = getTypeBadge(post);
  const typeHelper = getTypeHelper(post);
  const primaryActionLabel = post?.source === 'reddit' ? 'Open on Reddit' : post?.source === 'library' ? 'Open on Coomer' : 'Open Original Post';
  const activeSourceKind = current?.sourceKind || post?.videoSourceKind || null;
  const isDirectUrlOnly = Boolean(isVideo && !current?.hlsUrl && !current?.dashUrl && current?.url);
  const sourceActionHref = current?.pageUrl || post?.externalVideoPageUrl || post?.permalink || null;
  const sourceActionLabel = post?.externalVideoProvider ? `Open ${post.externalVideoProvider}` : 'Open Original';

  async function handleToggleComments() {
    if (!canShowComments) return;
    const nextOpen = !showComments;
    setShowComments(nextOpen);
    if (!nextOpen || comments.length || commentsLoading) return;

    try {
      setCommentsLoading(true);
      setCommentsError('');
      const payload = await fetchRedditComments({ permalink: post.permalink, limit: 12 });
      setComments(payload.comments || []);
    } catch (error) {
      setCommentsError(error.message || 'Unable to load comments.');
    } finally {
      setCommentsLoading(false);
    }
  }

  function goFirstPost() {
    setHasUserInteracted(true);
    onFirstPost?.();
  }

  function goLastPost() {
    setHasUserInteracted(true);
    onLastPost?.();
  }

  function goNextPost() {
    setHasUserInteracted(true);
    onNextPost();
  }

  function goPrevPost() {
    setHasUserInteracted(true);
    onPrevPost();
  }

  function goNextGalleryItem() {
    if (items.length < 2) return false;
    setHasUserInteracted(true);

    if (index < items.length - 1) {
      setIndex((prev) => prev + 1);
      return true;
    }

    if (canNavigate) {
      goNextPost();
      return true;
    }

    setIndex(0);
    return true;
  }

  function goPrevGalleryItem() {
    if (items.length < 2) return false;
    setHasUserInteracted(true);

    if (index > 0) {
      setIndex((prev) => prev - 1);
      return true;
    }

    if (canNavigate) {
      goPrevPost();
      return true;
    }

    setIndex(items.length - 1);
    return true;
  }

  function handleMoveNext() {
    if (isGalleryPost) {
      goNextGalleryItem();
      return;
    }

    if (canNavigate) {
      goNextPost();
      return;
    }

    if (items.length > 1) {
      setIndex((prev) => (prev + 1) % items.length);
    }
  }

  function handleMovePrev() {
    if (isGalleryPost) {
      goPrevGalleryItem();
      return;
    }

    if (canNavigate) {
      goPrevPost();
      return;
    }

    if (items.length > 1) {
      setIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  }

  useEffect(() => {
    if (!post) return undefined;

    function unlockAudio() {
      setHasUserInteracted(true);
    }

    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        goFirstPost();
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        goLastPost();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleMoveNext();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleMovePrev();
        return;
      }

      if (canControlPlayback && event.code === 'Space') {
        event.preventDefault();
        setHasUserInteracted(true);
        videoPlayerRef.current?.togglePlay?.();
        return;
      }

      if (canControlPlayback && (event.key === 'm' || event.key === 'M')) {
        event.preventDefault();
        setHasUserInteracted(true);
        videoPlayerRef.current?.toggleMute?.();
        return;
      }

      if (canControlPlayback && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        setHasUserInteracted(true);
        videoPlayerRef.current?.toggleFullscreen?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, [post, canControlPlayback, index, items.length, isGalleryPost, canNavigate, onClose, onNextPost, onPrevPost, onFirstPost, onLastPost]);

  useEffect(() => {
    if (!enableWheelNavigation) return undefined;

    function onGlobalWheel(event) {
      const fullscreenElement = document.fullscreenElement;
      const withinModal = modalRef.current?.contains(event.target instanceof Node ? event.target : null);
      if (!withinModal && !fullscreenElement) return;
      handleWheel(event);
    }

    window.addEventListener('wheel', onGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onGlobalWheel);
    };
  }, [enableWheelNavigation, isGalleryPost, canNavigate, items.length, index, post?.id]);

  function handleWheel(event) {
    if (!enableWheelNavigation) return;
    event.preventDefault();
    event.stopPropagation();
    setHasUserInteracted(true);

    const now = Date.now();
    if (now - lastWheelAt.current < 320) return;
    if (Math.abs(event.deltaY) < 18) return;

    lastWheelAt.current = now;
    if (event.deltaY > 0) handleMoveNext();
    else handleMovePrev();
  }

  function handleTouchStart(event) {
    if (!isTikTokMobileMode) return;
    setHasUserInteracted(true);
    touchStartY.current = event.touches?.[0]?.clientY ?? null;
  }

  function handleTouchMove(event) {
    if (!isTikTokMobileMode) return;
    event.preventDefault();
  }

  function handleTouchEnd(event) {
    if (!isTikTokMobileMode || touchStartY.current === null) return;

    const endY = event.changedTouches?.[0]?.clientY ?? null;
    if (endY === null) {
      touchStartY.current = null;
      return;
    }

    const deltaY = touchStartY.current - endY;
    touchStartY.current = null;
    if (Math.abs(deltaY) < 50) return;

    if (deltaY > 0) handleMoveNext();
    else handleMovePrev();
  }

  if (!post) return null;

  const keyboardHints = [
    'Left / Right navigate',
    'Esc close',
    'Home first item',
    'End last item'
  ];

  if (canControlPlayback) {
    keyboardHints.push('Space play/pause', 'M mute', 'F fullscreen');
  }

  if (isGalleryPost) {
    keyboardHints[0] = 'Left / Right gallery then posts';
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal modal-split"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
      >
        <button type="button" className="modal-floating-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {canNavigate && (
          <>
            <button type="button" className="modal-floating-nav modal-floating-nav-prev" onClick={goPrevPost} aria-label="Previous post">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button type="button" className="modal-floating-nav modal-floating-nav-next" onClick={goNextPost} aria-label="Next post">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </>
        )}

        <div className="modal-split-media" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="modal-media-frame">
            {!current && <div className="modal-helper-copy">This item could not be rendered.</div>}
            {current?.kind === 'video' && (
              <VideoPlayer
                ref={videoPlayerRef}
                mp4Url={current.url}
                hlsUrl={current.hlsUrl}
                dashUrl={current.dashUrl}
                companionAudioUrls={companionAudioUrls}
                hasAudio={current.hasAudio ?? post?.videoHasAudio ?? null}
                sourceKind={activeSourceKind}
                posterUrl={post?.thumbnail || ''}
                className="modal-video"
                autoPlay
                loop
                allowUnmutedAutoplay={hasUserInteracted}
                preferredMuted={persistMuted}
                onMutedChange={setPersistMuted}
              />
            )}

            {current?.kind === 'embed' && (
              isRedgifsEmbed && redgifsStreamUrl ? (
                <VideoPlayer
                  ref={videoPlayerRef}
                  mp4Url={redgifsStreamUrl}
                  hasAudio={true}
                  sourceKind="redgifs"
                  posterUrl={current?.posterUrl || post?.thumbnail || ''}
                  className="modal-video"
                  autoPlay
                  loop
                  allowUnmutedAutoplay={hasUserInteracted}
                  preferredMuted={persistMuted}
                  onMutedChange={setPersistMuted}
                />
              ) : isIframeEmbed ? (
                <IframeEmbed
                  src={current.url}
                  title={post.title}
                  width={current.width}
                  height={current.height}
                />
              ) : (
                <div className="modal-embed-wrap" style={{ width: embedWidth }}>
                  <div className="modal-loading">
                    <span className="spinner" aria-hidden="true" />
                    <span>Loading video…</span>
                  </div>
                </div>
              )
            )}

            {current?.kind === 'image' && <img src={current?.url || ''} alt={post.title} className="modal-image" />}

            {current?.kind === 'audio' && (
              <div className="modal-audio-wrap">
                {current?.posterUrl ? (
                  <img src={current.posterUrl} alt={post.title} className="modal-image" />
                ) : (
                  <div className="media-preview media-preview-audio-fallback modal-audio-fallback">
                    <span className="audio-glyph">Audio</span>
                  </div>
                )}
                <audio controls preload="metadata" src={current.url}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

          </div>

          {nextVideoToPrebuffer?.url && (
            <div className="modal-prebuffer-host" aria-hidden="true">
              <VideoPlayer mp4Url={nextVideoToPrebuffer.url} hlsUrl={nextVideoToPrebuffer.hlsUrl} dashUrl={nextVideoToPrebuffer.dashUrl} className="modal-video" prebufferOnly />
            </div>
          )}

          {items.length > 1 && (
            <div className="modal-media-controls">
              <button type="button" className="modal-media-ctrl" onClick={handleMovePrev} aria-label="Previous item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="modal-media-counter">{index + 1} / {items.length}</span>
              <button type="button" className="modal-media-ctrl" onClick={handleMoveNext} aria-label="Next item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>

        <aside className="modal-info-panel">
          <div className="modal-info-head">
            <p className="modal-kicker">{post.source === 'library' ? post.creator || 'Coomer' : `r/${post.subreddit}`}</p>
            <h2 className="modal-title">{post.title}</h2>
            <div className="modal-meta-inline">
              <span className={`detail-badge detail-badge-${post.type}`} title={typeHelper}>{typeLabel}</span>
              {(post.type === 'video' && post.videoDurationSec) || (post.type === 'audio' && post.duration) ? (
                <span className="detail-badge detail-badge-muted">{formatDuration(post.type === 'audio' ? post.duration : post.videoDurationSec)}</span>
              ) : null}
              {post.source === 'reddit' && post.isRedditHosted ? <span className="detail-badge detail-badge-muted">Reddit-hosted</span> : null}
            </div>
          </div>

          <div className="modal-stat-row">
            <div className="modal-stat">
              <span className="modal-stat-value">{formatScore(post.score)}</span>
              <span className="modal-stat-key">score</span>
            </div>
            <div className="modal-stat-divider" aria-hidden="true" />
            {canShowComments ? (
              <button type="button" className="modal-stat modal-stat-action" onClick={handleToggleComments} aria-expanded={showComments}>
                <span className="modal-stat-value">{formatScore(post.numComments || 0)}</span>
                <span className="modal-stat-key">{showComments ? 'hide' : 'comments'}</span>
              </button>
            ) : (
              <div className="modal-stat">
                <span className="modal-stat-value">{formatScore(post.numComments || 0)}</span>
                <span className="modal-stat-key">comments</span>
              </div>
            )}
            <div className="modal-stat-divider" aria-hidden="true" />
            <div className="modal-stat">
              <span className="modal-stat-value">{post.source === 'library' ? post.creator || '—' : post.author}</span>
              <span className="modal-stat-key">author</span>
            </div>
            <div className="modal-stat-divider" aria-hidden="true" />
            <div className="modal-stat">
              <span className="modal-stat-value">{formatPostDate(post.createdUtc)}</span>
              <span className="modal-stat-key">posted</span>
            </div>
          </div>

          <div className="modal-action-row">
            <a
              className="modal-cta"
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              {primaryActionLabel}
            </a>

            {sourceActionHref && sourceActionHref !== post.permalink && (
              <a className="modal-cta modal-cta-secondary" href={sourceActionHref} target="_blank" rel="noopener noreferrer">
                {sourceActionLabel}
              </a>
            )}
          </div>

          <div className="modal-icon-row" role="toolbar" aria-label="Post actions">
            {onToggleFavorite && (
              <button
                type="button"
                className={`modal-icon-btn ${isFavorited ? 'active' : ''}`}
                onClick={() => {
                  const wasFavorited = isFavorited;
                  onToggleFavorite(post);
                  toast.show(wasFavorited ? 'Removed from favorites' : 'Saved to favorites');
                }}
                aria-pressed={isFavorited ? 'true' : 'false'}
                aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
                title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
                </svg>
                <span>Save</span>
              </button>
            )}

            <button
              type="button"
              className="modal-icon-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(post.permalink);
                  toast.show('Link copied');
                } catch {
                  toast.show('Could not copy link', { variant: 'error' });
                }
              }}
              aria-label="Copy post link"
              title="Copy post link"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </button>

            <button
              type="button"
              className="modal-icon-btn"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({ title: post.title, url: post.permalink });
                    return;
                  }
                  await navigator.clipboard.writeText(window.location.href);
                  toast.show('Feed link copied');
                } catch {}
              }}
              aria-label="Share"
              title="Share"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span>Share</span>
            </button>

            {canDownload && (
              <a className="modal-icon-btn" href={current.url} target="_blank" rel="noopener noreferrer" download aria-label="Download" title="Download">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Save file</span>
              </a>
            )}

            {canOpenAuthorGallery && (
              <button type="button" className="modal-icon-btn" onClick={() => onOpenAuthorGallery(post)} aria-label="Author gallery" title="Author gallery">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Author</span>
              </button>
            )}
          </div>

          {showComments && canShowComments && (
            <section className="modal-card comments-panel">
              <div className="modal-card-head">
                <span className="modal-card-title">Top comments</span>
                <button type="button" className="text-button" onClick={handleToggleComments}>Close</button>
              </div>
              {commentsLoading && <p className="modal-helper-copy">Loading comments…</p>}
              {!commentsLoading && commentsError && <p className="modal-helper-copy">{commentsError}</p>}
              {!commentsLoading && !commentsError && comments.length === 0 && <p className="modal-helper-copy">No readable comments returned.</p>}
              {!commentsLoading && !commentsError && comments.length > 0 && (
                <div className="comments-list">
                  {comments.map((comment) => (
                    <CommentThread key={comment.id} comment={comment} />
                  ))}
                </div>
              )}
            </section>
          )}

          {previewInfo && (
            <section className="modal-card modal-card-accent">
              <span className="modal-card-title">{previewInfo.label}</span>
              <p className="modal-helper-copy">{previewInfo.copy}</p>
            </section>
          )}

          {post.flair && (
            <div className="modal-flair-row">
              <span className="modal-flair-label">Flair</span>
              <span className="modal-flair-value">{post.flair}</span>
            </div>
          )}

          <details className="modal-shortcuts">
            <summary>Keyboard shortcuts</summary>
            <div className="shortcut-hint-list">
              {keyboardHints.map((hint) => (
                <span key={hint} className="shortcut-hint">{hint}</span>
              ))}
            </div>
          </details>

          <div className="modal-navigation-panel">
            {false && canNavigate && (
              <div className="modal-post-nav">
                <button type="button" onClick={goPrevPost}>Previous Post</button>
                <button type="button" onClick={goNextPost}>Next Post</button>
              </div>
            )}
            {enableWheelNavigation && (
              <p className="modal-helper-copy">{isTikTokMobileMode ? 'Swipe up or down to move between posts.' : 'Use the wheel or arrow keys to move between posts.'}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default LightboxModal;




