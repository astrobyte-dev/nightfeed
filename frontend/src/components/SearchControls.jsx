import { useState } from 'react';

const REDDIT_SORTS = ['hot', 'new', 'top'];
const MEDIA_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' }
];
const REDDIT_TIME_RANGES = ['hour', 'day', 'week', 'month', 'year', 'all'];
const REDDIT_SEARCH_SCOPES = [
  { value: 'title', label: 'Title only' },
  { value: 'title_flair', label: 'Title + flair' },
  { value: 'post', label: 'Full post' }
];
const MIN_SCORE_OPTIONS = [0, 25, 100, 250, 500, 1000, 2500];

function SearchControls({
  source,
  inputValue,
  sort,
  mediaFilter,
  simpcityView,
  includeNsfw,
  order,
  redditFilters,
  redditAvailableFlairs,
  collapsed = false,
  onSourceChange,
  onInputChange,
  onSubmit,
  onSortChange,
  onMediaFilterChange,
  onSimpcityViewChange,
  onNsfwToggle,
  onOrderChange,
  onRedditFilterChange,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isReddit = source === 'reddit';
  const isInstagram = source === 'instagram';
  const isSimpcity = source === 'simpcity';
  const isLibrary = source === 'library';
  const showGalleryTypeFilters = !isSimpcity || simpcityView === 'media';
  const sourceGuide = isReddit
    ? {
        title: 'Subreddit-first discovery',
        copy: 'Type one subreddit or combine several with +, then use the explorer rails to narrow the feed.'
      }
    : isInstagram
      ? {
          title: 'Profile-first browsing',
          copy: 'Enter a username and scan the profile feed directly.'
        }
      : isSimpcity
        ? {
            title: 'Indexed thread explorer',
            copy: 'Search the index globally, then refine by section, creator, host, or tag in the side rails.'
          }
        : {
            title: 'Keyword-first creator search',
            copy: 'Start with a keyword, then collapse the result set by creator, service, and media type.'
          };

  return (
    <section className={`controls-card ${collapsed ? 'controls-card-collapsed' : ''}`}>
      <div className="controls-topline">
        <div className="source-toggle segmented segmented-soft">
          <button type="button" className={isReddit ? 'active' : ''} onClick={() => onSourceChange('reddit')}>
            Reddit
          </button>
          <button type="button" className={isInstagram ? 'active' : ''} onClick={() => onSourceChange('instagram')}>
            Instagram
          </button>
          <button type="button" className={isSimpcity ? 'active' : ''} onClick={() => onSourceChange('simpcity')}>
            SimpCity
          </button>
          <button type="button" className={isLibrary ? 'active' : ''} onClick={() => onSourceChange('library')}>
            Coomer
          </button>
        </div>

        {!collapsed && (
          <div className="controls-topline-copy">
            <span className="eyebrow">Discovery</span>
            <span className="mini-muted">Browse media-first feeds with a cleaner search flow.</span>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className={`command-bar ${isInstagram ? 'command-bar-instagram' : ''} ${collapsed ? 'command-bar-collapsed' : ''}`}>
        <label htmlFor="search-input" className="sr-only">
          Search
        </label>
        <input
          id="search-input"
          className="command-input"
          type="text"
          value={inputValue}
          placeholder={
            isReddit
              ? 'Enter subreddit or multireddit (e.g. pics+wallpapers)'
              : isInstagram
                ? 'Enter Instagram username'
                : isSimpcity
                  ? 'Search SimpCity creators, aliases, or thread titles'
                  : 'Search Coomer creators or keywords'
          }
          onChange={(event) => onInputChange(event.target.value)}
        />

        {!collapsed && (isReddit || isLibrary) && (
          <select className="command-select" value={sort} onChange={(event) => onSortChange(event.target.value)}>
            {(isReddit ? REDDIT_SORTS.map((mode) => ({ value: mode, label: mode })) : MEDIA_SORTS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        <button type="submit" className="primary-button">Search</button>
      </form>

      {!collapsed && (
        <div className="command-context-row">
          <span className="eyebrow eyebrow-muted">{sourceGuide.title}</span>
          <span className="command-context-copy">{sourceGuide.copy}</span>
        </div>
      )}

      {!collapsed && (
        <div className="controls-subrow">
          <div className="filter-left-cluster">
            <div className="history-nav" aria-label="Feed history">
              <button type="button" onClick={onGoBack} disabled={!canGoBack} aria-label="Previous feed state">
                {'<'}
              </button>
              <button type="button" onClick={onGoForward} disabled={!canGoForward} aria-label="Next feed state">
                {'>'}
              </button>
            </div>

            {isSimpcity && (
              <div className="segmented segmented-soft">
                <button type="button" className={simpcityView === 'media' ? 'active' : ''} onClick={() => onSimpcityViewChange('media')}>
                  Media
                </button>
                <button type="button" className={simpcityView === 'threads' ? 'active' : ''} onClick={() => onSimpcityViewChange('threads')}>
                  Threads
                </button>
              </div>
            )}

            {showGalleryTypeFilters && (
              <div className="segmented segmented-media">
                {[
                  { label: 'All media', value: 'all' },
                  { label: 'Images', value: 'images' },
                  { label: 'Videos', value: 'videos' },
                  ...(isLibrary ? [{ label: 'Audio', value: 'audio' }] : [])
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={mediaFilter === option.value ? 'active' : ''}
                    onClick={() => onMediaFilterChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="controls-subrow-actions">
            {isReddit && (
              <button type="button" className={`ghost-button ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced((prev) => !prev)}>
                Advanced filters
              </button>
            )}

            {showGalleryTypeFilters && !isLibrary && (
              <select className="order-select" value={order} onChange={(event) => onOrderChange(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="score">Highest score</option>
                <option value="comments">Most commented</option>
                <option value="balanced">Balanced</option>
                <option value="longest">Longest videos</option>
                <option value="shortest">Shortest videos</option>
              </select>
            )}
          </div>
        </div>
      )}

      {isReddit && showAdvanced && !collapsed && (
        <div className="advanced-panel">
          <div className="advanced-panel-grid">
            <label className="field-block">
              <span>Keyword</span>
              <input
                type="text"
                value={redditFilters.keyword}
                placeholder="Keyword in subreddit"
                onChange={(event) => onRedditFilterChange('keyword', event.target.value)}
              />
            </label>

            <label className="field-block">
              <span>Top range</span>
              <select value={redditFilters.timeRange} onChange={(event) => onRedditFilterChange('timeRange', event.target.value)}>
                {REDDIT_TIME_RANGES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Search scope</span>
              <select value={redditFilters.searchScope} onChange={(event) => onRedditFilterChange('searchScope', event.target.value)}>
                {REDDIT_SEARCH_SCOPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Flair</span>
              <select value={redditFilters.flair} onChange={(event) => onRedditFilterChange('flair', event.target.value)}>
                <option value="">All flairs</option>
                {redditAvailableFlairs.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block field-block-wide">
              <span>Include terms</span>
              <input
                type="text"
                value={redditFilters.includeTerms}
                placeholder="Comma separated"
                onChange={(event) => onRedditFilterChange('includeTerms', event.target.value)}
              />
            </label>

            <label className="field-block field-block-wide">
              <span>Exclude terms</span>
              <input
                type="text"
                value={redditFilters.excludeTerms}
                placeholder="Comma separated"
                onChange={(event) => onRedditFilterChange('excludeTerms', event.target.value)}
              />
            </label>

            <label className="field-block">
              <span>Minimum score</span>
              <select value={redditFilters.minScore} onChange={(event) => onRedditFilterChange('minScore', Number(event.target.value))}>
                {MIN_SCORE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="advanced-toggle-row">
            <label className="toggle-pill">
              <input type="checkbox" checked={includeNsfw} onChange={(event) => onNsfwToggle(event.target.checked)} />
              <span>Include NSFW</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" checked={redditFilters.onlyRedditHosted} onChange={(event) => onRedditFilterChange('onlyRedditHosted', event.target.checked)} />
              <span>Reddit-hosted only</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" checked={redditFilters.suppressDuplicates} onChange={(event) => onRedditFilterChange('suppressDuplicates', event.target.checked)} />
              <span>Suppress duplicates</span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}

export default SearchControls;

