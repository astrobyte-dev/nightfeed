import { useState, useMemo } from 'react';
import { NSFW_DIRECTORY } from '../utils/nsfwDirectory';
import { useDebounced } from '../hooks/useDebounced';

const REDDIT_TIME_RANGES = ['hour', 'day', 'week', 'month', 'year', 'all'];
const REDDIT_SEARCH_SCOPES = [
  { value: 'title', label: 'Title only' },
  { value: 'title_flair', label: 'Title + flair' },
  { value: 'post', label: 'Full post' }
];
const MIN_SCORE_OPTIONS = [0, 25, 100, 250, 500, 1000, 2500];

function Drawer({
  isOpen,
  onClose,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  redditFilters,
  redditAvailableFlairs,
  includeNsfw,
  mediaFilter,
  order,
  onRedditFilterChange,
  onNsfwToggle,
  onMediaFilterChange,
  onOrderChange,
  savedSearches,
  recentSearches,
  onSaveSearch,
  onApplySearch,
  onRemoveSaved,
  onRemoveRecent,
  subreddit,
  hiddenSubreddits,
  onPickSubreddit,
  onPickCategory,
  favorites,
  onOpenFavorite,
  onRemoveFavorite,
  onClearFavorites,
  theme,
  onThemeChange,
  density,
  onDensityChange,
  savedSubreddits = [],
  onPickSavedSubreddit,
  onRemoveSavedSubreddit,
  hiddenAuthors = [],
  onUnhideAuthor,
  onUnhideSubreddit,
  durationMin,
  durationMax,
  onDurationChange
}) {
  const [nsfwQuery, setNsfwQuery] = useState('');
  const [activeSection, setActiveSection] = useState('filters');
  const debouncedQuery = useDebounced(nsfwQuery, 200);

  const hiddenSet = useMemo(() => new Set((hiddenSubreddits || []).map((s) => s.toLowerCase())), [hiddenSubreddits]);

  const filteredDirectory = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return NSFW_DIRECTORY
      .map((section) => ({
        ...section,
        items: section.items.filter((name) => !hiddenSet.has(name.toLowerCase()))
      }))
      .filter((section) => section.items.length > 0)
      .map((section) => {
        if (!q) return section;
        return {
          ...section,
          items: section.items.filter((name) => name.toLowerCase().includes(q) || section.category.toLowerCase().includes(q))
        };
      })
      .filter((section) => section.items.length > 0);
  }, [debouncedQuery, hiddenSet]);

  const tabs = ['filters', 'subs', 'saved', 'recent', 'favorites', 'directory', 'blocked', 'settings'];

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-section">
          <div className="drawer-history-row">
            <button type="button" disabled={!canGoBack} onClick={onGoBack} className="drawer-nav-btn">Back</button>
            <button type="button" disabled={!canGoForward} onClick={onGoForward} className="drawer-nav-btn">Forward</button>
          </div>
        </div>

        <div className="drawer-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeSection === tab}
              className={`drawer-tab ${activeSection === tab ? 'active' : ''}`}
              onClick={() => setActiveSection(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'favorites' && favorites?.length > 0 && (
                <span className="drawer-tab-badge">{favorites.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {activeSection === 'filters' && (
            <div className="drawer-section">
              <div className="drawer-field">
                <label>Media type</label>
                <div className="drawer-pill-group">
                  {['all', 'images', 'videos'].map((v) => (
                    <button key={v} type="button" className={`drawer-pill ${mediaFilter === v ? 'active' : ''}`} onClick={() => onMediaFilterChange(v)}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-order">Order</label>
                <select id="drawer-order" className="drawer-select" value={order} onChange={(e) => onOrderChange(e.target.value)}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="score">Top score</option>
                  <option value="comments">Most comments</option>
                  <option value="balanced">Balanced (hot)</option>
                  <option value="longest">Longest video</option>
                  <option value="shortest">Shortest video</option>
                  <option value="random">Random shuffle</option>
                </select>
              </div>

              {(mediaFilter === 'videos' || mediaFilter === 'all') && (
                <div className="drawer-field">
                  <label>Video duration (seconds)</label>
                  <div className="drawer-range-row">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="min"
                      className="drawer-input drawer-range-input"
                      value={durationMin ?? ''}
                      onChange={(e) => onDurationChange?.('min', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                    />
                    <span className="drawer-range-sep">–</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="max"
                      className="drawer-input drawer-range-input"
                      value={durationMax ?? ''}
                      onChange={(e) => onDurationChange?.('max', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div className="drawer-pill-group" style={{ marginTop: 6 }}>
                    {[
                      { label: 'Any', min: null, max: null },
                      { label: '<15s', min: null, max: 15 },
                      { label: '15-60s', min: 15, max: 60 },
                      { label: '1-5m', min: 60, max: 300 },
                      { label: '>5m', min: 300, max: null }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={`drawer-pill ${durationMin === preset.min && durationMax === preset.max ? 'active' : ''}`}
                        onClick={() => {
                          onDurationChange?.('min', preset.min);
                          onDurationChange?.('max', preset.max);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="drawer-field">
                <label htmlFor="drawer-keyword">Keyword</label>
                <input id="drawer-keyword" type="text" className="drawer-input" value={redditFilters.keyword} placeholder="Keyword in subreddit" onChange={(e) => onRedditFilterChange('keyword', e.target.value)} />
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-time">Time range</label>
                <select id="drawer-time" className="drawer-select" value={redditFilters.timeRange} onChange={(e) => onRedditFilterChange('timeRange', e.target.value)}>
                  {REDDIT_TIME_RANGES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-scope">Search scope</label>
                <select id="drawer-scope" className="drawer-select" value={redditFilters.searchScope} onChange={(e) => onRedditFilterChange('searchScope', e.target.value)}>
                  {REDDIT_SEARCH_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-flair">Flair</label>
                <select id="drawer-flair" className="drawer-select" value={redditFilters.flair} onChange={(e) => onRedditFilterChange('flair', e.target.value)}>
                  <option value="">All flairs</option>
                  {redditAvailableFlairs.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-include">Include terms</label>
                <input id="drawer-include" type="text" className="drawer-input" value={redditFilters.includeTerms} placeholder="Comma separated" onChange={(e) => onRedditFilterChange('includeTerms', e.target.value)} />
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-exclude">Exclude terms</label>
                <input id="drawer-exclude" type="text" className="drawer-input" value={redditFilters.excludeTerms} placeholder="Comma separated" onChange={(e) => onRedditFilterChange('excludeTerms', e.target.value)} />
              </div>

              <div className="drawer-field">
                <label htmlFor="drawer-score">Min score</label>
                <select id="drawer-score" className="drawer-select" value={redditFilters.minScore} onChange={(e) => onRedditFilterChange('minScore', Number(e.target.value))}>
                  {MIN_SCORE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="drawer-toggles">
                <label className="drawer-toggle">
                  <input type="checkbox" checked={includeNsfw} onChange={(e) => onNsfwToggle(e.target.checked)} />
                  <span>Include NSFW</span>
                </label>
                <label className="drawer-toggle">
                  <input type="checkbox" checked={redditFilters.onlyRedditHosted} onChange={(e) => onRedditFilterChange('onlyRedditHosted', e.target.checked)} />
                  <span>Reddit-hosted only</span>
                </label>
                <label className="drawer-toggle">
                  <input type="checkbox" checked={redditFilters.suppressDuplicates} onChange={(e) => onRedditFilterChange('suppressDuplicates', e.target.checked)} />
                  <span>Suppress duplicates</span>
                </label>
              </div>
            </div>
          )}

          {activeSection === 'subs' && (
            <div className="drawer-section">
              {savedSubreddits.length > 0 ? (
                <div className="drawer-search-list">
                  {savedSubreddits.map((sub) => (
                    <div key={sub.name} className="drawer-search-item">
                      <button type="button" className="drawer-search-btn" onClick={() => { onPickSavedSubreddit?.(sub.name); onClose(); }} title={sub.title || sub.name}>
                        r/{sub.name}{sub.title ? ` — ${sub.title}` : ''}
                      </button>
                      <button type="button" className="drawer-dismiss" onClick={() => onRemoveSavedSubreddit?.(sub.name)} aria-label={`Remove r/${sub.name}`}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="drawer-empty">No saved subreddits yet. Search for any subreddit and tap the ★ to save it here.</p>
              )}
            </div>
          )}

          {activeSection === 'saved' && (
            <div className="drawer-section">
              <button type="button" className="drawer-save-btn" onClick={onSaveSearch}>Save current search</button>
              {savedSearches.length > 0 ? (
                <div className="drawer-search-list">
                  {savedSearches.map((item) => (
                    <div key={item.id} className="drawer-search-item">
                      <button type="button" className="drawer-search-btn" onClick={() => { onApplySearch(item); onClose(); }}>{item.label}</button>
                      <button type="button" className="drawer-dismiss" onClick={() => onRemoveSaved(item.id)} aria-label={`Remove ${item.label}`}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="drawer-empty">No saved searches yet. Save a search from the Filters tab to recall it later.</p>
              )}
            </div>
          )}

          {activeSection === 'recent' && (
            <div className="drawer-section">
              {recentSearches.length > 0 ? (
                <div className="drawer-search-list">
                  {recentSearches.map((item) => (
                    <div key={item.id} className="drawer-search-item">
                      <button type="button" className="drawer-search-btn" onClick={() => { onApplySearch(item); onClose(); }}>{item.label}</button>
                      <button type="button" className="drawer-dismiss" onClick={() => onRemoveRecent(item.id)} aria-label={`Remove ${item.label}`}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="drawer-empty">No recent searches yet.</p>
              )}
            </div>
          )}

          {activeSection === 'favorites' && (
            <div className="drawer-section">
              {favorites?.length > 0 ? (
                <>
                  <div className="drawer-favorites-head">
                    <span className="drawer-empty">{favorites.length} saved post{favorites.length === 1 ? '' : 's'}</span>
                    <button type="button" className="drawer-text-btn" onClick={() => {
                      if (window.confirm(`Clear all ${favorites.length} favorites?`)) onClearFavorites?.();
                    }}>Clear all</button>
                  </div>
                  <div className="drawer-favorites-list">
                    {favorites.map((fav) => (
                      <div key={fav.id} className="drawer-favorite-item">
                        <button
                          type="button"
                          className="drawer-favorite-btn"
                          onClick={() => { onOpenFavorite?.(fav); onClose(); }}
                          title={fav.title}
                        >
                          {fav.thumbnail ? (
                            <img src={fav.thumbnail} alt="" className="drawer-favorite-thumb" loading="lazy" />
                          ) : (
                            <div className="drawer-favorite-thumb drawer-favorite-thumb-empty" aria-hidden="true" />
                          )}
                          <div className="drawer-favorite-meta">
                            <span className="drawer-favorite-title">{fav.title || 'Untitled'}</span>
                            <span className="drawer-favorite-sub">{fav.subreddit ? `r/${fav.subreddit}` : fav.author || ''}</span>
                          </div>
                        </button>
                        <button type="button" className="drawer-dismiss" onClick={() => onRemoveFavorite?.(fav.id)} aria-label="Remove favorite">×</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="drawer-empty">No favorites yet. Tap the heart on any card or post to save it here.</p>
              )}
            </div>
          )}

          {activeSection === 'blocked' && (
            <div className="drawer-section">
              {hiddenAuthors.length === 0 && hiddenSubreddits.length === 0 ? (
                <p className="drawer-empty">Nothing hidden yet. Use the ⋯ menu on any card to hide an author or subreddit.</p>
              ) : (
                <>
                  {hiddenAuthors.length > 0 && (
                    <div className="drawer-field">
                      <label>Hidden authors</label>
                      <div className="drawer-search-list">
                        {hiddenAuthors.map((a) => (
                          <div key={a} className="drawer-search-item">
                            <span className="drawer-search-btn" style={{ cursor: 'default' }}>u/{a}</span>
                            <button type="button" className="drawer-dismiss" onClick={() => onUnhideAuthor?.(a)} aria-label={`Unhide u/${a}`}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hiddenSubreddits.length > 0 && (
                    <div className="drawer-field">
                      <label>Hidden subreddits</label>
                      <div className="drawer-search-list">
                        {hiddenSubreddits.map((s) => (
                          <div key={s} className="drawer-search-item">
                            <span className="drawer-search-btn" style={{ cursor: 'default' }}>r/{s}</span>
                            <button type="button" className="drawer-dismiss" onClick={() => onUnhideSubreddit?.(s)} aria-label={`Unhide r/${s}`}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeSection === 'directory' && (
            <div className="drawer-section">
              <input
                className="drawer-input"
                type="search"
                placeholder="Filter subreddits..."
                value={nsfwQuery}
                onChange={(e) => setNsfwQuery(e.target.value)}
                aria-label="Filter subreddit directory"
              />
              <div className="drawer-directory">
                {filteredDirectory.length === 0 ? (
                  <p className="drawer-empty">No subreddits match "{debouncedQuery}".</p>
                ) : filteredDirectory.map((section) => {
                  const categoryFeed = section.items.join('+');
                  const isCategoryActive = subreddit?.toLowerCase() === categoryFeed.toLowerCase();
                  return (
                    <details key={section.category} open={debouncedQuery.length > 0 || isCategoryActive}>
                      <summary>
                        <button
                          type="button"
                          className={`drawer-category-btn ${isCategoryActive ? 'active' : ''}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPickCategory(section.items); onClose(); }}
                        >
                          {section.category}
                        </button>
                      </summary>
                      <div className="drawer-chip-list">
                        {section.items.map((name) => (
                          <button
                            key={`${section.category}-${name}`}
                            type="button"
                            className={`drawer-chip ${subreddit?.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
                            onClick={() => { onPickSubreddit(name); onClose(); }}
                          >
                            r/{name}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="drawer-section">
              <div className="drawer-field">
                <label>Theme</label>
                <div className="drawer-pill-group">
                  {['dark', 'light', 'system'].map((t) => (
                    <button key={t} type="button" className={`drawer-pill ${theme === t ? 'active' : ''}`} onClick={() => onThemeChange?.(t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-field">
                <label>Grid density</label>
                <div className="drawer-pill-group">
                  {[
                    { v: 'compact', l: 'Compact' },
                    { v: 'comfortable', l: 'Comfortable' },
                    { v: 'large', l: 'Large' }
                  ].map((d) => (
                    <button key={d.v} type="button" className={`drawer-pill ${density === d.v ? 'active' : ''}`} onClick={() => onDensityChange?.(d.v)}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              <p className="drawer-empty">Preferences are saved on this device. Filter and feed state appears in the URL — copy the address bar to share or bookmark a feed.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Drawer;
