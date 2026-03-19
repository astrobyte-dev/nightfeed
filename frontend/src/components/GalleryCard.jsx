import { useState } from 'react';
import { formatDuration, formatPostDate, formatScore } from '../utils/format';
import { getCardPreview, getTypeBadge, getTypeHelper } from '../utils/media';

function GalleryCard({ post, onOpen }) {
  const [isHovering, setIsHovering] = useState(false);
  const preview = getCardPreview(post);
  const isInstagram = post.source === 'instagram';
  const isReddit = post.source === 'reddit';
  const isSimpcity = post.source === 'simpcity';
  const isLibrary = post.source === 'library';
  const duration = (post.type === 'video' ? post.videoDurationSec : post.duration) ? formatDuration(post.type === 'video' ? post.videoDurationSec : post.duration) : null;
  const flair = isReddit && post.flair ? post.flair : null;
  const host = post.sourceHost && (!isReddit || !post.isRedditHosted) ? post.sourceHost : null;
  const typeLabel = getTypeBadge(post);
  const helper = getTypeHelper(post);
  const canHoverPreview = post.type === 'video' && Boolean(post.previewUrl || post.videoUrl || post.mediaUrl);
  const hoverVideoUrl = post.previewUrl || post.videoUrl || post.mediaUrl;

  return (
    <article
      className={`media-card media-card-${post.type} ${post.isActive ? 'media-card-active' : ''}`}
      onClick={() => onOpen(post)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={`media-preview-wrap media-preview-wrap-${post.type}`}>
        {canHoverPreview && isHovering ? (
          <video
            className="media-preview media-preview-video"
            src={hoverVideoUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : post.type === 'video' && hoverVideoUrl ? (
          <video
            className="media-preview media-preview-video"
            src={hoverVideoUrl}
            muted
            playsInline
            preload="metadata"
          />
        ) : preview ? (
          <img className="media-preview" src={preview} alt={post.title} loading="lazy" />
        ) : post.type === 'audio' ? (
          <div className="media-preview media-preview-audio-fallback">
            <span className="audio-glyph">Audio</span>
          </div>
        ) : (
          <div className="media-preview media-preview-fallback">No preview</div>
        )}
      </div>

      <div className="media-card-body">
        <div className="media-card-topline">
          <span className={`media-chip media-chip-${post.type}`} title={helper}>{typeLabel}</span>
          {duration && <span className="media-chip media-chip-duration">{duration}</span>}
        </div>

        <h3 title={post.title}>{post.title}</h3>

        {isInstagram && <p className="meta-line">@{post.author}</p>}
        {isReddit && <p className="meta-line">r/{post.subreddit} - u/{post.author}</p>}
        {isSimpcity && <p className="meta-line">{post.section || post.subreddit || 'SimpCity'} - {post.author || 'simpcity'}</p>}
        {isLibrary && <p className="meta-line">{post.creator} - {post.category || 'Coomer'}</p>}

        {(isReddit || isSimpcity || isLibrary) && (flair || host || post.isRedditHosted || post.category || (isLibrary && post.tags?.length)) && (
          <div className="meta-chip-row">
            {flair && <span className="meta-chip meta-chip-flair">{flair}</span>}
            {post.category && (isSimpcity || isLibrary) && <span className="meta-chip">{post.category}</span>}
            {host && <span className="meta-chip">{host}</span>}
            {post.isRedditHosted && <span className="meta-chip meta-chip-hosted">Reddit-hosted</span>}
            {isLibrary && post.tags?.slice(0, 2).map((tag) => <span key={tag} className="meta-chip">#{tag}</span>)}
          </div>
        )}

        {isInstagram && <p className="meta-line">{formatPostDate(post.createdUtc)}</p>}
        {isReddit && <p className="meta-line">{formatScore(post.score)} upvotes - {formatPostDate(post.createdUtc)}</p>}
        {isSimpcity && <p className="meta-line">{formatPostDate(post.createdUtc)}{post.threadTitle ? ` - ${post.threadTitle}` : ''}</p>}
        {isLibrary && <p className="meta-line">{formatPostDate(post.createdUtc)} - {post.service || post.category || 'coomer.st'}</p>}

        {isReddit && <p className="meta-line meta-line-secondary">{formatScore(post.numComments || 0)} comments</p>}
        {isSimpcity && (
          <p className="meta-line meta-line-secondary">
            {formatScore(post.numComments || 0)} replies{post.threadId ? ` - thread #${post.threadId}` : ''}
          </p>
        )}
        {isLibrary && <p className="meta-line meta-line-secondary">{post.type === 'audio' ? 'Audio playback ready' : post.type === 'video' ? 'Hover to preview' : post.type === 'gallery' ? `${post.galleryItems?.length || 0} images` : 'Static image preview'}</p>}
      </div>
    </article>
  );
}

export default GalleryCard;

