import { formatDuration, formatScore } from '../utils/format';
import { getCardPreview } from '../utils/media';
import { useHoverPreview } from '../hooks/useHoverPreviewBus';
import CardMenu from './CardMenu';

const AVATAR_COLORS = ['#ef4444','#ec4899','#a855f7','#8b5cf6','#6366f1','#3b82f6','#06b6d4','#14b8a6','#10b981','#84cc16','#eab308','#f59e0b','#f97316'];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatRelativeTime(createdUtc) {
  if (!createdUtc) return '';
  const seconds = Math.floor(Date.now() / 1000 - createdUtc);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
  return `${Math.floor(seconds / 31536000)}y`;
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2"/>
      <path d="M21 7v12a2 2 0 0 1-2 2H7"/>
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10v4M7 6v12M11 9v6M15 4v16M19 9v6"/>
    </svg>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
    </svg>
  );
}

function altTextFor(post) {
  const kind = post.type === 'video' ? 'Video' : post.type === 'gallery' ? 'Gallery' : post.type === 'audio' ? 'Audio' : 'Image';
  const ctx = post.subreddit ? ` from r/${post.subreddit}` : post.author ? ` by ${post.author}` : '';
  return `${kind}${ctx}: ${post.title || 'untitled'}`;
}

function BeegCard({ post, onOpen, isFavorited, onToggleFavorite, onHideAuthor, onHideSubreddit, onCopyLink, onOpenInNewTab }) {
  const hover = useHoverPreview();
  const preview = getCardPreview(post);
  const duration = post.type === 'video' ? formatDuration(post.videoDurationSec) : null;
  const galleryCount = post.type === 'gallery' ? (post.galleryItems?.length || 0) : 0;
  const canHoverPreview = post.type === 'video' && Boolean(post.previewUrl || post.videoUrl || post.mediaUrl);
  const hoverVideoUrl = post.previewUrl || post.videoUrl || post.mediaUrl;
  const author = post.author || 'unknown';
  const colorIndex = hashCode(author) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];
  const initial = author[0]?.toUpperCase() || '?';

  function handleKey(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(post);
    }
  }

  function handleFavoriteClick(event) {
    event.stopPropagation();
    onToggleFavorite?.(post);
  }

  let typeBadge = null;
  if (post.type === 'video' && duration) {
    typeBadge = <><VideoIcon />{duration}</>;
  } else if (post.type === 'gallery' && galleryCount > 1) {
    typeBadge = <><GalleryIcon />{galleryCount}</>;
  } else if (post.type === 'audio') {
    typeBadge = <><AudioIcon />Audio</>;
  }

  return (
    <article
      className="beeg-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(post)}
      onKeyDown={handleKey}
      onMouseEnter={hover.activate}
      onMouseLeave={hover.deactivate}
      onFocus={hover.activate}
      onBlur={hover.deactivate}
      aria-label={`Open ${altTextFor(post)}`}
    >
      <div className="beeg-card-thumb">
        {canHoverPreview && hover.isActive ? (
          <video
            className="beeg-card-media"
            src={hoverVideoUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
          />
        ) : preview ? (
          <img className="beeg-card-media" src={preview} alt={altTextFor(post)} loading="lazy" decoding="async" />
        ) : (
          <div className="beeg-card-media beeg-card-no-preview" aria-label="No preview">
            No preview
          </div>
        )}

        {typeBadge && <span className="beeg-card-type">{typeBadge}</span>}

        {onToggleFavorite && (
          <button
            type="button"
            className={`beeg-card-fav ${isFavorited ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            aria-pressed={isFavorited ? 'true' : 'false'}
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            title={isFavorited ? 'Saved' : 'Save'}
          >
            <HeartIcon filled={isFavorited} />
          </button>
        )}

        <div className="beeg-card-more">
          <CardMenu
            items={[
              onOpenInNewTab && {
                label: 'Open in new tab',
                onSelect: () => onOpenInNewTab(post),
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              },
              onCopyLink && {
                label: 'Copy link',
                onSelect: () => onCopyLink(post),
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              },
              onToggleFavorite && {
                label: isFavorited ? 'Remove from favorites' : 'Save to favorites',
                onSelect: () => onToggleFavorite(post),
                icon: <HeartIcon filled={isFavorited} />
              },
              onHideAuthor && post.author && post.author !== '[deleted]' && {
                label: `Hide u/${post.author}`,
                onSelect: () => onHideAuthor(post.author),
                danger: true,
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              },
              onHideSubreddit && post.subreddit && {
                label: `Hide r/${post.subreddit}`,
                onSelect: () => onHideSubreddit(post.subreddit),
                danger: true,
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              }
            ]}
          />
        </div>
      </div>

      <div className="beeg-card-meta">
        <h3 className="beeg-card-title" title={post.title}>{post.title}</h3>
        <div className="beeg-card-author">
          <span className="beeg-card-avatar" style={{ backgroundColor: avatarColor }} aria-hidden="true">{initial}</span>
          <span className="beeg-card-author-name">{author}</span>
        </div>
        <div className="beeg-card-stats">
          <span>{formatScore(post.score)}</span>
          <span>·</span>
          <span>{formatRelativeTime(post.createdUtc)}</span>
          <span>·</span>
          <span>{formatScore(post.numComments || 0)} comments</span>
        </div>
      </div>
    </article>
  );
}

export default BeegCard;
