import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { getModalItems, getTypeBadge, getTypeHelper, isPreviewVideo } from '../utils/media';
import VideoPlayer from './VideoPlayer';

function InlineMediaPanel({
  post,
  onClose,
  onPrevPost,
  onNextPost,
  onOpenAuthorGallery,
  onAddToQueue,
  canNavigate
}) {
  const [index, setIndex] = useState(0);
  const panelRef = useRef(null);
  const items = useMemo(() => getModalItems(post), [post]);
  const current = items[index] || null;
  const duration = (post?.type === 'video' ? post?.videoDurationSec : post?.duration)
    ? formatDuration(post?.type === 'video' ? post.videoDurationSec : post.duration)
    : null;
  const detailChips = [
    post?.flair,
    post?.category,
    post?.sourceHost,
    post?.service,
    ...(Array.isArray(post?.tags) ? post.tags.slice(0, 4).map((tag) => `#${tag}`) : [])
  ].filter(Boolean);

  useEffect(() => {
    setIndex(0);
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [post?.id]);

  if (!post || !current) return null;

  function renderMedia() {
    if (current.kind === 'video') {
      return (
        <VideoPlayer
          mp4Url={current.url || null}
          hlsUrl={current.hlsUrl || null}
          dashUrl={current.dashUrl || null}
          companionAudioUrls={current.audioUrls || []}
          hasAudio={current.hasAudio}
          sourceKind={current.sourceKind || null}
          posterUrl={post.thumbnail || ''}
          className="inline-panel-visual inline-panel-video"
          autoPlay
          loop
          allowUnmutedAutoplay
          preferredMuted={false}
        />
      );
    }

    if (current.kind === 'embed') {
      return (
        <iframe
          className="inline-panel-visual inline-panel-embed"
          src={current.url}
          title={post.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (current.kind === 'audio') {
      return (
        <div className="inline-audio-shell">
          {current.posterUrl ? <img className="inline-panel-visual inline-panel-image" src={current.posterUrl} alt={post.title} /> : null}
          <audio className="inline-audio-player" controls preload="metadata" src={current.url} />
        </div>
      );
    }

    return <img className="inline-panel-visual inline-panel-image" src={current.url} alt={post.title} loading="eager" />;
  }

  return (
    <section ref={panelRef} className="inline-media-panel">
      <div className="inline-media-stage">
        <div className="inline-media-frame">{renderMedia()}</div>
        {(items.length > 1 || canNavigate) && (
          <div className="inline-media-toolbar">
            {items.length > 1 ? (
              <>
                <button type="button" className="ghost-button" onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}>
                  Previous item
                </button>
                <span className="inline-toolbar-copy">{index + 1} / {items.length}</span>
                <button type="button" className="ghost-button" onClick={() => setIndex((prev) => (prev + 1) % items.length)}>
                  Next item
                </button>
              </>
            ) : null}
            {canNavigate ? (
              <div className="inline-toolbar-nav-group">
                <button type="button" className="ghost-button" onClick={onPrevPost}>Previous post</button>
                <button type="button" className="ghost-button" onClick={onNextPost}>Next post</button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <aside className="inline-media-sidebar">
        <div className="inline-sidebar-top">
          <div>
            <p className="modal-kicker">{post.source === 'reddit' ? `r/${post.subreddit || 'reddit'}` : post.source === 'simpcity' ? (post.section || 'SimpCity') : post.source === 'library' ? (post.service || 'Coomer') : '@' + (post.author || 'instagram')}</p>
            <h3>{post.title}</h3>
            <p className="meta-line">{getTypeBadge(post)}{duration ? ` - ${duration}` : ''}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close expanded viewer">
            x
          </button>
        </div>

        <div className="active-filter-grid inline-meta-grid">
          <div className="active-filter-pill">
            <span className="active-filter-label">Creator</span>
            <strong>{post.creator || post.author || 'Unknown'}</strong>
          </div>
          <div className="active-filter-pill">
            <span className="active-filter-label">Date</span>
            <strong>{formatPostDate(post.createdUtc)}</strong>
          </div>
          {post.source === 'reddit' ? (
            <>
              <div className="active-filter-pill">
                <span className="active-filter-label">Score</span>
                <strong>{formatScore(post.score)}</strong>
              </div>
              <div className="active-filter-pill">
                <span className="active-filter-label">Comments</span>
                <strong>{formatScore(post.numComments || 0)}</strong>
              </div>
            </>
          ) : (
            <div className="active-filter-pill">
              <span className="active-filter-label">Activity</span>
              <strong>{formatScore(post.numComments || 0)} {post.source === 'simpcity' ? 'replies' : 'items'}</strong>
            </div>
          )}
        </div>

        <p className="inline-helper-copy">{getTypeHelper(post)}</p>

        {detailChips.length > 0 ? (
          <div className="meta-chip-row">
            {detailChips.map((chip) => (
              <span key={chip} className="meta-chip">{chip}</span>
            ))}
          </div>
        ) : null}

        <div className="inline-action-stack">
          {post.permalink ? (
            <a className="modal-action-button modal-action-primary" href={post.permalink} target="_blank" rel="noreferrer">
              {post.source === 'simpcity' ? 'Open thread' : post.source === 'library' ? 'Open source post' : 'Open original post'}
            </a>
          ) : null}
          {onOpenAuthorGallery ? (
            <button type="button" className="modal-action-button modal-action-subtle" onClick={() => onOpenAuthorGallery(post)}>
              Open creator feed
            </button>
          ) : null}
          {onAddToQueue && (post.videoUrl || post.mediaUrl) ? (
            <button type="button" className="modal-action-button modal-action-subtle" onClick={() => onAddToQueue(post)}>
              + Save URL
            </button>
          ) : null}
        </div>

        {post.threadTitle && post.threadTitle !== post.title ? <p className="meta-line meta-line-secondary">Thread: {post.threadTitle}</p> : null}
        {isPreviewVideo(post) ? <p className="meta-line meta-line-secondary">This is using a preview-friendly stream for fast inline playback.</p> : null}
      </aside>
    </section>
  );
}

export default InlineMediaPanel;