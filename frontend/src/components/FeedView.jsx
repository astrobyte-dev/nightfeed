import { useCallback, useEffect, useRef, useState } from 'react';
import FeedCard from './FeedCard';

function FeedView({ items, onLoadMore, hasMore, loadingMore, onOpenAuthorGallery, onOpenLightbox, onExit }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const containerRef = useRef(null);
  const cardRefs = useRef([]);

  // IntersectionObserver: update activeIndex as cards scroll into view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            setActiveIndex(idx);
            activeIndexRef.current = idx;
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [items.length]);

  // Load more when near end
  useEffect(() => {
    if (activeIndex >= items.length - 3 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [activeIndex, items.length, hasMore, loadingMore, onLoadMore]);

  const scrollTo = useCallback((idx) => {
    const el = cardRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function handlePrev() {
    if (activeIndexRef.current > 0) scrollTo(activeIndexRef.current - 1);
  }

  function handleNext() {
    if (activeIndexRef.current < items.length - 1) scrollTo(activeIndexRef.current + 1);
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (items.length === 0) {
    return <div className="feed-view-empty">No media to show in feed mode.</div>;
  }

  return (
    <div className="feed-view" ref={containerRef}>
      <button type="button" className="feed-exit-btn" onClick={onExit}>✕ Grid</button>
      {items.map((post, idx) => (
        <div
          key={post.id}
          className="feed-slide"
          data-index={idx}
          ref={(el) => { cardRefs.current[idx] = el; }}
        >
          <FeedCard
            post={post}
            isActive={idx === activeIndex}
            onOpenLightbox={onOpenLightbox}
            onOpenAuthorGallery={onOpenAuthorGallery}
          />
        </div>
      ))}

      {loadingMore && (
        <div className="feed-slide feed-loading-slide">
          <div className="state-box subtle">Loading more media...</div>
        </div>
      )}

      <div className="feed-nav-controls">
        <button
          type="button"
          className="feed-nav-btn"
          onClick={handlePrev}
          disabled={activeIndex === 0}
          title="Previous"
        >
          ↑
        </button>
        <span className="feed-nav-counter">{activeIndex + 1} / {items.length}</span>
        <button
          type="button"
          className="feed-nav-btn"
          onClick={handleNext}
          disabled={activeIndex === items.length - 1 && !hasMore}
          title="Next"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

export default FeedView;
