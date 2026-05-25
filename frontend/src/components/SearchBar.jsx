import { useEffect, useMemo, useRef, useState } from 'react';
import { NSFW_DIRECTORY } from '../utils/nsfwDirectory';
import { useDebounced } from '../hooks/useDebounced';
import { searchSubreddits } from '../utils/api';

const CATEGORY_INDEX = NSFW_DIRECTORY.map((section) => ({
  category: section.category,
  items: section.items,
  haystack: `${section.category} ${section.items.join(' ')}`.toLowerCase()
}));

const SUBREDDIT_INDEX = (() => {
  const seen = new Map();
  for (const section of NSFW_DIRECTORY) {
    for (const name of section.items) {
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name, categories: [] });
      seen.get(key).categories.push(section.category);
    }
  }
  return Array.from(seen.values());
})();

function score(needle, haystack) {
  if (!needle) return 0;
  const idx = haystack.indexOf(needle);
  if (idx < 0) return -1;
  if (idx === 0) return 100;
  const prevChar = haystack[idx - 1];
  if (prevChar === ' ' || prevChar === '/' || prevChar === '_' || prevChar === '-') return 80;
  return 50 - Math.min(idx, 40);
}

function highlight(text, query) {
  if (!query) return text;
  const lower = String(text).toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-hit">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function formatSubscribers(n) {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function CategoryIcon() { return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>); }
function SubIcon() { return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>); }
function RecentIcon() { return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>); }
function GoIcon() { return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>); }
function StarIcon({ filled }) { return (<svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>); }
function GlobeIcon() { return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>); }

