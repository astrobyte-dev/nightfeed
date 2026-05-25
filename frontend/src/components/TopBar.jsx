import SearchBar from './SearchBar';
import SourceToggle from './SourceToggle';

const REDDIT_SORTS = [
  { value: 'hot', label: 'Hot' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' }
];

const EPORNER_SORTS = [
  { value: 'most-popular', label: 'Popular' },
  { value: 'top-rated', label: 'Top rated' },
  { value: 'top-weekly', label: 'Top week' },
  { value: 'top-monthly', label: 'Top month' },
  { value: 'latest', label: 'Latest' },
  { value: 'longest', label: 'Longest' },
  { value: 'shortest', label: 'Shortest' }
];

const YOUTUBE_SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Newest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'viewCount', label: 'Most viewed' }
];

const COOMER_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'By creator' }
];

const BLUESKY_SORTS = [
  { value: 'top', label: 'Top' },
  { value: 'latest', label: 'Latest' }
];

function ThemeIcon({ theme }) {
  if (theme === 'light') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    );
  }
  if (theme === 'system') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="14" rx="2"/>
        <path d="M8 22h8M12 18v4"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
    </svg>
  );
}

function nextTheme(current) {
  if (current === 'dark') return 'light';
  if (current === 'light') return 'system';
  return 'dark';
}

function TopBar({
  sort,
  onSearch,
  onSortChange,
  onDrawerOpen,
  theme,
  onThemeChange,
  initialQuery,
  recentSearches,
  savedSearches,
  hiddenSubreddits,
  savedSubreddits,
  onPickCategory,
  onApplySearch,
  onToggleSaveSubreddit,
  isSubredditSaved,
  source,
  onSourceChange,
  epornerOrder,
  onEpornerOrderChange,
  booruSite,
  onBooruSiteChange,
  youtubeOrder,
  onYoutubeOrderChange,
  coomerSort,
  onCoomerSortChange,
  blueskySort,
  onBlueskySortChange,
  onOpenAdvanced,
  advancedFilterCount = 0
}) {
  const isEporner = source === 'eporner';
  const isBooru = source === 'booru';
  const isYoutube = source === 'youtube';
  const isCoomer = source === 'coomer';
  const isBluesky = source === 'bluesky';
  const isXvideos = source === 'xvideos';
  const isCustomSearch = isEporner || isBooru || isYoutube || isCoomer || isBluesky || isXvideos;

  let sortOptions = REDDIT_SORTS;
  let sortValue = sort;
  let sortHandler = onSortChange;
  if (isEporner) { sortOptions = EPORNER_SORTS; sortValue = epornerOrder; sortHandler = onEpornerOrderChange; }
  else if (isYoutube) { sortOptions = YOUTUBE_SORTS; sortValue = youtubeOrder; sortHandler = onYoutubeOrderChange; }
  else if (isCoomer) { sortOptions = COOMER_SORTS; sortValue = coomerSort; sortHandler = onCoomerSortChange; }
  else if (isBluesky) { sortOptions = BLUESKY_SORTS; sortValue = blueskySort; sortHandler = onBlueskySortChange; }
  else if (isBooru || isXvideos) { sortOptions = null; }

  const placeholder = isEporner ? 'Search Eporner — keywords, stars, tags…'
    : isBooru ? `Search ${booruSite} — feet, soles, blonde…`
    : isYoutube ? 'Search YouTube — asmr, asmr feet, etc.'
    : isCoomer ? 'Search Coomer — creators, tags, content…'
    : isBluesky ? 'Search Bluesky — feet, asmr, hashtags…'
    : isXvideos ? 'Search xVideos — keywords…'
    : '';
  function cycleTheme() {
    if (!onThemeChange) return;
    onThemeChange(nextTheme(theme));
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-hamburger" onClick={onDrawerOpen} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="topbar-logo">Nightfeed</span>
      </div>

      {isCustomSearch ? (
        <PlainSearch initialQuery={initialQuery} onSubmit={onSearch} placeholder={placeholder} />
      ) : (
        <SearchBar
          initialQuery={initialQuery}
          recentSearches={recentSearches}
          savedSearches={savedSearches}
          hiddenSubreddits={hiddenSubreddits}
          savedSubreddits={savedSubreddits}
          onSubmitSubreddit={onSearch}
          onPickCategory={onPickCategory}
          onApplySearch={onApplySearch}
          onToggleSaveSubreddit={onToggleSaveSubreddit}
          isSubredditSaved={isSubredditSaved}
        />
      )}

      <div className="topbar-right">
        {onSourceChange && (
          <SourceToggle
            value={source}
            onChange={onSourceChange}
            booruSite={booruSite}
            onBooruSiteChange={onBooruSiteChange}
          />
        )}
        {onOpenAdvanced && (
          <button
            type="button"
            className={`topbar-icon-btn topbar-filter-btn ${advancedFilterCount > 0 ? 'has-active' : ''}`}
            onClick={onOpenAdvanced}
            aria-label="Advanced search"
            title={advancedFilterCount > 0 ? `Advanced search · ${advancedFilterCount} active` : 'Advanced search'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {advancedFilterCount > 0 && <span className="topbar-filter-badge">{advancedFilterCount}</span>}
          </button>
        )}
        {sortOptions && (
          <select className="topbar-sort-select" value={sortValue} onChange={(e) => sortHandler(e.target.value)} aria-label="Sort posts">
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {onThemeChange && (
          <button type="button" className="topbar-icon-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change.`} title={`Theme: ${theme}`}>
            <ThemeIcon theme={theme} />
          </button>
        )}
      </div>
    </header>
  );
}

function PlainSearch({ initialQuery, onSubmit, placeholder }) {
  return (
    <form
      className="searchbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = String(e.currentTarget.elements.q.value || '').trim();
        onSubmit?.(v);
      }}
    >
      <div className="searchbar-input-wrap">
        <svg className="searchbar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          name="q"
          type="search"
          className="searchbar-input"
          defaultValue={initialQuery || ''}
          placeholder={placeholder || 'Search…'}
          aria-label={placeholder || 'Search'}
          key={initialQuery || ''}
        />
      </div>
    </form>
  );
}

export default TopBar;
