import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRedditComments, fetchRedgifsMedia } from '../utils/api';
import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { canDownloadUrl, getModalItems, getTypeBadge, getTypeHelper, isPreviewVideo } from '../utils/media';
import VideoPlayer from './VideoPlayer';

const isDev = import.meta.env.DEV;

function renderCommentBody(text) {
  if (!text) return null;

  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/i.test(part)) {
      return (
        <a key={'link-' + index} href={part} target="_blank" rel="noreferrer" className="comment-link">
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
  nextVideoToPrebuffer
}) {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCompactModal, setIsCompactModal] = useState(false);
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [comments, setComments] = useState([]);
  const [playerDiagnostics, setPlayerDiagnostics] = useState(null);
  const [persistMuted, setPersistMuted] = useState(null);
  const [useDirectEmbedPlayback, setUseDirectEmbedPlayback] = useState(false);
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

  useEffect(() => {
    setIndex(0);
    setHasUserInteracted(false);
    setShowComments(false);
    setCommentsLoading(false);
    setCommentsError('');
    setComments([]);
    setPlayerDiagnostics(null);
    setUseDirectEmbedPlayback(false);
    setResolvedEmbedPlayback(null);
    setEmbedPlaybackError('');
  }, [post?.id]);

  useEffect(() => {
    if (!useDirectEmbedPlayback || current?.kind !== 'embed' || current?.provider !== 'RedGIFs' || !current?.id) {
      setResolvedEmbedPlayback(null);
      setEmbedPlaybackError('');
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        setEmbedPlaybackError('');
        const payload = await fetchRedgifsMedia(current.id);
        if (!cancelled) {
          setResolvedEmbedPlayback(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setResolvedEmbedPlayback(null);
          setEmbedPlaybackError(error.message || 'Unable to load in-app controls for this video.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useDirectEmbedPlayback, current]);

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
  const canDownload = canDownloadUrl(current?.url);
  const canOpenAuthorGallery = post?.source === 'reddit' || post?.source === 'instagram' || post?.source === 'library';
  const canShowComments = post?.source === 'reddit' && post?.permalink;
  const isTikTokMobileMode = isMobileViewport && current?.kind === 'video' && enableWheelNavigation;
  const isPreview = isPreviewVideo(post);
  const hasCompanionAudio = Boolean(current?.audioUrls?.length || post?.videoAudioUrls?.length);
  const hasExternalVideoEmbed = current?.kind === 'embed';
  const hasResolvedEmbedPlayback = Boolean(resolvedEmbedPlayback?.previewUrl || resolvedEmbedPlayback?.videoUrl);
  const needsRedditHandoff = post?.source === 'reddit' && post?.type === 'video' && post?.canPlayFullAudioInApp === false;
  const isVideo = current?.kind === 'video';
  const isAudio = current?.kind === 'audio';
  const hasDirectEmbedControls = hasExternalVideoEmbed && useDirectEmbedPlayback && hasResolvedEmbedPlayback;
  const canControlPlayback = isVideo || hasDirectEmbedControls;
  const isPortraitEmbed = hasExternalVideoEmbed && Number(current?.height || 0) > Number(current?.width || 0);
  const embedWidth = isPortraitEmbed ? 'min(100%, 440px)' : 'min(100%, 760px)';
  const previewInfo = isPreview
    ? hasDirectEmbedControls
      ? {
          label: `${current?.provider || post?.externalVideoProvider || 'External'} in-app controls`,
          copy: 'This video is using the in-app player, so wheel navigation, sticky unmute, click pause, and spacebar playback all work over the video.'
        }
      : hasExternalVideoEmbed
      ? {
          label: `${current?.provider || post?.externalVideoProvider || 'External'} video with audio`,
          copy: 'This Reddit post uses an external embedded player in the modal so you get the original source playback with sound.'
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
  const primaryActionLabel = post?.source === 'reddit' ? 'Open on Reddit' : post?.source === 'simpcity' ? 'Open thread' : post?.source === 'library' ? 'Open on Coomer' : 'Open Original Post';
  const modalStyle = isCompactModal
    ? {
        width: '100vw',
        height: '100vh',
        maxHeight: 'none',
        borderRadius: 0,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'minmax(44vh, 1fr) auto',
        background: 'linear-gradient(180deg, rgba(8, 16, 28, 0.98), rgba(5, 11, 20, 0.99))'
      }
    : {
        width: 'min(1240px, calc(100vw - 48px))',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 40px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 336px)',
        gap: 0,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(8, 16, 28, 0.98), rgba(5, 11, 20, 0.99))'
      };
  const mediaColumnStyle = isCompactModal
    ? {
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        borderRight: 0,
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        background: 'radial-gradient(circle at top, rgba(15, 32, 56, 0.5), rgba(3, 9, 18, 0.96))'
      }
    : {
        minWidth: 0,
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        background: 'radial-gradient(circle at top, rgba(15, 32, 56, 0.5), rgba(3, 9, 18, 0.96))'
      };
  const infoPanelStyle = isCompactModal
    ? {
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '18px',
        background: 'linear-gradient(180deg, rgba(8, 16, 28, 0.97), rgba(4, 10, 18, 0.99))',
        overflow: 'auto',
        paddingBottom: '28px'
      }
    : {
        minWidth: '320px',
        width: 'min(336px, 28vw)',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        padding: '24px',
        background: 'linear-gradient(180deg, rgba(8, 16, 28, 0.97), rgba(4, 10, 18, 0.99))',
        overflow: 'auto',
        paddingBottom: '32px'
      };
  const mediaFrameStyle = {
    position: 'relative',
    minHeight: 0,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    padding: isCompactModal ? '14px' : '24px',
    overflow: 'auto'
  };
  const mediaControlsStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: isCompactModal ? 'wrap' : 'nowrap',
    padding: isCompactModal ? '14px 16px 16px' : '18px 22px 22px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    color: 'var(--muted)',
    fontSize: '0.88rem'
  };
  const infoTopStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px'
  };
  const badgeStackStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  };
  const metaGridStyle = {
    display: 'grid',
    gridTemplateColumns: isCompactModal ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '12px'
  };
  const surfaceCardStyle = {
    padding: '14px 15px',
    borderRadius: '18px',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    background: 'rgba(255, 255, 255, 0.03)'
  };
  const actionsColumnStyle = {
    display: 'grid',
    gap: '10px'
  };
  const navPanelStyle = {
    display: 'grid',
    gap: '10px'
  };
  const postNavStyle = {
    display: 'grid',
    gridTemplateColumns: isCompactModal ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
  };
  const titleStyle = {
    margin: '10px 0 0',
    fontSize: isCompactModal ? '1.5rem' : 'clamp(1.3rem, 2vw, 1.8rem)',
    lineHeight: 1.25,
    letterSpacing: '-0.03em'
  };
  const mediaVisualStyle = {
    display: 'block',
    width: 'auto',
    maxWidth: 'min(100%, 760px)',
    maxHeight: isCompactModal ? '54vh' : 'min(72vh, 820px)',
    borderRadius: isCompactModal ? '16px' : '22px',
    background: '#000',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.34)'
  };
  const activeSourceKind = current?.sourceKind || post?.videoSourceKind || null;
  const isDirectUrlOnly = Boolean(isVideo && !current?.hlsUrl && !current?.dashUrl && current?.url);
  const videoLoadingState = playerDiagnostics?.loadingState || 'idle';
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
        style={modalStyle}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
      >
        <div className="modal-split-media" style={mediaColumnStyle} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="modal-media-frame" style={mediaFrameStyle}>
            {sourceActionHref && (
              <a
                href={sourceActionHref}
                target="_blank"
                rel="noreferrer"
                className="modal-action-button"
                style={{
                  position: 'absolute',
                  left: isCompactModal ? '14px' : '18px',
                  top: isCompactModal ? '14px' : '18px',
                  zIndex: 3,
                  minWidth: 0,
                  padding: '10px 14px',
                  background: 'rgba(6, 14, 26, 0.84)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)'
                }}
              >
                {sourceActionLabel}
              </a>
            )}
            {!current && <div className="modal-helper-copy">This item could not be rendered.</div>}
            {current?.kind === 'video' && (
              <VideoPlayer
                ref={videoPlayerRef}
                mp4Url={current.url}
                hlsUrl={current.hlsUrl}
                dashUrl={current.dashUrl}
                companionAudioUrls={current.audioUrls || post?.videoAudioUrls || []}
                hasAudio={current.hasAudio ?? post?.videoHasAudio ?? null}
                sourceKind={activeSourceKind}
                posterUrl={post?.thumbnail || ''}
                className="modal-video"
                autoPlay
                loop
                allowUnmutedAutoplay={hasUserInteracted}
                preferredMuted={persistMuted}
                onMutedChange={setPersistMuted}
                onDiagnostics={setPlayerDiagnostics}
              />
            )}

            {current?.kind === 'embed' && (
              hasDirectEmbedControls ? (
                <VideoPlayer
                  ref={videoPlayerRef}
                  mp4Url={resolvedEmbedPlayback.previewUrl || resolvedEmbedPlayback.videoUrl}
                  hasAudio={resolvedEmbedPlayback.hasAudio ?? true}
                  sourceKind="redgifs"
                  posterUrl={resolvedEmbedPlayback.posterUrl || current?.posterUrl || post?.thumbnail || ''}
                  className="modal-video"
                  autoPlay
                  loop
                  allowUnmutedAutoplay={hasUserInteracted}
                  preferredMuted={persistMuted}
                  onMutedChange={setPersistMuted}
                  onDiagnostics={setPlayerDiagnostics}
                />
              ) : (
                <div style={{ width: embedWidth, maxWidth: '100%', display: 'grid', gap: '12px', justifyItems: 'center' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: current?.width && current?.height ? `${current.width} / ${current.height}` : '9 / 16',
                      maxHeight: isCompactModal ? '56vh' : '68vh',
                      borderRadius: isCompactModal ? '16px' : '22px',
                      overflow: 'hidden',
                      background: '#000',
                      boxShadow: '0 28px 80px rgba(0, 0, 0, 0.34)'
                    }}
                  >
                    <iframe
                      src={current.url}
                      title={`${post.title} player`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    />
                  </div>
                  {current?.provider === 'RedGIFs' && current?.id ? (
                    <button type="button" onClick={() => setUseDirectEmbedPlayback(true)}>
                      Enable In-App Controls
                    </button>
                  ) : null}
                  {embedPlaybackError ? <p className="modal-helper-copy">{embedPlaybackError}</p> : null}
                </div>
              )
            )}

            {current?.kind === 'image' && <img src={current?.url || ''} alt={post.title} className="modal-image" style={mediaVisualStyle} />}

            {current?.kind === 'audio' && (
              <div className="modal-audio-wrap" style={{ width: 'min(100%, 760px)', display: 'grid', gap: '18px', justifyItems: 'center' }}>
                {current?.posterUrl ? (
                  <img src={current.posterUrl} alt={post.title} className="modal-image" style={{ ...mediaVisualStyle, maxHeight: isCompactModal ? '40vh' : '48vh' }} />
                ) : (
                  <div className="media-preview media-preview-audio-fallback" style={{ width: 'min(100%, 420px)', aspectRatio: '1 / 1', borderRadius: isCompactModal ? '16px' : '22px' }}>
                    <span className="audio-glyph">Audio</span>
                  </div>
                )}
                <audio controls preload="metadata" src={current.url} style={{ width: 'min(100%, 560px)' }}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {nextVideoToPrebuffer?.url && (
              <VideoPlayer mp4Url={nextVideoToPrebuffer.url} hlsUrl={nextVideoToPrebuffer.hlsUrl} dashUrl={nextVideoToPrebuffer.dashUrl} className="modal-video" prebufferOnly />
            )}
          </div>

          <div className="modal-media-controls" style={mediaControlsStyle}>
            {items.length > 1 ? (
              <>
                <button type="button" onClick={handleMovePrev}>Previous item</button>
                <span>{index + 1}/{items.length}</span>
                <button type="button" onClick={handleMoveNext}>Next item</button>
              </>
            ) : (
              <span>{canControlPlayback ? 'Click the video to play or pause.' : current?.kind === 'embed' ? 'Use the embedded player controls inside the video frame, or enable in-app controls for wheel and keyboard playback.' : current?.kind === 'audio' ? 'Listen in the built-in player without leaving the modal.' : 'Scaled to fit for distraction-free viewing.'}</span>
            )}
          </div>
        </div>

        <aside className="modal-info-panel" style={infoPanelStyle}>
          <div className="modal-info-top" style={infoTopStyle}>
            <div>
              <p className="modal-kicker">{post.source === 'instagram' ? `@${post.author}` : post.source === 'library' ? post.creator || 'Coomer' : post.source === 'simpcity' ? post.section || post.subreddit || 'SimpCity' : `r/${post.subreddit}`}</p>
              <h2 style={titleStyle}>{post.title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
              X
            </button>
          </div>

          <div className="modal-badge-stack" style={badgeStackStyle}>
            <span className={`detail-badge detail-badge-${post.type}`} title={typeHelper}>{typeLabel}</span>
            {(post.type === 'video' && post.videoDurationSec) || (post.type === 'audio' && post.duration) ? <span className="detail-badge">{formatDuration(post.type === 'audio' ? post.duration : post.videoDurationSec)}</span> : null}
            {post.source === 'reddit' && post.isRedditHosted ? <span className="detail-badge">Reddit-hosted</span> : null}
          </div>

          <div className="modal-meta-grid" style={metaGridStyle}>
            <div style={surfaceCardStyle}>
              <span className="modal-meta-label">Author</span>
              <strong>{post.source === 'library' ? post.creator || 'Coomer' : post.author}</strong>
            </div>
            <div style={surfaceCardStyle}>
              <span className="modal-meta-label">Score</span>
              <strong>{formatScore(post.score)}</strong>
            </div>
            <div style={surfaceCardStyle}>
              <span className="modal-meta-label">Posted</span>
              <strong>{formatPostDate(post.createdUtc)}</strong>
            </div>
            {canShowComments ? (
              <button type="button" className="modal-stat-button" style={surfaceCardStyle} onClick={handleToggleComments}>
                <span className="modal-meta-label">Comments</span>
                <strong>{formatScore(post.numComments || 0)}</strong>
                <span className="modal-stat-link">{showComments ? 'Hide comments' : 'Read comments'}</span>
              </button>
            ) : (
              <div style={surfaceCardStyle}>
                <span className="modal-meta-label">Comments</span>
                <strong>{formatScore(post.numComments || 0)}</strong>
              </div>
            )}
          </div>

          {showComments && canShowComments && (
            <section className="comments-panel" style={surfaceCardStyle}>
              <div className="comments-panel-head">
                <p className="preview-panel-label">Top Comments</p>
                <button type="button" className="text-button" onClick={handleToggleComments}>Close</button>
              </div>
              {commentsLoading && <p className="modal-helper-copy">Loading comments...</p>}
              {!commentsLoading && commentsError && <p className="modal-helper-copy">{commentsError}</p>}
              {!commentsLoading && !commentsError && comments.length === 0 && <p className="modal-helper-copy">No readable comments returned for this post.</p>}
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
            <section className="preview-panel" style={surfaceCardStyle}>
              <p className="preview-panel-label">{previewInfo.label}</p>
              <p>{previewInfo.copy}</p>
            </section>
          )}



          {post.flair && (
            <div className="modal-note-block" style={surfaceCardStyle}>
              <span className="modal-meta-label">Flair</span>
              <p>{post.flair}</p>
            </div>
          )}



          <section className="modal-note-block shortcuts-panel" style={surfaceCardStyle}>
            <span className="modal-meta-label">Keyboard</span>
            <div className="shortcut-hint-list">
              {keyboardHints.map((hint) => (
                <span key={hint} className="shortcut-hint">{hint}</span>
              ))}
            </div>
          </section>

          <div className="modal-actions-column" style={actionsColumnStyle}>
            <a
              className={`modal-action-button ${needsRedditHandoff ? 'modal-action-primary' : ''}`}
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
            >
              {primaryActionLabel}
            </a>

            {canDownload && (
              <a className="modal-action-button" href={current.url} target="_blank" rel="noreferrer" download>
                Download Direct Media
              </a>
            )}

            <button
              type="button"
              className="modal-action-button"
              onClick={async () => {
                await navigator.clipboard.writeText(post.permalink);
              }}
            >
              Copy Post Link
            </button>

            {canOpenAuthorGallery && (
              <button type="button" className="modal-action-button" onClick={() => onOpenAuthorGallery(post)}>
                Open Author Gallery
              </button>
            )}
          </div>

          <div className="modal-navigation-panel" style={navPanelStyle}>
            {canNavigate && (
              <div className="modal-post-nav" style={postNavStyle}>
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




