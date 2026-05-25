function SkeletonGrid({ count = 12 }) {
  return (
    <div className="media-grid-beeg" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="beeg-card skeleton-card" key={i}>
          <div className="beeg-card-thumb skeleton-shimmer" />
          <div className="beeg-card-meta">
            <div className="skeleton-line skeleton-line-author" />
            <div className="skeleton-line skeleton-line-title" />
            <div className="skeleton-line skeleton-line-stats" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonGrid;