export default function SearchBar({
  initialQuery,
  recentSearches = [],
  savedSearches = [],
  hiddenSubreddits = [],
  savedSubreddits = [],
  onSubmitSubreddit,
  onPickCategory,
  onApplySearch,
  onToggleSaveSubreddit,
  isSubredditSaved
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [redditResults, setRedditResults] = useState([]);
  const [redditLoading, setRedditLoading] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const debounced = useDebounced(query, 220);

  useEffect(() => {
    setQuery(initialQuery || '');
  }, [initialQuery]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fetch live Reddit subreddit search results
  useEffect(() => {
    const q = debounced.trim().replace(/^r\//, '');
    if (q.length < 2) {
      setRedditResults([]);
      setRedditLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRedditLoading(true);
    searchSubreddits({ query: q, limit: 8 })
      .then((data) => {
        if (cancelled) return;
        setRedditResults(data?.items || []);
      })
      .catch(() => { if (!cancelled) setRedditResults([]); })
      .finally(() => { if (!cancelled) setRedditLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  const hiddenSet = useMemo(() => new Set(hiddenSubreddits.map((s) => s.toLowerCase())), [hiddenSubreddits]);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase().replace(/^r\//, '');
    const groups = [];

    if (!q) {
      const recent = recentSearches.slice(0, 5).map((r) => ({
        type: 'recent',
        label: r.label,
        sublabel: 'Recent search',
        action: () => onApplySearch?.(r)
      }));
      const savedSubs = savedSubreddits.slice(0, 6).map((s) => ({
        type: 'subreddit',
        label: `r/${s.name}`,
        sublabel: s.title || 'Saved',
        action: () => onSubmitSubreddit?.(s.name)
      }));
      const featured = NSFW_DIRECTORY.slice(0, 6).map((section) => ({
        type: 'category',
        label: section.category,
        sublabel: `${section.items.length} subreddits`,
        action: () => onPickCategory?.(section.category, section.items)
      }));
      if (savedSubs.length) groups.push({ heading: 'Your saved subs', items: savedSubs });
      if (recent.length) groups.push({ heading: 'Recent', items: recent });
      if (featured.length) groups.push({ heading: 'Browse categories', items: featured });
      return { groups, flat: groups.flatMap((g) => g.items) };
    }

    const matchedCategoriesRanked = CATEGORY_INDEX
      .map((c) => ({ c, labelScore: score(q, c.category.toLowerCase()) }))
      .filter((h) => h.labelScore >= 0)
      .sort((a, b) => b.labelScore - a.labelScore);

    const categoryHits = matchedCategoriesRanked.slice(0, 6).map(({ c }) => ({
      type: 'category',
      label: c.category,
      sublabel: `${c.items.length} subreddits — open as multireddit`,
      action: () => onPickCategory?.(c.category, c.items)
    }));

    const matchedCategoryNames = new Set(matchedCategoriesRanked.map(({ c }) => c.category));

    const subHits = SUBREDDIT_INDEX
      .filter((s) => !hiddenSet.has(s.name.toLowerCase()))
      .map((s) => {
        const nameScore = score(q, s.name.toLowerCase());
        const inMatchedCategory = s.categories.some((cat) => matchedCategoryNames.has(cat));
        return { s, score: inMatchedCategory ? Math.max(nameScore, 30) : nameScore };
      })
      .filter((h) => h.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(({ s }) => ({
        type: 'subreddit',
        label: `r/${s.name}`,
        sublabel: s.categories.slice(0, 2).join(' · '),
        action: () => onSubmitSubreddit?.(s.name),
        canSave: true,
        subName: s.name
      }));

    // Reddit live results — exclude any already shown locally
    const localNameSet = new Set(SUBREDDIT_INDEX.map((s) => s.name.toLowerCase()));
    const liveHits = redditResults
      .filter((r) => !hiddenSet.has(r.name.toLowerCase()) && !localNameSet.has(r.name.toLowerCase()))
      .slice(0, 8)
      .map((r) => ({
        type: 'reddit',
        label: `r/${r.name}`,
        sublabel: [
          r.title || r.description || 'Reddit search',
          formatSubscribers(r.subscribers) ? `${formatSubscribers(r.subscribers)} subs` : null
        ].filter(Boolean).join(' · '),
        action: () => onSubmitSubreddit?.(r.name),
        canSave: true,
        subName: r.name,
        subData: r
      }));

    const recentHits = recentSearches
      .filter((r) => r.label?.toLowerCase().includes(q))
      .slice(0, 3)
      .map((r) => ({
        type: 'recent',
        label: r.label,
        sublabel: 'Recent search',
        action: () => onApplySearch?.(r)
      }));

    const directGo = {
      type: 'go',
      label: `Go to r/${q.replace(/[^a-z0-9_+]/gi, '')}`,
      sublabel: q.includes('+') ? 'Open as multireddit' : 'Open subreddit directly',
      action: () => onSubmitSubreddit?.(q.replace(/[^a-z0-9_+]/gi, ''))
    };

    if (categoryHits.length) groups.push({ heading: 'Categories', items: categoryHits });
    if (subHits.length) groups.push({ heading: 'In your directory', items: subHits });
    if (liveHits.length) {
      groups.push({ heading: redditLoading ? 'Searching Reddit…' : 'From Reddit', items: liveHits });
    } else if (redditLoading) {
      groups.push({ heading: 'Searching Reddit…', items: [] });
    }
    if (recentHits.length) groups.push({ heading: 'Recent', items: recentHits });
    groups.push({ heading: 'Direct', items: [directGo] });

    return { groups, flat: groups.flatMap((g) => g.items) };
  }, [debounced, recentSearches, savedSubreddits, hiddenSet, redditResults, redditLoading, onPickCategory, onApplySearch, onSubmitSubreddit]);

  useEffect(() => { setActiveIndex(0); }, [debounced]);

  function selectIndex(idx) {
    const item = results.flat[idx];
    if (!item) return;
    item.action();
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(results.flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.flat[activeIndex]) {
        selectIndex(activeIndex);
      } else {
        const v = query.trim().replace(/^r\//i, '');
        if (v) onSubmitSubreddit?.(v);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  let runningIndex = -1;
  const queryForHighlight = debounced.replace(/^r\//, '');

  return (
    <div className="searchbar" ref={wrapRef}>
      <form className="searchbar-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="searchbar-input-wrap">
          <svg className="searchbar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="searchbar-input"
            value={query}
            placeholder='Search any subreddit on Reddit, or pick a category'
            aria-label="Search categories and subreddits"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="searchbar-results"
            role="combobox"
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              type="button"
              className="searchbar-clear"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >×</button>
          )}
          <kbd className="searchbar-kbd" aria-hidden="true">/</kbd>
        </div>
      </form>

      {open && results.flat.length > 0 && (
        <div id="searchbar-results" className="searchbar-popover" role="listbox" ref={listRef}>
          {results.groups.map((group) => (
            <div key={group.heading} className="searchbar-group">
              <div className="searchbar-group-heading">
                {group.heading}
                {group.heading === 'From Reddit' && <GlobeIcon />}
              </div>
              {group.items.map((item) => {
                runningIndex += 1;
                const idx = runningIndex;
                const Icon = item.type === 'category' ? CategoryIcon
                  : item.type === 'subreddit' ? SubIcon
                  : item.type === 'reddit' ? GlobeIcon
                  : item.type === 'go' ? GoIcon
                  : RecentIcon;
                return (
                  <button
                    key={`${group.heading}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    data-idx={idx}
                    className={`searchbar-item ${idx === activeIndex ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectIndex(idx)}
                  >
                    <span className={`searchbar-item-icon searchbar-item-icon-${item.type}`}>
                      <Icon />
                    </span>
                    <span className="searchbar-item-text">
                      <span className="searchbar-item-label">{highlight(item.label, queryForHighlight)}</span>
                      {item.sublabel && <span className="searchbar-item-sub">{item.sublabel}</span>}
                    </span>
                    {item.canSave && onToggleSaveSubreddit && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={`searchbar-item-save ${isSubredditSaved?.(item.subName) ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSaveSubreddit(item.subData || { name: item.subName });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleSaveSubreddit(item.subData || { name: item.subName });
                          }
                        }}
                        aria-label={isSubredditSaved?.(item.subName) ? 'Remove saved subreddit' : 'Save subreddit'}
                        title={isSubredditSaved?.(item.subName) ? 'Saved' : 'Save'}
                      >
                        <StarIcon filled={isSubredditSaved?.(item.subName)} />
                      </span>
                    )}
                    {idx === activeIndex && !item.canSave && <span className="searchbar-item-hint">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
