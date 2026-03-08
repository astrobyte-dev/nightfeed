import { useEffect, useMemo, useRef, useState } from 'react';
import { canDownloadUrl, getModalItems } from '../utils/media';
import VideoPlayer from './VideoPlayer';

function LightboxModal({
  post,
  onClose,
  onPrevPost,
  onNextPost,
  onOpenAuthorGallery,
  canNavigate,
  enableWheelNavigation,
  nextVideoToPrebuffer
}) {
  const items = useMemo(() => getModalItems(post), [post]);
  const [index, setIndex] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const lastWheelAt = useRef(0);
  const touchStartY = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [post?.id]);

  useEffect(() => {
    setHasUserInteracted(false);
  }, [post?.id]);

  useEffect(() => {
    function updateViewport() {
      setIsMobileViewport(window.innerWidth <= 800);
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
    if (!post) return;

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setHasUserInteracted(true);
        if (canNavigate) {
          onNextPost();
          return;
        }
        if (items.length > 1) setIndex((prev) => (prev + 1) % items.length);
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setHasUserInteracted(true);
        if (canNavigate) {
          onPrevPost();
          return;
        }
        if (items.length > 1) setIndex((prev) => (prev - 1 + items.length) % items.length);
      }
    }

    function unlockAudio() {
      setHasUserInteracted(true);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, [post, items.length, onClose, canNavigate, onNextPost, onPrevPost]);

  if (!post) return null;

  const current = items[index];
  const canDownload = canDownloadUrl(current?.url);
  const canOpenAuthorGallery = post?.source !== 'simpcity';
  const isTikTokMobileMode = isMobileViewport && current?.kind === 'video' && enableWheelNavigation;

  function goNext() {
    setHasUserInteracted(true);
    onNextPost();
  }

  function goPrev() {
    setHasUserInteracted(true);
    onPrevPost();
  }

  function handleWheel(event) {
    if (!enableWheelNavigation) return;
    event.preventDefault();
    event.stopPropagation();
    setHasUserInteracted(true);

    const now = Date.now();
    if (now - lastWheelAt.current < 320) return;
    if (Math.abs(event.deltaY) < 18) return;

    lastWheelAt.current = now;
    if (event.deltaY > 0) goNext();
    else goPrev();
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

    if (deltaY > 0) goNext();
    else goPrev();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${isTikTokMobileMode ? 'tiktok-mobile' : ''}`} onClick={(event) => event.stopPropagation()}>
        {canNavigate && !isTikTokMobileMode && (
          <>
            <button type="button" className="nav-arrow nav-arrow-left" onClick={goPrev} aria-label="Previous media">
              {'<'}
            </button>
            <button type="button" className="nav-arrow nav-arrow-right" onClick={goNext} aria-label="Next media">
              {'>'}
            </button>
          </>
        )}

        <header className="modal-header">
          <h2>{post.title}</h2>
          <div className="modal-header-actions">
            {canOpenAuthorGallery && (
              <button type="button" className="load-more" onClick={() => onOpenAuthorGallery(post)}>
                Open Author Gallery
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
              X
            </button>
          </div>
        </header>

        <div className="modal-media" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {current?.kind === 'video' && (
            <VideoPlayer
              mp4Url={current.url}
              hlsUrl={current.hlsUrl}
              dashUrl={current.dashUrl}
              audioUrlCandidates={current.audioUrls || []}
              hasAudio={current.hasAudio}
              className="modal-video"
              autoPlay
              loop
              allowUnmutedAutoplay={hasUserInteracted}
            />
          )}

          {current?.kind === 'youtube' && (
            <iframe
              className="modal-video youtube-iframe"
              src={current.url}
              title={post.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}

          {current?.kind === 'image' && <img src={current?.url || ''} alt={post.title} className="modal-image" />}

          {nextVideoToPrebuffer?.url && (
            <VideoPlayer mp4Url={nextVideoToPrebuffer.url} hlsUrl={nextVideoToPrebuffer.hlsUrl} className="modal-video" prebufferOnly />
          )}

          {isTikTokMobileMode && canNavigate && (
            <div className="tiktok-nav-stack" aria-hidden>
              <button type="button" className="tiktok-nav-btn" onClick={goPrev} aria-label="Previous video">
                ^
              </button>
              <button type="button" className="tiktok-nav-btn" onClick={goNext} aria-label="Next video">
                v
              </button>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <div className="modal-actions">
            {enableWheelNavigation && (
              <span className="mini-muted">{isTikTokMobileMode ? 'Swipe up/down or arrow keys to switch videos' : 'Scroll or Up/Down keys to switch videos'}</span>
            )}
            {current?.kind === 'video' && current?.hasAudio === false && !current?.hlsUrl && (
              <span className="mini-muted">Attempting Reddit companion audio track for this video.</span>
            )}
            {items.length > 1 && !isTikTokMobileMode && (
              <>
                <button type="button" onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}>
                  Previous item
                </button>
                <span>{index + 1}/{items.length}</span>
                <button type="button" onClick={() => setIndex((prev) => (prev + 1) % items.length)}>
                  Next item
                </button>
              </>
            )}
          </div>

          <div className="modal-links">
            {canOpenAuthorGallery && (
              <button type="button" onClick={() => onOpenAuthorGallery(post)}>
                Author Gallery
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(post.permalink);
              }}
            >
              Copy Post Link
            </button>

            <a href={post.permalink} target="_blank" rel="noreferrer">
              Open Original Post
            </a>

            {canDownload && (
              <a href={current.url} target="_blank" rel="noreferrer" download>
                Download
              </a>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LightboxModal;

