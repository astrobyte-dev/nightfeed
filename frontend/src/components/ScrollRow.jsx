import { useRef, useState, useEffect, useCallback } from 'react';

function ScrollRow({ children, className = '' }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, children]);

  function scroll(direction) {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  return (
    <div className={`scroll-row-wrap ${className}`}>
      {canScrollLeft ? (
        <button type="button" className="scroll-arrow scroll-arrow-left" onClick={() => scroll('left')} aria-label="Scroll left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <div className="scroll-arrow-placeholder scroll-arrow-placeholder-left" />
      )}
      <div className="scroll-row-inner" ref={scrollRef}>
        {children}
      </div>
      {canScrollRight ? (
        <button type="button" className="scroll-arrow scroll-arrow-right" onClick={() => scroll('right')} aria-label="Scroll right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ) : (
        <div className="scroll-arrow-placeholder scroll-arrow-placeholder-right" />
      )}
    </div>
  );
}

export default ScrollRow;
