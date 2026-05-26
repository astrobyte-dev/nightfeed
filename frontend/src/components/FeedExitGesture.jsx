import { useEffect } from 'react';

const EDGE_SWIPE_START_THRESHOLD_PX = 25;
const EDGE_SWIPE_DISTANCE_THRESHOLD_PX = 60;
const EDGE_SWIPE_VERTICAL_TOLERANCE_PX = 40;

function FeedExitGesture({ onExit, children }) {
  useEffect(() => {
    let touchStart = null;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.history.back();
      }
    }

    function handlePopState() {
      const urlMode = new URLSearchParams(window.location.search).get('mode');
      if (urlMode !== 'feed') {
        onExit();
      }
    }

    function handleTouchStart(e) {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX <= EDGE_SWIPE_START_THRESHOLD_PX) {
        touchStart = { x: t.clientX, y: t.clientY };
      } else {
        touchStart = null;
      }
    }

    function handleTouchMove(e) {
      if (!touchStart) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - touchStart.x;
      const dy = Math.abs(t.clientY - touchStart.y);
      if (
        dx > EDGE_SWIPE_DISTANCE_THRESHOLD_PX &&
        dy < EDGE_SWIPE_VERTICAL_TOLERANCE_PX
      ) {
        touchStart = null;
        window.history.back();
      }
    }

    function handleTouchEnd() {
      touchStart = null;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onExit]);

  return <>{children}</>;
}

export default FeedExitGesture;
