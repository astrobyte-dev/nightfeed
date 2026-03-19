import { Fragment } from 'react';
import GalleryCard from './GalleryCard';
import InlineMediaPanel from './InlineMediaPanel';

function GalleryGrid({ items, activePost, onOpen, onCloseActive, onPrevPost, onNextPost, onOpenAuthorGallery, onAddToQueue, canNavigate }) {
  if (!items.length) {
    return null;
  }

  const activeId = activePost?.id || null;

  return (
    <section className="gallery-grid">
      {items.map((post) => (
        post.id === activeId ? (
          <Fragment key={post.id}>
            <GalleryCard key={post.id} post={{ ...post, isActive: true }} onOpen={onOpen} />
            <InlineMediaPanel
              post={post}
              onClose={onCloseActive}
              onPrevPost={onPrevPost}
              onNextPost={onNextPost}
              onOpenAuthorGallery={onOpenAuthorGallery}
              onAddToQueue={onAddToQueue}
              canNavigate={canNavigate}
            />
          </Fragment>
        ) : (
          <GalleryCard key={post.id} post={post} onOpen={onOpen} />
        )
      ))}
    </section>
  );
}

export default GalleryGrid;