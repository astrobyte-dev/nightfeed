import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { getCardPreview, getTypeBadge } from '../utils/media';

function GalleryCard({ post, onOpen }) {
  const preview = getCardPreview(post);
  const isInstagram = post.source === 'instagram';
  const isYouTube = post.source === 'youtube';
  const duration = post.type === 'video' ? formatDuration(post.videoDurationSec) : null;

  return (
    <article className="media-card" onClick={() => onOpen(post)}>
      <div className="media-preview-wrap">
        {preview ? (
          <img className="media-preview" src={preview} alt={post.title} loading="lazy" />
        ) : (
          <div className="media-preview media-preview-fallback">No preview</div>
        )}

        {post.type === 'video' && <span className="video-play-icon">Play</span>}
        {duration && <span className="video-duration-badge">{duration}</span>}
        <span className={`media-badge media-badge-${post.type}`}>{getTypeBadge(post.type)}</span>
      </div>

      <div className="media-card-body">
        <h3 title={post.title}>{post.title}</h3>
        <p className="meta-line">
          {isInstagram ? `@${post.author}` : isYouTube ? `YouTube - ${post.author}` : `r/${post.subreddit} - u/${post.author}`}
        </p>
        <p className="meta-line">
          {isInstagram ? formatPostDate(post.createdUtc) : `${formatScore(post.score)} ${isYouTube ? 'views' : 'upvotes'} - ${formatPostDate(post.createdUtc)}`}
          {duration ? ` - ${duration}` : ''}
        </p>
      </div>
    </article>
  );
}

export default GalleryCard;
