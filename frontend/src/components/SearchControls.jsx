const SORTS = ['hot', 'new', 'top'];
const YOUTUBE_ORDERS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'date', label: 'Newest' },
  { value: 'viewCount', label: 'Most viewed' }
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
  includeNsfw,
  order,
  youtubeCategory,
  youtubeCategories,
  youtubeOrder,
  redditFilters,
  redditAvailableFlairs,
  onSourceChange,
  onInputChange,
  onSubmit,
  onSortChange,
  onMediaFilterChange,
  onNsfwToggle,
  onOrderChange,
  onYoutubeCategoryChange,
  onYoutubeOrderChange,
  onRedditFilterChange,
  onSaveRedditSearch,
  redditSavedSearches,
  redditRecentSearches,
  onApplyRedditSearch,
  onRemoveRedditSearch
}) {
  const isReddit = source === 'reddit';
  const isInstagram = source === 'instagram';
  const isYouTube = source === 'youtube';
  const isSimpcity = source === 'simpcity';

  return (
    <section className="controls-card">
      <div className="source-toggle segmented">
        <button type="button" className={isReddit ? 'active' : ''} onClick={() => onSourceChange('reddit')}>
          Reddit
        </button>
        <button type="button" className={isInstagram ? 'active' : ''} onClick={() => onSourceChange('instagram')}>
          Instagram
        </button>
        <button type="button" className={isYouTube ? 'active' : ''} onClick={() => onSourceChange('youtube')}>
          YouTube
        </button>
        <button type="button" className={isSimpcity ? 'active' : ''} onClick={() => onSourceChange('simpcity')}>
          SimpCity
        </button>
      </div>

      <form onSubmit={onSubmit} className={`search-row ${isInstagram ? 'search-row-instagram' : ''}`}>
        <label htmlFor="search-input" className="sr-only">
          Search
        </label>
        <input
          id="search-input"
          type="text"
          value={inputValue}
          placeholder={
            isReddit
              ? 'Enter subreddit or multireddit (e.g. pics+wallpapers)'
              : isInstagram
                ? 'Enter Instagram username'
                : isYouTube
                  ? 'Search videos'
                  : 'Enter SimpCity keyword or path (/whats-new/posts/)'
          }
          onChange={(event) => onInputChange(event.target.value)}
        />

        {isReddit && (
          <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
            {SORTS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        )}

        {isYouTube && (
          <select value={youtubeOrder} onChange={(event) => onYoutubeOrderChange(event.target.value)}>
            {YOUTUBE_ORDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        )}

        <button type="submit">Search</button>
      </form>

      {isReddit && (
        <>
          <div className="advanced-grid">
            <input
              type="text"
              value={redditFilters.keyword}
              placeholder="Keyword in subreddit"
              onChange={(event) => onRedditFilterChange('keyword', event.target.value)}
            />
            <select value={redditFilters.timeRange} onChange={(event) => onRedditFilterChange('timeRange', event.target.value)}>
              {REDDIT_TIME_RANGES.map((item) => (
                <option key={item} value={item}>
                  Top: {item}
                </option>
              ))}
            </select>
            <select value={redditFilters.searchScope} onChange={(event) => onRedditFilterChange('searchScope', event.target.value)}>
              {REDDIT_SEARCH_SCOPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="advanced-grid advanced-grid-wide">
            <input
              type="text"
              value={redditFilters.includeTerms}
              placeholder="Include terms, comma separated"
              onChange={(event) => onRedditFilterChange('includeTerms', event.target.value)}
            />
            <input
              type="text"
              value={redditFilters.excludeTerms}
              placeholder="Exclude terms, comma separated"
              onChange={(event) => onRedditFilterChange('excludeTerms', event.target.value)}
            />
            <select value={redditFilters.flair} onChange={(event) => onRedditFilterChange('flair', event.target.value)}>
              <option value="">All flairs</option>
              {redditAvailableFlairs.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={redditFilters.minScore} onChange={(event) => onRedditFilterChange('minScore', Number(event.target.value))}>
              {MIN_SCORE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  Min score: {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-meta reddit-toggles-row">
            <label className="toggle-wrap">
              <input type="checkbox" checked={includeNsfw} onChange={(event) => onNsfwToggle(event.target.checked)} />
              Include NSFW
            </label>
            <label className="toggle-wrap">
              <input type="checkbox" checked={redditFilters.onlyRedditHosted} onChange={(event) => onRedditFilterChange('onlyRedditHosted', event.target.checked)} />
              Reddit-hosted only
            </label>
            <label className="toggle-wrap">
              <input type="checkbox" checked={redditFilters.suppressDuplicates} onChange={(event) => onRedditFilterChange('suppressDuplicates', event.target.checked)} />
              Suppress duplicates
            </label>
          </div>

          <div className="search-memory-row">
            <button type="button" onClick={onSaveRedditSearch}>Save current search</button>
            {redditSavedSearches.length > 0 && (
              <div className="memory-group">
                {redditSavedSearches.map((item) => (
                  <div key={item.id} className="memory-chip-wrap">
                    <button type="button" className="memory-chip" onClick={() => onApplyRedditSearch(item)}>
                      {item.label}
                    </button>
                    <button type="button" className="memory-chip-remove" onClick={() => onRemoveRedditSearch(item.id)}>
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {redditRecentSearches.length > 0 && (
            <div className="search-memory-row">
              <span className="mini-muted">Recent:</span>
              <div className="memory-group">
                {redditRecentSearches.map((item) => (
                  <button key={item.id} type="button" className="memory-chip" onClick={() => onApplyRedditSearch(item)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isYouTube && (
        <div className="filter-row">
          <div className="filter-meta">
            <select value={youtubeCategory} onChange={(event) => onYoutubeCategoryChange(event.target.value)}>
              {youtubeCategories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="filter-row">
        <div className="segmented">
          {[
            { label: 'All media', value: 'all' },
            { label: 'Images', value: 'images' },
            { label: 'Videos', value: 'videos' }
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

        <div className="filter-meta">
          <select value={order} onChange={(event) => onOrderChange(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
            <option value="comments">Most commented</option>
            <option value="balanced">Balanced</option>
            <option value="longest">Longest videos</option>
            <option value="shortest">Shortest videos</option>
          </select>
        </div>
      </div>
    </section>
  );
}

export default SearchControls;
