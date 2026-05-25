import { useEffect, useMemo, useRef, useState } from 'react';
import BeegCard from './BeegCard';

const VIRTUALIZE_THRESHOLD = 120;
const ROW_BUFFER = 4;

function MediaGrid({ items, onOpen, isFavorited, onToggleFavorite, onHideAuthor, onHideSubreddit, onCopyLink, onOpenInNewTab }) {
  if (items.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <div className="media-grid-beeg">
        {items.map((post) => (
          <BeegCard
            key={post.id}
            post={post}
            onOpen={onOpen}
            isFavorited={isFavorited?.(post.id)}
            onToggleFavorite={onToggleFavorite}
            onHideAuthor={onHideAuthor}
            onHideSubreddit={onHideSubreddit}
            onCopyLink={onCopyLink}
            onOpenInNewTab={onOpenInNewTab}
          />
        ))}
      </div>
    );
  }
  return (
    <VirtualizedMediaGrid
      items={items}
      onOpen={onOpen}
      isFavorited={isFavorited}
      onToggleFavorite={onToggleFavorite}
      onHideAuthor={onHideAuthor}
      onHideSubreddit={onHideSubreddit}
      onCopyLink={onCopyLink}
      onOpenInNewTab={onOpenInNewTab}
    />
  );
}

function VirtualizedMediaGrid({ items, onOpen, isFavorited, onToggleFavorite, onHideAuthor, onHideSubreddit, onCopyLink, onOpenInNewTab }) {
  const containerRef = useRef(null);
  const [columns, setColumns] = useState(4);
  const [rowHeight, setRowHeight] = useState(360);
  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [containerTop, setContainerTop] = useState(0);

  useEffect(() => {
    function measure() {
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setContainerTop(rect.top + window.scrollY);
      const styles = window.getComputedStyle(node);
      const gridCols = styles.getPropertyValue('grid-template-columns').split(' ').filter(Boolean).length;
      if (gridCols > 0) setColumns(gridCols);
      const probe = node.querySelector('.beeg-card');
      if (probe) {
        const probeRect = probe.getBoundingClientRect();
        const gap = parseFloat(styles.gap || styles.rowGap || '20') || 20;
        setRowHeight(probeRect.height + gap);
      }
      setViewportH(window.innerHeight);
    }
    measure();
    function onScroll() { setScrollY(window.scrollY); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [items.length]);

  const totalRows = Math.ceil(items.length / Math.max(columns, 1));

  const { startRow, endRow } = useMemo(() => {
    const relativeScroll = Math.max(0, scrollY - containerTop);
    const start = Math.max(0, Math.floor(relativeScroll / rowHeight) - ROW_BUFFER);
    const visibleRows = Math.ceil(viewportH / rowHeight) + ROW_BUFFER * 2;
    const end = Math.min(totalRows, start + visibleRows);
    return { startRow: start, endRow: end };
  }, [scrollY, containerTop, rowHeight, viewportH, totalRows]);

  const visibleItems = items.slice(startRow * columns, endRow * columns);
  const topPad = startRow * rowHeight;
  const bottomPad = Math.max(0, (totalRows - endRow) * rowHeight);

  return (
    <div className="media-grid-virtual-wrap">
      <div style={{ height: topPad }} aria-hidden="true" />
      <div className="media-grid-beeg" ref={containerRef}>
        {visibleItems.map((post) => (
          <BeegCard
            key={post.id}
            post={post}
            onOpen={onOpen}
            isFavorited={isFavorited?.(post.id)}
            onToggleFavorite={onToggleFavorite}
            onHideAuthor={onHideAuthor}
            onHideSubreddit={onHideSubreddit}
            onCopyLink={onCopyLink}
            onOpenInNewTab={onOpenInNewTab}
          />
        ))}
      </div>
      <div style={{ height: bottomPad }} aria-hidden="true" />
    </div>
  );
}

export default MediaGrid;
