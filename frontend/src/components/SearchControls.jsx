const SORTS = ['hot', 'new', 'top'];
const YOUTUBE_ORDERS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'date', label: 'Newest' },
  { value: 'viewCount', label: 'Most viewed' }
];

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
  onSourceChange,
  onInputChange,
  onSubmit,
  onSortChange,
  onMediaFilterChange,
  onNsfwToggle,
  onOrderChange,
  onYoutubeCategoryChange,
  onYoutubeOrderChange
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
              ? 'Enter subreddit (e.g. pics)'
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
            <option value="longest">Longest videos</option>
            <option value="shortest">Shortest videos</option>
          </select>

          {isReddit && (
            <label className="toggle-wrap">
              <input type="checkbox" checked={includeNsfw} onChange={(event) => onNsfwToggle(event.target.checked)} />
              Include NSFW
            </label>
          )}
        </div>
      </div>
    </section>
  );
}

export default SearchControls;

