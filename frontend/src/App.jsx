
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchControls from './components/SearchControls';
import GalleryGrid from './components/GalleryGrid';
import SimpcityThreadList from './components/SimpcityThreadList';
import FeedView from './components/FeedView';
import {
  fetchIndexedSimpcityMedia,
  fetchInstagramMedia,
  fetchMediaCreators,
  fetchMediaFeed,
  fetchMediaSearch,
  fetchMediaTags,
  fetchRedditUserMedia,
  fetchSimpcityCreators,
  fetchSimpcitySidebar,
  fetchSimpcityTags,
  fetchSimpcityThreadDetail,
  fetchSimpcityThreads,
  fetchSubredditMedia
} from './utils/api';
import { NSFW_DIRECTORY, NSFW_TOP_PICKS } from './utils/nsfwDirectory';

const LAST_SUBREDDIT_KEY = 'subreddit-media-viewer:last-subreddit';
const LAST_REDDIT_FILTERS_KEY = 'subreddit-media-viewer:last-reddit-filters';
const REDDIT_SAVED_SEARCHES_KEY = 'subreddit-media-viewer:reddit-saved-searches';
const REDDIT_RECENT_SEARCHES_KEY = 'subreddit-media-viewer:reddit-recent-searches';
const HIDDEN_SUBREDDITS_KEY = 'subreddit-media-viewer:hidden-subreddits';
const LAST_IG_KEY = 'subreddit-media-viewer:last-instagram-user';
const LAST_SC_KEY = 'subreddit-media-viewer:last-simpcity-search';
const LAST_SC_FILTERS_KEY = 'subreddit-media-viewer:last-simpcity-filters';
const LAST_SC_VIEW_KEY = 'subreddit-media-viewer:last-simpcity-view';
const LAST_LIBRARY_KEY = 'subreddit-media-viewer:last-library-search';
const LAST_LIBRARY_FILTERS_KEY = 'subreddit-media-viewer:last-library-filters';
const LAST_LIBRARY_SORT_KEY = 'subreddit-media-viewer:last-library-sort';
const MEDIA_PAGE_SIZE_REDDIT = 48;
const MEDIA_PAGE_SIZE_IG = 24;
const MEDIA_PAGE_SIZE_SC = 36;
const MEDIA_PAGE_SIZE_LIBRARY = 30;
const THREAD_PAGE_SIZE_SC = 24;
const LOAD_MORE_ROOT_MARGIN = '1500px 0px';

const DEFAULT_REDDIT_FILTERS = {
  keyword: '',
  includeTerms: '',
  excludeTerms: '',
  timeRange: 'all',
  searchScope: 'title',
  flair: '',
  minScore: 0,
  onlyRedditHosted: false,
  suppressDuplicates: true
};

const DEFAULT_SIMPCITY_FILTERS = {
  category: '',
  section: '',
  tag: '',
  creator: '',
  author: '',
  sourceHost: ''
};

const DEFAULT_LIBRARY_FILTERS = {
  creator: '',
  tag: ''
};

const KNOWN_COOMER_SERVICES = new Set(['onlyfans', 'fansly', 'patreon', 'subscribestar']);

function getInitialLibrarySearch() {
  const stored = (localStorage.getItem(LAST_LIBRARY_KEY) || '').trim();
  if (!stored || stored.toLowerCase() === 'ambient') return 'feet';
  return stored;
}

function getInitialLibraryFilters() {
  const stored = { ...DEFAULT_LIBRARY_FILTERS, ...parseStoredJson(LAST_LIBRARY_FILTERS_KEY, {}) };
  const service = String(stored.tag || '').trim().toLowerCase();
  if (!service || KNOWN_COOMER_SERVICES.has(service)) {
    return {
      creator: String(stored.creator || '').trim(),
      tag: service
    };
  }

  return { ...DEFAULT_LIBRARY_FILTERS };
}

function getLibraryCreatorLabel(creator) {
  if (!creator) return '';
  return String(creator.label || creator.name || creator.id || '').trim();
}

function toLibraryMediaType(filter) {
  if (filter === 'images') return 'image';
  if (filter === 'videos') return 'video';
  if (filter === 'audio') return 'audio';
  return 'all';
}

function parseStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function findDirectoryCategoryLabel(subredditValue) {
  const normalized = String(subredditValue || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('+')) return '';
  const match = NSFW_DIRECTORY.find((section) => section.items.join('+').toLowerCase() === normalized);
  return match?.category || '';
}

function findDirectorySection(categoryLabel, subredditValue) {
  const normalizedCategory = String(categoryLabel || '').trim().toLowerCase();
  if (normalizedCategory) {
    const byCategory = NSFW_DIRECTORY.find((section) => section.category.toLowerCase() === normalizedCategory);
    if (byCategory) return byCategory;
  }

  const normalizedSubreddit = String(subredditValue || '').trim().toLowerCase();
  if (!normalizedSubreddit || normalizedSubreddit.includes('+')) return null;

  return NSFW_DIRECTORY.find((section) => section.items.some((item) => item.toLowerCase() === normalizedSubreddit)) || null;
}

function makeSearchLabel(subreddit, filters) {
  const parts = [subreddit];
  if (filters.keyword) parts.push(filters.keyword);
  if (filters.flair) parts.push(`flair:${filters.flair}`);
  if (filters.minScore) parts.push(`score>=${filters.minScore}`);
  if (filters.onlyRedditHosted) parts.push('hosted');
  return parts.join(' | ');
}

function compareScore(a, b) {
  return (b.score || 0) - (a.score || 0);
}

function compareComments(a, b) {
  return (b.numComments || 0) - (a.numComments || 0);
}

function compareBalanced(a, b) {
  const now = Date.now() / 1000;
  const scoreA = ((a.score || 0) + (a.numComments || 0) * 2) / Math.max(2, (now - (a.createdUtc || now)) / 3600);
  const scoreB = ((b.score || 0) + (b.numComments || 0) * 2) / Math.max(2, (now - (b.createdUtc || now)) / 3600);
  return scoreB - scoreA;
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.mediaUrl || item.videoUrl || `${item.title}|${item.author}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareNewest(a, b) {
  return (b.createdUtc || 0) - (a.createdUtc || 0);
}

function compareOldest(a, b) {
  return (a.createdUtc || 0) - (b.createdUtc || 0);
}

function compareVideoLength(a, b, direction) {
  const aLen = a.type === 'video' && Number.isFinite(a.videoDurationSec) ? a.videoDurationSec : null;
  const bLen = b.type === 'video' && Number.isFinite(b.videoDurationSec) ? b.videoDurationSec : null;

  if (aLen !== null && bLen !== null) {
    return direction === 'desc' ? bLen - aLen : aLen - bLen;
  }
  if (aLen !== null) return -1;
  if (bLen !== null) return 1;

  return compareNewest(a, b);
}

function serializeSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}

function createFeedSnapshot({
  source,
  redditInput,
  subreddit,
  redditCategoryLabel,
  instagramInput,
  instagramUsername,
  simpcityInput,
  simpcitySearch,
  simpcityView,
  simpcityFilters,
  libraryInput,
  librarySearch,
  libraryFilters,
  librarySort,
  authorView,
  sort,
  includeNsfw,
  mediaFilter,
  order,
  redditFilters
}) {
  return {
    source,
    redditInput,
    subreddit,
    redditCategoryLabel,
    instagramInput,
    instagramUsername,
    simpcityInput,
    simpcitySearch,
    simpcityView,
    simpcityFilters,
    libraryInput,
    librarySearch,
    libraryFilters,
    librarySort,
    authorView,
    sort,
    includeNsfw,
    mediaFilter,
    order,
    redditFilters
  };
}

function toSimpcityMediaType(filter) {
  if (filter === 'images') return 'image';
  if (filter === 'videos') return 'video';
  return 'all';
}

function buildSummaryItem(label, value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return { label, value: normalized };
}

function FilterSummaryCard({ title, subtitle, items, onClearAll, emptyLabel = 'No filters active right now.' }) {
  return (
    <section className="sidebar-card explorer-summary-card">
      <div className="sidebar-section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {items.length > 0 && onClearAll ? (
          <button type="button" className="ghost-button ghost-button-small" onClick={onClearAll}>
            Clear all
          </button>
        ) : null}
      </div>
      {items.length > 0 ? (
        <div className="active-filter-grid">
          {items.map((item) => (
            <div key={`${item.label}:${item.value}`} className="active-filter-pill">
              <span className="active-filter-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="sidebar-empty">{emptyLabel}</div>
      )}
    </section>
  );
}

function App() {
  const initialSubreddit = localStorage.getItem(LAST_SUBREDDIT_KEY) || 'pics';
  const initialRedditCategoryLabel = findDirectoryCategoryLabel(initialSubreddit);
  const [source, setSource] = useState('reddit');
  const [redditInput, setRedditInput] = useState(initialRedditCategoryLabel ? '' : initialSubreddit);
  const [subreddit, setSubreddit] = useState(initialSubreddit);
  const [redditCategoryLabel, setRedditCategoryLabel] = useState(initialRedditCategoryLabel);
  const [instagramInput, setInstagramInput] = useState(localStorage.getItem(LAST_IG_KEY) || 'instagram');
  const [instagramUsername, setInstagramUsername] = useState(localStorage.getItem(LAST_IG_KEY) || 'instagram');
  const [simpcityInput, setSimpcityInput] = useState(localStorage.getItem(LAST_SC_KEY) || 'onlyfans');
  const [simpcitySearch, setSimpcitySearch] = useState(localStorage.getItem(LAST_SC_KEY) || 'onlyfans');
  const [simpcityView, setSimpcityView] = useState(localStorage.getItem(LAST_SC_VIEW_KEY) || 'media');
  const [simpcityFilters, setSimpcityFilters] = useState(() => ({ ...DEFAULT_SIMPCITY_FILTERS, ...parseStoredJson(LAST_SC_FILTERS_KEY, {}) }));
  const [libraryInput, setLibraryInput] = useState(getInitialLibrarySearch);
  const [librarySearch, setLibrarySearch] = useState(getInitialLibrarySearch);
  const [libraryFilters, setLibraryFilters] = useState(getInitialLibraryFilters);
  const [librarySort, setLibrarySort] = useState(localStorage.getItem(LAST_LIBRARY_SORT_KEY) || 'newest');
  const [libraryCreators, setLibraryCreators] = useState([]);
  const [libraryTags, setLibraryTags] = useState([]);
  const [libraryCreatorQuery, setLibraryCreatorQuery] = useState('');
  const [libraryTagQuery, setLibraryTagQuery] = useState('');
  const [simpcitySidebar, setSimpcitySidebar] = useState([]);
  const [simpcityTags, setSimpcityTags] = useState([]);
  const [simpcityCreators, setSimpcityCreators] = useState([]);
  const [simpcityCreatorQuery, setSimpcityCreatorQuery] = useState('');
  const [simpcityTagQuery, setSimpcityTagQuery] = useState('');
  const [simpcityHostQuery, setSimpcityHostQuery] = useState('');
  const [simpcitySectionQuery, setSimpcitySectionQuery] = useState('');
  const [simpcityHosts, setSimpcityHosts] = useState([]);
  const [simpcityStats, setSimpcityStats] = useState(null);
  const [simpcityThreads, setSimpcityThreads] = useState([]);
  const [simpcityThreadAfter, setSimpcityThreadAfter] = useState(null);
  const [simpcitySelectedThread, setSimpcitySelectedThread] = useState(null);
  const [simpcityThreadDetail, setSimpcityThreadDetail] = useState(null);
  const [simpcityThreadLoading, setSimpcityThreadLoading] = useState(false);
  const [authorView, setAuthorView] = useState(null);
  const [sort, setSort] = useState('hot');
  const [includeNsfw, setIncludeNsfw] = useState(true);
  const [mediaFilter, setMediaFilter] = useState('all');
  const [order, setOrder] = useState('newest');
  const [redditFilters, setRedditFilters] = useState(() => ({ ...DEFAULT_REDDIT_FILTERS, ...parseStoredJson(LAST_REDDIT_FILTERS_KEY, {}) }));
  const [redditAvailableFlairs, setRedditAvailableFlairs] = useState([]);
  const [redditSavedSearches, setRedditSavedSearches] = useState(() => parseStoredJson(REDDIT_SAVED_SEARCHES_KEY, []));
  const [redditRecentSearches, setRedditRecentSearches] = useState(() => parseStoredJson(REDDIT_RECENT_SEARCHES_KEY, []));
  const [hiddenSubreddits, setHiddenSubreddits] = useState(() => parseStoredJson(HIDDEN_SUBREDDITS_KEY, []));
  const [items, setItems] = useState([]);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [nsfwQuery, setNsfwQuery] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [feedMode, setFeedMode] = useState(false);
  const [downloadQueue, setDownloadQueue] = useState(() => JSON.parse(localStorage.getItem('nightfeed:download-queue') || '[]'));
  const debounceTimer = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const ignoreHistoryRef = useRef(false);

  const activeSort = source === 'library' ? librarySort : sort;

  const currentSnapshot = useMemo(
    () => createFeedSnapshot({
      source,
      redditInput,
      subreddit,
      redditCategoryLabel,
      instagramInput,
      instagramUsername,
      simpcityInput,
      simpcitySearch,
      simpcityView,
      simpcityFilters,
      libraryInput,
      librarySearch,
      libraryFilters,
      librarySort,
      authorView,
      sort,
      includeNsfw,
      mediaFilter,
      order,
      redditFilters
    }),
    [
      source,
      redditInput,
      subreddit,
      redditCategoryLabel,
      instagramInput,
      instagramUsername,
      simpcityInput,
      simpcitySearch,
      simpcityView,
      simpcityFilters,
      libraryInput,
      librarySearch,
      libraryFilters,
      librarySort,
      authorView,
      sort,
      includeNsfw,
      mediaFilter,
      order,
      redditFilters
    ]
  );  const [feedHistory, setFeedHistory] = useState(() => [currentSnapshot]);
  const [historyIndex, setHistoryIndex] = useState(0);
  useEffect(() => {
    const collapseThreshold = 140;
    const expandThreshold = 80;
    let frameId = null;

    function updateCollapsedState() {
      frameId = null;
      const scrollY = window.scrollY;

      setIsHeaderCollapsed((prev) => {
        if (!prev && scrollY > collapseThreshold) return true;
        if (prev && scrollY < expandThreshold) return false;
        return prev;
      });
    }

    function onScroll() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateCollapsedState);
    }

    updateCollapsedState();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LAST_SUBREDDIT_KEY, subreddit);
  }, [subreddit]);

  useEffect(() => {
    localStorage.setItem(LAST_IG_KEY, instagramUsername);
  }, [instagramUsername]);

  useEffect(() => {
    localStorage.setItem(LAST_SC_KEY, simpcitySearch);
  }, [simpcitySearch]);

  useEffect(() => {
    localStorage.setItem(LAST_SC_VIEW_KEY, simpcityView);
  }, [simpcityView]);

  useEffect(() => {
    localStorage.setItem(LAST_SC_FILTERS_KEY, JSON.stringify(simpcityFilters));
  }, [simpcityFilters]);
  useEffect(() => {
    localStorage.setItem(LAST_LIBRARY_KEY, librarySearch);
  }, [librarySearch]);

  useEffect(() => {
    localStorage.setItem(LAST_LIBRARY_FILTERS_KEY, JSON.stringify(libraryFilters));
  }, [libraryFilters]);

  useEffect(() => {
    localStorage.setItem(LAST_LIBRARY_SORT_KEY, librarySort);
  }, [librarySort]);

  useEffect(() => {
    localStorage.setItem(LAST_REDDIT_FILTERS_KEY, JSON.stringify(redditFilters));
  }, [redditFilters]);

  useEffect(() => {
    localStorage.setItem(REDDIT_SAVED_SEARCHES_KEY, JSON.stringify(redditSavedSearches));
  }, [redditSavedSearches]);

  useEffect(() => {
    localStorage.setItem(REDDIT_RECENT_SEARCHES_KEY, JSON.stringify(redditRecentSearches));
  }, [redditRecentSearches]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_SUBREDDITS_KEY, JSON.stringify(hiddenSubreddits));
  }, [hiddenSubreddits]);

  useEffect(() => {
    const serializedCurrent = serializeSnapshot(currentSnapshot);

    if (ignoreHistoryRef.current) {
      ignoreHistoryRef.current = false;
      return;
    }

    setFeedHistory((prev) => {
      const nextBase = prev.slice(0, historyIndex + 1);
      const active = nextBase[nextBase.length - 1];
      if (active && serializeSnapshot(active) === serializedCurrent) {
        return prev;
      }
      const next = [...nextBase, currentSnapshot].slice(-40);
      const nextIndex = next.length - 1;
      if (nextIndex !== historyIndex) {
        setHistoryIndex(nextIndex);
      }
      return next;
    });
  }, [currentSnapshot, historyIndex]);

  const hiddenSubredditSet = useMemo(() => new Set(hiddenSubreddits.map((item) => String(item).toLowerCase())), [hiddenSubreddits]);
  const filteredLibraryCreators = useMemo(() => {
    const query = libraryCreatorQuery.trim().toLowerCase();
    if (!query) return libraryCreators;
    return libraryCreators.filter((creator) => getLibraryCreatorLabel(creator).toLowerCase().includes(query));
  }, [libraryCreators, libraryCreatorQuery]);

  const filteredLibraryTags = useMemo(() => {
    const query = libraryTagQuery.trim().toLowerCase();
    if (!query) return libraryTags;
    return libraryTags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [libraryTags, libraryTagQuery]);

  const filteredSimpcityCreators = useMemo(() => {
    const query = simpcityCreatorQuery.trim().toLowerCase();
    if (!query) return simpcityCreators;
    return simpcityCreators.filter((creator) => String(creator.name || '').toLowerCase().includes(query));
  }, [simpcityCreators, simpcityCreatorQuery]);

  const filteredSimpcityTags = useMemo(() => {
    const query = simpcityTagQuery.trim().toLowerCase();
    if (!query) return simpcityTags;
    return simpcityTags.filter((tag) => String(tag.name || '').toLowerCase().includes(query));
  }, [simpcityTags, simpcityTagQuery]);

  const filteredSimpcityHosts = useMemo(() => {
    const query = simpcityHostQuery.trim().toLowerCase();
    if (!query) return simpcityHosts;
    return simpcityHosts.filter((host) => String(host.host || '').toLowerCase().includes(query));
  }, [simpcityHosts, simpcityHostQuery]);

  const filteredSimpcitySidebar = useMemo(() => {
    const query = simpcitySectionQuery.trim().toLowerCase();
    if (!query) return simpcitySidebar;

    return simpcitySidebar
      .map((category) => ({
        ...category,
        sections: (category.sections || []).filter(
          (section) => String(section.name || '').toLowerCase().includes(query) || String(category.name || '').toLowerCase().includes(query)
        )
      }))
      .filter((category) => category.sections.length > 0);
  }, [simpcitySidebar, simpcitySectionQuery]);

  const selectedLibraryCreator = useMemo(
    () => libraryCreators.find((creator) => String(creator.id) === String(libraryFilters.creator)) || null,
    [libraryCreators, libraryFilters.creator]
  );

  function hideSubreddit(subredditName) {
    const normalized = String(subredditName || '').replace(/^r\//i, '').trim().toLowerCase();
    if (!normalized || normalized.includes('+')) return;

    setHiddenSubreddits((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setRedditSavedSearches((prev) => prev.filter((item) => String(item.subreddit || '').trim().toLowerCase() !== normalized));
    setRedditRecentSearches((prev) => prev.filter((item) => String(item.subreddit || '').trim().toLowerCase() !== normalized));
  }

  function applyFeedSnapshot(snapshot) {
    ignoreHistoryRef.current = true;
    setActivePost(null);
    setSource(snapshot.source);
    setRedditInput(snapshot.redditInput);
    setSubreddit(snapshot.subreddit);
    setRedditCategoryLabel(snapshot.redditCategoryLabel || '');
    setInstagramInput(snapshot.instagramInput);
    setInstagramUsername(snapshot.instagramUsername);
    setSimpcityInput(snapshot.simpcityInput);
    setSimpcitySearch(snapshot.simpcitySearch);
    setSimpcityView(snapshot.simpcityView);
    setSimpcityFilters(snapshot.simpcityFilters);
    setLibraryInput(snapshot.libraryInput);
    setLibrarySearch(snapshot.librarySearch);
    setLibraryFilters(snapshot.libraryFilters);
    setLibrarySort(snapshot.librarySort);
    setAuthorView(snapshot.authorView);
    setSort(snapshot.sort);
    setIncludeNsfw(snapshot.includeNsfw);
    setMediaFilter(snapshot.mediaFilter);
    setOrder(snapshot.order);
    setRedditFilters(snapshot.redditFilters);
    setSimpcitySelectedThread(null);
    setSimpcityThreadDetail(null);
  }

  function handleGoBack() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    applyFeedSnapshot(feedHistory[nextIndex]);
  }

  function handleGoForward() {
    if (historyIndex >= feedHistory.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    applyFeedSnapshot(feedHistory[nextIndex]);
  }

  function resetSimpcityThreadSelection() {
    setSimpcitySelectedThread(null);
    setSimpcityThreadDetail(null);
  }

  function updateSimpcityFilters(patch, options = {}) {
    const { switchToMedia = false, clearThread = true } = options;
    setAuthorView(null);
    if (switchToMedia) {
      setSimpcityView('media');
    }
    setSimpcityFilters((prev) => ({ ...prev, ...patch }));
    if (clearThread) {
      resetSimpcityThreadSelection();
    }
  }

  function updateLibraryFilters(patch) {
    setAuthorView(null);
    setLibraryFilters((prev) => ({ ...prev, ...patch }));
  }

  function resetLibraryDiscovery() {
    setMediaFilter('all');
    setLibraryCreatorQuery('');
    setLibraryTagQuery('');
    updateLibraryFilters({ ...DEFAULT_LIBRARY_FILTERS });
  }

  useEffect(() => {
    if (source !== 'library') return undefined;
    let cancelled = false;

    async function loadLibrarySidebar() {
      try {
        const mediaType = toLibraryMediaType(mediaFilter);
        const [creatorData, tagData] = await Promise.all([
          fetchMediaCreators({ search: librarySearch, service: libraryFilters.tag, type: mediaType }),
          fetchMediaTags({ search: librarySearch, creator: selectedLibraryCreator?.id || '', type: mediaType })
        ]);
        if (cancelled) return;
        setLibraryCreators(creatorData.items || []);
        setLibraryTags(tagData.items || []);
      } catch (libraryError) {
        if (!cancelled) {
          console.error('[library] failed to load sidebar data', libraryError);
        }
      }
    }

    loadLibrarySidebar();
    return () => {
      cancelled = true;
    };
  }, [source, librarySearch, libraryFilters.tag, mediaFilter, selectedLibraryCreator?.id]);
  useEffect(() => {
    if (source !== 'simpcity') return undefined;
    let cancelled = false;

    async function loadSidebar() {
      try {
        const [sidebarData, tagData, creatorData] = await Promise.all([
          fetchSimpcitySidebar(),
          fetchSimpcityTags(),
          fetchSimpcityCreators({ search: simpcityCreatorQuery.trim(), limit: 80 })
        ]);
        if (cancelled) return;
        setSimpcitySidebar(sidebarData.categories || []);
        setSimpcityStats(sidebarData.stats || null);
        if ((sidebarData.stats?.thread_count || 0) > 0 && (sidebarData.stats?.media_count || 0) === 0 && simpcityView === 'media') {
          setSimpcityView('threads');
        }
        setSimpcityTags(tagData.tags || []);
        setSimpcityHosts(tagData.hosts || []);
        setSimpcityCreators(creatorData.items || []);
      } catch (sidebarError) {
        if (!cancelled) {
          console.error('[simpcity] failed to load indexed sidebar', sidebarError);
        }
      }
    }

    loadSidebar();
    return () => {
      cancelled = true;
    };
  }, [source, simpcityCreatorQuery]);

  useEffect(() => {
    let isCancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError('');
      setActivePost(null);

      try {
        if (source === 'reddit') {
          if (authorView?.source === 'reddit') {
            const data = await fetchRedditUserMedia({ username: authorView.username, sort, includeNsfw, after: null, limit: MEDIA_PAGE_SIZE_REDDIT });
            if (isCancelled) return;
            setItems(data.items || []);
            setAfter(data.after || null);
            setRedditAvailableFlairs([]);
          } else {
            const data = await fetchSubredditMedia({
              subreddit,
              sort,
              includeNsfw,
              after: null,
              limit: MEDIA_PAGE_SIZE_REDDIT,
              timeRange: redditFilters.timeRange,
              keyword: redditFilters.keyword,
              includeTerms: redditFilters.includeTerms,
              excludeTerms: redditFilters.excludeTerms,
              flair: redditFilters.flair,
              minScore: redditFilters.minScore,
              onlyRedditHosted: redditFilters.onlyRedditHosted,
              searchScope: redditFilters.searchScope
            });
            if (isCancelled) return;
            setItems(data.items || []);
            setAfter(data.after || null);
            setRedditAvailableFlairs(data.availableFlairs || []);
            const label = makeSearchLabel(subreddit, redditFilters);
            setRedditRecentSearches((prev) => [{ id: label, label, subreddit, filters: redditFilters }, ...prev.filter((item) => item.id !== label)].slice(0, 8));
          }
          setSimpcityThreads([]);
          setSimpcityThreadAfter(null);
          return;
        }

        if (source === 'instagram') {
          const targetUser = authorView?.source === 'instagram' ? authorView.username : instagramUsername;
          const data = await fetchInstagramMedia({ username: targetUser, after: null, limit: MEDIA_PAGE_SIZE_IG });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setSimpcityThreads([]);
          setSimpcityThreadAfter(null);
          return;
        }

        if (source === 'library') {
          const mediaType = toLibraryMediaType(mediaFilter);
          const params = {
            search: librarySearch,
            creator: libraryFilters.creator,
            tag: libraryFilters.tag,
            type: mediaType,
            sort: librarySort,
            after: null,
            limit: MEDIA_PAGE_SIZE_LIBRARY
          };
          const data = librarySearch || libraryFilters.creator || libraryFilters.tag || mediaFilter !== 'all'
            ? await fetchMediaSearch(params)
            : await fetchMediaFeed({ after: null, limit: MEDIA_PAGE_SIZE_LIBRARY });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setSimpcityThreads([]);
          setSimpcityThreadAfter(null);
          return;
        }
        if (simpcityView === 'threads') {
          const data = await fetchSimpcityThreads({
            category: simpcityFilters.category,
            section: simpcityFilters.section,
            tag: simpcityFilters.tag,
            creator: simpcityFilters.creator,
            author: simpcityFilters.author,
            search: simpcitySearch,
            after: null,
            limit: THREAD_PAGE_SIZE_SC
          });
          if (isCancelled) return;
          setSimpcityThreads(data.items || []);
          setSimpcityThreadAfter(data.after || null);
          setItems([]);
          setAfter(null);
        } else {
          const data = await fetchIndexedSimpcityMedia({
            category: simpcityFilters.category,
            section: simpcityFilters.section,
            tag: simpcityFilters.tag,
            creator: simpcityFilters.creator,
            author: simpcityFilters.author,
            search: simpcitySearch,
            mediaType: toSimpcityMediaType(mediaFilter),
            sourceHost: simpcityFilters.sourceHost,
            after: null,
            limit: MEDIA_PAGE_SIZE_SC
          });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setSimpcityThreads([]);
          setSimpcityThreadAfter(null);
        }
      } catch (err) {
        if (isCancelled) return;
        const message = err.message || 'Unable to load media right now.';
        if (source === 'reddit' && !authorView && message === 'Subreddit not found') {
          hideSubreddit(subreddit);
        }
        setItems([]);
        setAfter(null);
        setSimpcityThreads([]);
        setSimpcityThreadAfter(null);
        setError(message);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      isCancelled = true;
    };
  }, [
    source,
    subreddit,
    sort,
    includeNsfw,
    instagramUsername,
    simpcitySearch,
    simpcityView,
    simpcityFilters,
    librarySearch,
    libraryFilters,
    librarySort,
    mediaFilter,
    authorView,
    redditFilters
  ]);

  useEffect(() => {
    if (source !== 'simpcity' || simpcityView !== 'threads' || !simpcitySelectedThread?.id) {
      return undefined;
    }

    let cancelled = false;
    setSimpcityThreadLoading(true);

    fetchSimpcityThreadDetail(simpcitySelectedThread.id)
      .then((data) => {
        if (cancelled) return;
        setSimpcityThreadDetail(data);
      })
      .catch((detailError) => {
        if (!cancelled) {
          console.error('[simpcity] failed to load thread detail', detailError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSimpcityThreadLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [source, simpcityView, simpcitySelectedThread]);

  const effectiveItems = useMemo(() => {
    if (source === 'simpcity' && simpcityView === 'threads') {
      return simpcityThreadDetail?.media || [];
    }
    return items;
  }, [source, simpcityView, simpcityThreadDetail, items]);
  const filteredItems = useMemo(() => {
    let next = effectiveItems;
    if (mediaFilter === 'images') next = next.filter((item) => item.type === 'image' || item.type === 'gallery');
    if (mediaFilter === 'videos') next = next.filter((item) => item.type === 'video');
    if (mediaFilter === 'audio') next = next.filter((item) => item.type === 'audio');
    if (source === 'reddit' && redditFilters.suppressDuplicates) next = dedupeItems(next);
    return next;
  }, [effectiveItems, mediaFilter, source, redditFilters.suppressDuplicates]);

  const displayItems = useMemo(() => {
    const copy = [...filteredItems];
    if (order === 'oldest') return copy.sort(compareOldest);
    if (order === 'score') return copy.sort(compareScore);
    if (order === 'comments') return copy.sort(compareComments);
    if (order === 'balanced') return copy.sort(compareBalanced);
    if (order === 'longest') return copy.sort((a, b) => compareVideoLength(a, b, 'desc'));
    if (order === 'shortest') return copy.sort((a, b) => compareVideoLength(a, b, 'asc'));
    return copy.sort(compareNewest);
  }, [filteredItems, order]);

  const navigationItems = useMemo(() => {
    if (activePost?.type === 'video') {
      const videosOnly = displayItems.filter((item) => item.type === 'video');
      if (videosOnly.length > 0) return videosOnly;
    }
    return displayItems;
  }, [displayItems, activePost]);

  const activeIndex = useMemo(() => {
    if (!activePost) return -1;
    return navigationItems.findIndex((item) => item.id === activePost.id);
  }, [navigationItems, activePost]);

  const nextVideoToPrebuffer = useMemo(() => {
    if (!activePost || activePost.type !== 'video' || navigationItems.length < 2 || activeIndex < 0) return null;

    const nextIndex = (activeIndex + 1) % navigationItems.length;
    const nextPost = navigationItems[nextIndex];
    if (!nextPost || nextPost.type !== 'video') return null;

    return { url: nextPost.videoUrl || nextPost.mediaUrl || null, hlsUrl: nextPost.videoHlsUrl || null, dashUrl: nextPost.videoDashUrl || null };
  }, [activePost, navigationItems, activeIndex]);

  const filteredDirectory = useMemo(() => {
    const query = nsfwQuery.trim().toLowerCase();
    const visibleDirectory = NSFW_DIRECTORY.map((section) => ({
      ...section,
      items: section.items.filter((name) => !hiddenSubredditSet.has(name.toLowerCase()))
    })).filter((section) => section.items.length > 0);

    if (!query) return visibleDirectory;

    return visibleDirectory
      .map((section) => ({
        ...section,
        items: section.items.filter((name) => name.toLowerCase().includes(query) || section.category.toLowerCase().includes(query))
      }))
      .filter((section) => section.items.length > 0);
  }, [nsfwQuery, hiddenSubredditSet]);

  const currentAfter = source === 'simpcity' && simpcityView === 'threads' ? simpcityThreadAfter : after;
  const activeSectionSlug = simpcityFilters.section;

  function openPreviousPost() {
    if (activeIndex < 0 || navigationItems.length === 0) return;
    const nextIndex = (activeIndex - 1 + navigationItems.length) % navigationItems.length;
    setActivePost(navigationItems[nextIndex]);
  }

  function openNextPost() {
    if (activeIndex < 0 || navigationItems.length === 0) return;
    const nextIndex = (activeIndex + 1) % navigationItems.length;
    setActivePost(navigationItems[nextIndex]);
  }

  function openFirstPost() {
    if (navigationItems.length === 0) return;
    setActivePost(navigationItems[0]);
  }

  function openLastPost() {
    if (navigationItems.length === 0) return;
    setActivePost(navigationItems[navigationItems.length - 1]);
  }

  function toggleActivePost(post) {
    setActivePost((current) => (current?.id === post.id ? null : post));
  }

  useEffect(() => {
    if (!activePost) return;
    if (!displayItems.some((item) => item.id === activePost.id)) {
      setActivePost(null);
    }
  }, [displayItems, activePost]);

  const handleLoadMore = useCallback(async () => {
    if (!currentAfter || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      if (source === 'reddit') {
        if (authorView?.source === 'reddit') {
          const data = await fetchRedditUserMedia({ username: authorView.username, sort, includeNsfw, after: currentAfter, limit: MEDIA_PAGE_SIZE_REDDIT });
          setItems((prev) => [...prev, ...(data.items || [])]);
          setAfter(data.after || null);
        } else {
          const data = await fetchSubredditMedia({
            subreddit,
            sort,
            includeNsfw,
            after: currentAfter,
            limit: MEDIA_PAGE_SIZE_REDDIT,
            timeRange: redditFilters.timeRange,
            keyword: redditFilters.keyword,
            includeTerms: redditFilters.includeTerms,
            excludeTerms: redditFilters.excludeTerms,
            flair: redditFilters.flair,
            minScore: redditFilters.minScore,
            onlyRedditHosted: redditFilters.onlyRedditHosted,
            searchScope: redditFilters.searchScope
          });
          setItems((prev) => [...prev, ...(data.items || [])]);
          setAfter(data.after || null);
          setRedditAvailableFlairs(data.availableFlairs || []);
        }
      } else if (source === 'instagram') {
        const targetUser = authorView?.source === 'instagram' ? authorView.username : instagramUsername;
        const data = await fetchInstagramMedia({ username: targetUser, after: currentAfter, limit: MEDIA_PAGE_SIZE_IG });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (source === 'library') {
        const mediaType = toLibraryMediaType(mediaFilter);
        const data = await fetchMediaSearch({
          search: librarySearch,
          creator: libraryFilters.creator,
          tag: libraryFilters.tag,
          type: mediaType,
          sort: librarySort,
          after: currentAfter,
          limit: MEDIA_PAGE_SIZE_LIBRARY
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (simpcityView === 'threads') {
        const data = await fetchSimpcityThreads({
          category: simpcityFilters.category,
          section: simpcityFilters.section,
          tag: simpcityFilters.tag,
          creator: simpcityFilters.creator,
          author: simpcityFilters.author,
          search: simpcitySearch,
          after: currentAfter,
          limit: THREAD_PAGE_SIZE_SC
        });
        setSimpcityThreads((prev) => [...prev, ...(data.items || [])]);
        setSimpcityThreadAfter(data.after || null);
      } else {
        const data = await fetchIndexedSimpcityMedia({
          category: simpcityFilters.category,
          section: simpcityFilters.section,
          tag: simpcityFilters.tag,
          creator: simpcityFilters.creator,
          author: simpcityFilters.author,
          search: simpcitySearch,
          mediaType: toSimpcityMediaType(mediaFilter),
          sourceHost: simpcityFilters.sourceHost,
          after: currentAfter,
          limit: MEDIA_PAGE_SIZE_SC
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }, [
    currentAfter,
    loadingMore,
    source,
    authorView,
    sort,
    includeNsfw,
    subreddit,
    redditFilters,
    instagramUsername,
    simpcityView,
    simpcityFilters,
    simpcitySearch,
    librarySearch,
    libraryFilters,
    librarySort,
    mediaFilter
  ]);

  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node || !currentAfter || loading || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: LOAD_MORE_ROOT_MARGIN, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [currentAfter, loading, loadingMore, handleLoadMore]);

  function handleSubmit(event) {
    event.preventDefault();
    setAuthorView(null);

    if (source === 'reddit') {
      const next = redditInput.trim().replace(/^r\//i, '');
      if (!next) return;
      setRedditCategoryLabel('');
      setSubreddit(next);
      return;
    }

    if (source === 'instagram') {
      const nextIg = instagramInput.trim().replace(/^@/, '');
      if (!nextIg) return;
      setInstagramUsername(nextIg);
      return;
    }

    if (source === 'simpcity') {
      const nextSearch = simpcityInput.trim();
      if (!nextSearch) return;
      resetSimpcityThreadSelection();
      setSimpcitySearch(nextSearch);
      return;
    }

    setLibrarySearch(libraryInput.trim());
  }

  function handleInputChange(value) {
    if (source === 'reddit') {
      setRedditInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const next = value.trim().replace(/^r\//i, '');
        if (next) {
          setAuthorView(null);
          setRedditCategoryLabel('');
          setSubreddit(next);
        }
      }, 700);
      return;
    }

    if (source === 'instagram') {
      setInstagramInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const next = value.trim().replace(/^@/, '');
        if (next) {
          setAuthorView(null);
          setInstagramUsername(next);
        }
      }, 700);
      return;
    }

    if (source === 'simpcity') {
      setSimpcityInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const next = value.trim();
        setAuthorView(null);
        resetSimpcityThreadSelection();
        setSimpcitySearch(next);
      }, 700);
      return;
    }

    setLibraryInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setAuthorView(null);
      setLibrarySearch(value.trim());
    }, 400);
  }
  function handleRedditFilterChange(key, value) {
    setAuthorView(null);
    setRedditFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveRedditSearch() {
    const id = `${subreddit}|${JSON.stringify(redditFilters)}`;
    const label = makeSearchLabel(subreddit, redditFilters);
    setRedditSavedSearches((prev) => [{ id, label, subreddit, filters: redditFilters }, ...prev.filter((item) => item.id !== id)].slice(0, 12));
  }

  function applyRedditSearch(search) {
    setSource('reddit');
    setAuthorView(null);
    setRedditCategoryLabel('');
    setRedditInput(search.subreddit);
    setSubreddit(search.subreddit);
    setRedditFilters(search.filters);
  }

  function removeRedditSearch(id) {
    setRedditSavedSearches((prev) => prev.filter((item) => item.id !== id));
  }

  function removeRecentRedditSearch(id) {
    setRedditRecentSearches((prev) => prev.filter((item) => item.id !== id));
  }

  const visibleTopPicks = useMemo(() => NSFW_TOP_PICKS.filter((name) => !hiddenSubredditSet.has(name.toLowerCase())), [hiddenSubredditSet]);
  const activeRedditDirectorySection = useMemo(
    () => findDirectorySection(redditCategoryLabel, subreddit),
    [redditCategoryLabel, subreddit]
  );
  const redditSpotlightItems = useMemo(() => {
    if (activeRedditDirectorySection?.items?.length) {
      return activeRedditDirectorySection.items.filter((name) => !hiddenSubredditSet.has(name.toLowerCase()));
    }
    return visibleTopPicks.slice(0, 12);
  }, [activeRedditDirectorySection, hiddenSubredditSet, visibleTopPicks]);
  const redditCategoryStrip = useMemo(() => filteredDirectory.slice(0, 10), [filteredDirectory]);
  const redditFeedLabel = authorView?.source === 'reddit'
    ? `u/${authorView.username}`
    : redditCategoryLabel
      ? `${redditCategoryLabel} category`
      : `r/${subreddit}`;
  const redditSpotlightLabel = authorView?.source === 'reddit'
    ? `More from u/${authorView.username}`
    : activeRedditDirectorySection?.category
      ? `${activeRedditDirectorySection.category} lane`
      : 'Quick subreddit strip';

  const redditSummaryItems = useMemo(() => ([
    buildSummaryItem('Feed', redditFeedLabel),
    buildSummaryItem('Sort', sort),
    buildSummaryItem('Order', order),
    buildSummaryItem('Keyword', redditFilters.keyword),
    buildSummaryItem('Flair', redditFilters.flair),
    redditFilters.onlyRedditHosted ? { label: 'Host', value: 'Reddit only' } : null,
    redditFilters.minScore ? { label: 'Min score', value: String(redditFilters.minScore) } : null
  ].filter(Boolean)), [redditFeedLabel, sort, order, redditFilters]);

  const simpcitySummaryItems = useMemo(() => ([
    buildSummaryItem('Mode', simpcityView),
    buildSummaryItem('Search', simpcitySearch),
    buildSummaryItem('Section', simpcityFilters.section),
    buildSummaryItem('Creator', simpcityFilters.creator),
    buildSummaryItem('Tag', simpcityFilters.tag),
    buildSummaryItem('Host', simpcityFilters.sourceHost),
    mediaFilter !== 'all' ? { label: 'Media', value: mediaFilter } : null
  ].filter(Boolean)), [simpcityView, simpcitySearch, simpcityFilters, mediaFilter]);

  const librarySummaryItems = useMemo(() => ([
    buildSummaryItem('Keyword', librarySearch),
    buildSummaryItem('Creator', getLibraryCreatorLabel(selectedLibraryCreator)),
    buildSummaryItem('Service', libraryFilters.tag),
    buildSummaryItem('Media', mediaFilter !== 'all' ? mediaFilter : ''),
    buildSummaryItem('Sort', librarySort)
  ].filter(Boolean)), [librarySearch, selectedLibraryCreator, libraryFilters.tag, mediaFilter, librarySort]);

  const overviewTitle = source === 'reddit'
    ? redditFeedLabel
    : source === 'simpcity'
      ? (simpcityView === 'threads' ? 'SimpCity thread explorer' : 'SimpCity media explorer')
      : source === 'library'
        ? 'Coomer discovery'
        : `@${instagramUsername}`;

  const overviewSubtitle = source === 'reddit'
    ? 'Fast feed pivots, saved presets, and directory-first subreddit navigation.'
    : source === 'simpcity'
      ? 'Search creators, sections, tags, and hosts from the indexed forum crawl without losing context.'
      : source === 'library'
        ? 'Keyword-first creator discovery with service and media-type narrowing.'
        : 'Profile-first browsing for Instagram media.';

  const overviewMetrics = source === 'simpcity'
    ? [
        { label: 'Indexed threads', value: String(simpcityStats?.thread_count || 0) },
        { label: 'Indexed media', value: String(simpcityStats?.media_count || 0) },
        { label: simpcityView === 'threads' ? 'Visible threads' : 'Visible media', value: String(simpcityView === 'threads' ? simpcityThreads.length : displayItems.length) }
      ]
    : source === 'library'
      ? [
          { label: 'Visible media', value: String(displayItems.length) },
          { label: 'Creators', value: String(filteredLibraryCreators.length) },
          { label: 'Services', value: String(filteredLibraryTags.length) }
        ]
      : source === 'reddit'
        ? [
            { label: 'Visible media', value: String(displayItems.length) },
            { label: 'Directory sections', value: String(filteredDirectory.length) },
            { label: 'Top picks', value: String(visibleTopPicks.length) }
          ]
        : [{ label: 'Visible media', value: String(displayItems.length) }];

  function resetRedditDiscovery() {
    setAuthorView(null);
    setRedditCategoryLabel('');
    if (subreddit.includes('+')) {
      setRedditInput('nsfw');
      setSubreddit('nsfw');
    }
    setRedditFilters(DEFAULT_REDDIT_FILTERS);
    setNsfwQuery('');
  }

  function resetSimpcityDiscovery() {
    setAuthorView(null);
    setSimpcityInput('');
    setSimpcitySearch('');
    setSimpcityView('media');
    setSimpcityCreatorQuery('');
    setSimpcityTagQuery('');
    setSimpcityHostQuery('');
    setSimpcitySectionQuery('');
    updateSimpcityFilters({ ...DEFAULT_SIMPCITY_FILTERS }, { switchToMedia: true });
  }

  function handlePickNsfwSubreddit(name) {
    setSource('reddit');
    setAuthorView(null);
    setIncludeNsfw(true);
    setRedditCategoryLabel('');
    setRedditInput(name);
    setSubreddit(name);
  }

  function handlePickNsfwCategory(categoryName, itemsInCategory) {
    if (!Array.isArray(itemsInCategory) || itemsInCategory.length === 0) return;
    const multireddit = itemsInCategory.join('+');
    setSource('reddit');
    setAuthorView(null);
    setIncludeNsfw(true);
    setRedditCategoryLabel(categoryName || 'Category');
    setRedditInput('');
    setSubreddit(multireddit);
  }

  function addToQueue(post) {
    const url = post.videoUrl || post.mediaUrl;
    if (!url) return;
    setDownloadQueue((prev) => {
      if (prev.find((item) => item.url === url)) return prev;
      const next = [...prev, { id: post.id, title: post.title, url, type: post.type, addedAt: Date.now() }];
      localStorage.setItem('nightfeed:download-queue', JSON.stringify(next));
      return next;
    });
  }

  function removeFromQueue(url) {
    setDownloadQueue((prev) => {
      const next = prev.filter((item) => item.url !== url);
      localStorage.setItem('nightfeed:download-queue', JSON.stringify(next));
      return next;
    });
  }

  function handleOpenAuthorGallery(postItem) {
    if (!postItem?.author) return;

    if (postItem.source === 'instagram') {
      setSource('instagram');
      setAuthorView({ source: 'instagram', username: postItem.author });
      setInstagramInput(postItem.author);
      setInstagramUsername(postItem.author);
      setActivePost(null);
      return;
    }

    if (postItem.source === 'simpcity') {
      setSource('simpcity');
      setSimpcityInput(postItem.creator || postItem.author);
      setSimpcitySearch(postItem.creator || postItem.author);
      updateSimpcityFilters({ creator: postItem.creatorSlug || '', author: '', tag: '', sourceHost: '' }, { switchToMedia: true });
      setActivePost(null);
      return;
    }

    if (postItem.source === 'library') {
      setSource('library');
      setLibraryInput(postItem.creator || postItem.author);
      setLibrarySearch(postItem.creator || postItem.author);
      updateLibraryFilters({ creator: postItem.creatorId || '', tag: postItem.service || '' });
      setActivePost(null);
      return;
    }

    setSource('reddit');
    setAuthorView({ source: 'reddit', username: postItem.author });
    setIncludeNsfw(true);
    setActivePost(null);
  }

  function handleOpenSimpcityThread(thread) {
    setSimpcitySelectedThread(thread);
  }

  const activeSimpcityThread = simpcityThreadDetail?.thread || simpcitySelectedThread;
  return (
    <div className={`app-shell ${feedMode ? 'feed-mode' : ''}`}>
      <div className={`header-shell ${isHeaderCollapsed ? 'collapsed-header' : ''}`}>
        <div className="header-layer header-layer-expanded">
          <header className="hero">
            <div className="hero-copy">
              <span className="eyebrow">Media discovery</span>
              <h1>Nightfeed</h1>
              <p>A quieter, cleaner way to scan Reddit, Instagram, and indexed SimpCity threads for images, galleries, and preview-friendly video.</p>
            </div>
          </header>

          <SearchControls
            collapsed={false}
            source={source}
            inputValue={source === 'reddit' ? (redditCategoryLabel ? '' : redditInput) : source === 'instagram' ? instagramInput : source === 'simpcity' ? simpcityInput : libraryInput}
            sort={activeSort}
            mediaFilter={mediaFilter}
            simpcityView={simpcityView}
            includeNsfw={includeNsfw}
            order={order}
            redditFilters={redditFilters}
            redditAvailableFlairs={redditAvailableFlairs}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex < feedHistory.length - 1}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            onSourceChange={(nextSource) => {
              setAuthorView(null);
              if (nextSource === 'library') {
                setMediaFilter('all');
              }
              setSource(nextSource);
            }}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onSortChange={source === 'library' ? setLibrarySort : setSort}
            onMediaFilterChange={setMediaFilter}
            onSimpcityViewChange={(nextView) => {
              setSimpcityView(nextView);
              resetSimpcityThreadSelection();
            }}
            onNsfwToggle={setIncludeNsfw}
            onOrderChange={setOrder}
            onRedditFilterChange={handleRedditFilterChange}
          />
        </div>

        <div className="header-layer header-layer-compact">
          <SearchControls
            collapsed
            source={source}
            inputValue={source === 'reddit' ? (redditCategoryLabel ? '' : redditInput) : source === 'instagram' ? instagramInput : source === 'simpcity' ? simpcityInput : libraryInput}
            sort={activeSort}
            mediaFilter={mediaFilter}
            simpcityView={simpcityView}
            includeNsfw={includeNsfw}
            order={order}
            redditFilters={redditFilters}
            redditAvailableFlairs={redditAvailableFlairs}
            canGoBack={historyIndex > 0}
            canGoForward={historyIndex < feedHistory.length - 1}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            onSourceChange={(nextSource) => {
              setAuthorView(null);
              if (nextSource === 'library') {
                setMediaFilter('all');
              }
              setSource(nextSource);
            }}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onSortChange={source === 'library' ? setLibrarySort : setSort}
            onMediaFilterChange={setMediaFilter}
            onSimpcityViewChange={(nextView) => {
              setSimpcityView(nextView);
              resetSimpcityThreadSelection();
            }}
            onNsfwToggle={setIncludeNsfw}
            onOrderChange={setOrder}
            onRedditFilterChange={handleRedditFilterChange}
          />
        </div>
      </div>
      <div className="header-spacer" aria-hidden="true" />

      {authorView && (
        <div className="state-box">
          Viewing creator gallery: {authorView.source === 'instagram' ? '@' : authorView.source === 'library' ? '' : 'u/'}{authorView.username}
          <button type="button" className="load-more" onClick={() => setAuthorView(null)} style={{ marginLeft: '10px' }}>
            Back to feed
          </button>
        </div>
      )}

      {source === 'reddit' && (
        <section className="top-discovery-shell" aria-label="Reddit discovery strip">
          <div className="top-discovery-card top-discovery-card-spotlight">
            <div className="top-discovery-head">
              <div>
                <p className="modal-kicker">Subreddit strip</p>
                <h3>{redditSpotlightLabel}</h3>
                <p>
                  {activeRedditDirectorySection?.category
                    ? 'Stay in the same pocket while moving between related subreddits.'
                    : 'Jump into frequent high-volume feeds without pushing long strings into the search bar.'}
                </p>
              </div>
              {redditCategoryLabel ? (
                <button type="button" className="ghost-button ghost-button-small" onClick={resetRedditDiscovery}>
                  Clear lane
                </button>
              ) : null}
            </div>
            <div className="top-discovery-chip-row">
              {redditSpotlightItems.map((name) => (
                <button
                  key={`spotlight-${name}`}
                  type="button"
                  className={`top-strip-chip ${subreddit.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
                  onClick={() => handlePickNsfwSubreddit(name)}
                >
                  <span className="top-strip-chip-label">r/{name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="top-discovery-card top-discovery-card-categories">
            <div className="top-discovery-head">
              <div>
                <p className="modal-kicker">Category lanes</p>
                <h3>Browse by cluster</h3>
                <p>Open a full category feed from the top bar, then use the left rail for deeper cuts.</p>
              </div>
            </div>
            <div className="top-discovery-chip-row top-discovery-chip-row-categories">
              {redditCategoryStrip.map((section) => {
                const isActive = redditCategoryLabel === section.category;
                return (
                  <button
                    key={`category-${section.category}`}
                    type="button"
                    className={`top-strip-chip top-strip-chip-category ${isActive ? 'active' : ''}`}
                    onClick={() => handlePickNsfwCategory(section.category, section.items)}
                  >
                    <span className="top-strip-chip-label">{section.category}</span>
                    <span className="top-strip-chip-meta">{section.items.length} subs</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        className={`feed-toggle-btn ${feedMode ? 'active' : ''}`}
        onClick={() => setFeedMode((v) => !v)}
        title={feedMode ? 'Exit feed mode' : 'Enter feed mode'}
      >
        {feedMode ? '⊠ Exit feed' : '⊞ Feed mode'}
      </button>

      {feedMode ? (
        <FeedView
          items={displayItems}
          onLoadMore={handleLoadMore}
          hasMore={Boolean(currentAfter)}
          loadingMore={loadingMore}
          onOpenAuthorGallery={handleOpenAuthorGallery}
          onOpenLightbox={setActivePost}
          onExit={() => setFeedMode(false)}
        />
      ) : (
      <div className={`content-layout ${source === 'instagram' ? 'instagram-layout' : ''} ${source === 'reddit' ? 'reddit-layout' : ''} ${source === 'simpcity' ? 'simpcity-layout' : ''} ${source === 'library' ? 'library-layout' : ''}`}>
        {source === 'reddit' && (
          <aside className="sidebar-rail sidebar-rail-left">
            <section className="sidebar-card directory-sidebar">
              <div className="sidebar-section-head">
                <div>
                  <h3>Reddit explorer</h3>
                  <p>Start broad with categories, then snap into a specific subreddit or saved path.</p>
                </div>
                <button type="button" className="ghost-button ghost-button-small" onClick={resetRedditDiscovery}>
                  Reset
                </button>
              </div>
              <div className="sidebar-stat-row">
                <div className="sidebar-stat-pill"><span>Categories</span><strong>{filteredDirectory.length}</strong></div>
                <div className="sidebar-stat-pill"><span>Top picks</span><strong>{visibleTopPicks.length}</strong></div>
              </div>
              <input
                className="directory-search"
                type="text"
                placeholder="Filter categories or subreddits"
                value={nsfwQuery}
                onChange={(event) => setNsfwQuery(event.target.value)}
              />

              <div className="shortcut-list compact-shortcut-list">
                {visibleTopPicks.slice(0, 6).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`shortcut-chip ${subreddit.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
                    onClick={() => handlePickNsfwSubreddit(name)}
                  >
                    <span>r/{name}</span>
                  </button>
                ))}
              </div>

              <div className="directory-sections">
                {filteredDirectory.map((section) => {
                  const categoryFeed = section.items.join('+');
                  const isCategoryActive = subreddit.toLowerCase() === categoryFeed.toLowerCase();

                  return (
                    <details key={section.category} open={nsfwQuery.length > 0 || isCategoryActive}>
                      <summary>
                        <button
                          type="button"
                          className={`directory-category-btn ${isCategoryActive ? 'active' : ''}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handlePickNsfwCategory(section.category, section.items);
                          }}
                        >
                          {section.category}
                        </button>
                      </summary>
                      <div className="nsfw-list">
                        {section.items.map((name) => (
                          <button
                            key={`${section.category}-${name}`}
                            type="button"
                            className={`nsfw-chip ${subreddit.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
                            onClick={() => handlePickNsfwSubreddit(name)}
                          >
                            r/{name}
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </aside>
        )}

        {source === 'simpcity' && (
          <aside className="sidebar-rail sidebar-rail-left">
            <section className="sidebar-card simpcity-nav-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>SimpCity explorer</h3>
                  <p>Move between sections, creators, and media without losing your place in the index.</p>
                </div>
                <button type="button" className="ghost-button ghost-button-small" onClick={resetSimpcityDiscovery}>
                  Reset
                </button>
              </div>

              <div className="sidebar-stat-row">
                <div className="sidebar-stat-pill"><span>Threads</span><strong>{simpcityStats?.thread_count || 0}</strong></div>
                <div className="sidebar-stat-pill"><span>Media</span><strong>{simpcityStats?.media_count || 0}</strong></div>
                <div className="sidebar-stat-pill"><span>Sections</span><strong>{simpcitySidebar.reduce((total, category) => total + (category.sections?.length || 0), 0)}</strong></div>
              </div>

              <input
                className="directory-search"
                type="text"
                value={simpcitySectionQuery}
                placeholder="Filter sections or categories"
                onChange={(event) => setSimpcitySectionQuery(event.target.value)}
              />

              <div className="simpcity-nav-actions">
                <button
                  type="button"
                  className={`shortcut-chip shortcut-chip-wide ${!simpcityFilters.section && !simpcityFilters.tag && !simpcityFilters.creator && !simpcityFilters.author && !simpcityFilters.sourceHost ? 'active' : ''}`}
                  onClick={() => {
                    updateSimpcityFilters({ ...DEFAULT_SIMPCITY_FILTERS }, { switchToMedia: true });
                  }}
                >
                  <span>All indexed media</span>
                </button>
                <button
                  type="button"
                  className={`shortcut-chip shortcut-chip-wide ${simpcityView === 'threads' ? 'active' : ''}`}
                  onClick={() => {
                    setSimpcityView('threads');
                    resetSimpcityThreadSelection();
                  }}
                >
                  <span>Browse threads</span>
                </button>
              </div>

              <div className="directory-sections simpcity-sections">
                {filteredSimpcitySidebar.map((category) => {
                  const isCategoryOpen = category.name === simpcityFilters.category || category.sections.some((section) => section.slug === activeSectionSlug);

                  return (
                    <details key={category.slug} open={isCategoryOpen}>
                      <summary>
                        <div className="directory-category-btn simpcity-category-title">{category.name}</div>
                      </summary>
                      <div className="nsfw-list simpcity-section-list">
                        {category.sections.map((section) => (
                          <button
                            key={section.slug}
                            type="button"
                            className={`nsfw-chip simpcity-section-chip ${activeSectionSlug === section.slug ? 'active' : ''}`}
                            onClick={() => {
                              updateSimpcityFilters(
                                {
                                  category: category.name,
                                  section: section.slug,
                                  tag: '',
                                  creator: '',
                                  author: '',
                                  sourceHost: ''
                                },
                                { switchToMedia: true }
                              );
                            }}
                          >
                            <span>{section.name}</span>
                            <span className="simpcity-count">{section.threadCount || 0}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </aside>
        )}


        {source === 'library' && (
          <aside className="sidebar-rail sidebar-rail-left">
            <section className="sidebar-card library-directory-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Coomer Directory</h3>
                  <p>Refine one live result set by media type, creator, and service instead of jumping between pages.</p>
                </div>
                <button type="button" className="ghost-button ghost-button-small" onClick={resetLibraryDiscovery}>
                  Reset
                </button>
              </div>
              <div className="sidebar-stat-row">
                <div className="sidebar-stat-pill"><span>Creators</span><strong>{filteredLibraryCreators.length}</strong></div>
                <div className="sidebar-stat-pill"><span>Services</span><strong>{filteredLibraryTags.length}</strong></div>
                <div className="sidebar-stat-pill"><span>Visible</span><strong>{displayItems.length}</strong></div>
              </div>
              <div className="simpcity-nav-actions">
                <button
                  type="button"
                  className={`shortcut-chip shortcut-chip-wide ${!libraryFilters.creator && !libraryFilters.tag && mediaFilter === 'all' ? 'active' : ''}`}
                  onClick={resetLibraryDiscovery}
                >
                  <span>All Coomer results</span>
                </button>
              </div>
              <div className="directory-sections">
                <details open>
                  <summary>
                    <div className="directory-category-btn library-category-title">Media Type</div>
                  </summary>
                  <div className="nsfw-list">
                    {[
                      { label: 'All media', value: 'all' },
                      { label: 'Images', value: 'images' },
                      { label: 'Videos', value: 'videos' },
                      { label: 'Audio', value: 'audio' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`nsfw-chip ${mediaFilter === option.value ? 'active' : ''}`}
                        onClick={() => setMediaFilter(option.value)}
                      >
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </details>
                <details open>
                  <summary>
                    <div className="directory-category-btn library-category-title">Creators</div>
                  </summary>
                  <div className="library-filter-head">
                    <input
                      className="directory-search"
                      type="text"
                      value={libraryCreatorQuery}
                      placeholder="Filter creators"
                      onChange={(event) => setLibraryCreatorQuery(event.target.value)}
                    />
                  </div>
                  <div className="nsfw-list">
                    {filteredLibraryCreators.slice(0, 18).map((creator) => (
                      <button
                        key={`${creator.service}:${creator.id}`}
                        type="button"
                        className={`nsfw-chip ${libraryFilters.creator === creator.id ? 'active' : ''}`}
                        onClick={() => updateLibraryFilters({ creator: libraryFilters.creator === creator.id ? '' : creator.id, tag: creator.service || libraryFilters.tag })}
                      >
                        <span>{getLibraryCreatorLabel(creator)}</span>
                        <span className="simpcity-count">{creator.count}</span>
                      </button>
                    ))}
                    {filteredLibraryCreators.length === 0 && <div className="sidebar-empty">No creators match this Coomer query.</div>}
                  </div>
                </details>
              </div>
            </section>
          </aside>
        )}

        <main className="content-main">
          {!loading && !error && (
            <section className="results-overview-card">
              <div className="results-overview-head">
                <div>
                  <p className="modal-kicker">Now exploring</p>
                  <h3>{overviewTitle}</h3>
                  <p>{overviewSubtitle}</p>
                </div>
                <div className="results-metric-row">
                  {overviewMetrics.map((metric) => (
                    <div key={metric.label} className="results-metric-pill">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {loading && <div className="state-box">Loading media...</div>}
          {!loading && error && <div className="state-box error">{error}</div>}
          {!loading && !error && source === 'simpcity' && simpcityStats?.thread_count > 0 && simpcityStats?.media_count === 0 && (
            <div className="state-box error">
              SimpCity thread pages are currently returning a guest login wall, so the index only has thread metadata. Add SIMPCITY_COOKIE in backend/.env from a normal logged-in browser session, then rerun the crawl to index thread media and Bunkr links.
            </div>
          )}
          {!loading && !error && source === 'simpcity' && simpcityView === 'threads' && simpcityThreads.length === 0 && (
            <div className="state-box">No indexed SimpCity threads found for this filter set.</div>
          )}
          {!loading && !error && (source !== 'simpcity' || simpcityView === 'media') && displayItems.length === 0 && (
            <div className="state-box">No media posts found for this query.</div>
          )}

          {source === 'simpcity' && simpcityView === 'threads' ? (
            <>
              <SimpcityThreadList items={simpcityThreads} activeThreadId={activeSimpcityThread?.id} onOpenThread={handleOpenSimpcityThread} />

              {simpcityThreadLoading && <div className="state-box subtle">Loading thread media...</div>}

              {simpcityThreadDetail?.media?.length > 0 && (
                <section className="simpcity-thread-media-panel">
                  <div className="simpcity-thread-panel-head">
                    <div>
                      <h3>{simpcityThreadDetail.thread.title}</h3>
                      <p>
                        {simpcityThreadDetail.thread.category} / {simpcityThreadDetail.thread.section}
                      </p>
                    </div>
                    <a className="modal-action-button modal-action-subtle simpcity-thread-open" href={simpcityThreadDetail.thread.permalink} target="_blank" rel="noreferrer">
                      Open thread
                    </a>
                  </div>
                  <GalleryGrid
                    items={displayItems}
                    activePost={activePost}
                    onOpen={toggleActivePost}
                    onCloseActive={() => setActivePost(null)}
                    onPrevPost={openPreviousPost}
                    onNextPost={openNextPost}
                    onOpenAuthorGallery={handleOpenAuthorGallery}
                    onAddToQueue={addToQueue}
                    canNavigate={navigationItems.length > 1}
                  />
                </section>
              )}
            </>
          ) : (
            <GalleryGrid
              items={displayItems}
              activePost={activePost}
              onOpen={toggleActivePost}
              onCloseActive={() => setActivePost(null)}
              onPrevPost={openPreviousPost}
              onNextPost={openNextPost}
              onOpenAuthorGallery={handleOpenAuthorGallery}
              onAddToQueue={addToQueue}
              canNavigate={navigationItems.length > 1}
            />
          )}

          {!loading && currentAfter && <div ref={loadMoreSentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />}
          {!loading && loadingMore && <div className="state-box subtle">Loading more {source === 'simpcity' && simpcityView === 'threads' ? 'threads' : 'media'}...</div>}
        </main>

        {source === 'reddit' && (
          <aside className="sidebar-rail sidebar-rail-right">
            <FilterSummaryCard
              title="Current feed"
              subtitle="Your active Reddit query and refinements."
              items={redditSummaryItems}
              onClearAll={resetRedditDiscovery}
              emptyLabel="Pick a subreddit or category to start exploring."
            />
            <section className="sidebar-card saved-searches-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Saved searches</h3>
                  <p>Reusable feed presets for Reddit.</p>
                </div>
                <button type="button" className="ghost-button ghost-button-small" onClick={handleSaveRedditSearch}>
                  Save current
                </button>
              </div>
              {redditSavedSearches.length > 0 ? (
                <div className="shortcut-list shortcut-list-spacious">
                  {redditSavedSearches.map((item) => (
                    <div key={item.id} className="shortcut-row">
                      <button type="button" className="shortcut-chip shortcut-chip-wide" onClick={() => applyRedditSearch(item)}>
                        <span>{item.label}</span>
                      </button>
                      <button type="button" className="chip-dismiss" onClick={() => removeRedditSearch(item.id)} aria-label={`Remove ${item.label}`}>
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sidebar-empty">Save a Reddit search to keep it one click away.</div>
              )}
            </section>

            <section className="sidebar-card recent-searches-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Recent</h3>
                  <p>Quickly return to the last feeds you opened.</p>
                </div>
              </div>
              {redditRecentSearches.length > 0 ? (
                <div className="shortcut-list shortcut-list-spacious">
                  {redditRecentSearches.map((item) => (
                    <div key={item.id} className="shortcut-row">
                      <button type="button" className="shortcut-chip shortcut-chip-wide" onClick={() => applyRedditSearch(item)}>
                        <span>{item.label}</span>
                      </button>
                      <button type="button" className="chip-dismiss" onClick={() => removeRecentRedditSearch(item.id)} aria-label={`Remove ${item.label}`}>
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sidebar-empty">Recent feed states will appear here.</div>
              )}
            </section>

            <section className="sidebar-card download-queue-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Download queue</h3>
                  <p>{downloadQueue.length} item{downloadQueue.length !== 1 ? 's' : ''}</p>
                </div>
                {downloadQueue.length > 0 && (
                  <button
                    type="button"
                    className="ghost-button ghost-button-small"
                    onClick={() => navigator.clipboard.writeText(downloadQueue.map((i) => i.url).join('\n'))}
                  >
                    Copy all URLs
                  </button>
                )}
              </div>
              {downloadQueue.length === 0 ? (
                <div className="sidebar-empty">Save media URLs to copy them in bulk.</div>
              ) : (
                <div className="shortcut-list shortcut-list-spacious">
                  {downloadQueue.map((item) => (
                    <div key={item.url} className="shortcut-row">
                      <span className="shortcut-chip shortcut-chip-wide" title={item.url}>
                        <span>{item.title?.substring(0, 28) || 'Media'}</span>
                      </span>
                      <button type="button" className="chip-dismiss" onClick={() => removeFromQueue(item.url)} aria-label="Remove">
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        )}

        {source === 'simpcity' && (
          <aside className="sidebar-rail sidebar-rail-right">
            <FilterSummaryCard
              title="Active index filters"
              subtitle="The current SimpCity discovery state applied to the feed."
              items={simpcitySummaryItems}
              onClearAll={resetSimpcityDiscovery}
              emptyLabel="Use creators, tags, hosts, or sections to narrow the index."
            />
            <section className="sidebar-card simpcity-quick-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Refine the index</h3>
                  <p>Use local finder boxes to cut large tag, host, and creator lists down fast.</p>
                </div>
              </div>

              <div className="simpcity-filter-block">
                <div className="simpcity-filter-head">
                  <span>Creators</span>
                  {simpcityFilters.creator && (
                    <button type="button" className="text-button" onClick={() => updateSimpcityFilters({ creator: '' }, { switchToMedia: true })}>
                      Clear
                    </button>
                  )}
                </div>
                <input
                  className="directory-search"
                  type="text"
                  value={simpcityCreatorQuery}
                  placeholder="Find creators or aliases"
                  onChange={(event) => setSimpcityCreatorQuery(event.target.value)}
                />
                <div className="shortcut-list simpcity-tag-list">
                  {filteredSimpcityCreators.slice(0, 18).map((creator) => (
                    <button
                      key={creator.slug}
                      type="button"
                      className={`shortcut-chip ${simpcityFilters.creator === creator.slug ? 'active' : ''}`}
                      onClick={() => updateSimpcityFilters({ creator: simpcityFilters.creator === creator.slug ? '' : creator.slug }, { switchToMedia: true })}
                    >
                      <span>{creator.name}</span>
                      <span className="simpcity-count">{creator.mediaCount || creator.threadCount}</span>
                    </button>
                  ))}
                  {filteredSimpcityCreators.length === 0 && <div className="sidebar-empty">No creators matched this SimpCity search yet.</div>}
                </div>
              </div>

              <div className="simpcity-filter-block">
                <div className="simpcity-filter-head">
                  <span>Hosts</span>
                  {simpcityFilters.sourceHost && (
                    <button type="button" className="text-button" onClick={() => updateSimpcityFilters({ sourceHost: '' }, { switchToMedia: true })}>
                      Clear
                    </button>
                  )}
                </div>
                <input
                  className="directory-search"
                  type="text"
                  value={simpcityHostQuery}
                  placeholder="Filter hosts"
                  onChange={(event) => setSimpcityHostQuery(event.target.value)}
                />
                <div className="shortcut-list">
                  {filteredSimpcityHosts.slice(0, 8).map((host) => (
                    <button
                      key={host.host}
                      type="button"
                      className={`shortcut-chip ${simpcityFilters.sourceHost === host.host ? 'active' : ''}`}
                      onClick={() => updateSimpcityFilters({ sourceHost: simpcityFilters.sourceHost === host.host ? '' : host.host }, { switchToMedia: true })}
                    >
                      <span>{host.host}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="simpcity-filter-block">
                <div className="simpcity-filter-head">
                  <span>Tags</span>
                  {simpcityFilters.tag && (
                    <button type="button" className="text-button" onClick={() => updateSimpcityFilters({ tag: '' }, { switchToMedia: true })}>
                      Clear
                    </button>
                  )}
                </div>
                <input
                  className="directory-search"
                  type="text"
                  value={simpcityTagQuery}
                  placeholder="Filter tags"
                  onChange={(event) => setSimpcityTagQuery(event.target.value)}
                />
                <div className="shortcut-list simpcity-tag-list">
                  {filteredSimpcityTags.slice(0, 18).map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      className={`shortcut-chip ${simpcityFilters.tag === tag.slug ? 'active' : ''}`}
                      onClick={() => updateSimpcityFilters({ tag: simpcityFilters.tag === tag.slug ? '' : tag.slug }, { switchToMedia: true })}
                    >
                      <span>{tag.name}</span>
                    </button>
                  ))}
                  {filteredSimpcityTags.length === 0 && <div className="sidebar-empty">No tags matched this SimpCity search yet.</div>}
                </div>
              </div>
            </section>

            <section className="sidebar-card simpcity-thread-card-panel">
              <div className="sidebar-section-head">
                <div>
                  <h3>Thread detail</h3>
                  <p>Inspect the currently selected thread and its extracted media.</p>
                </div>
              </div>

              {activeSimpcityThread ? (
                <div className="simpcity-thread-sidebar-copy">
                  <p className="modal-kicker">
                    {activeSimpcityThread.category || 'SimpCity'} / {activeSimpcityThread.section || 'Thread'}
                  </p>
                  <h4>{activeSimpcityThread.title}</h4>
                  <p className="meta-line">Creator: {activeSimpcityThread.creator || activeSimpcityThread.author || 'simpcity'}</p>
                  <p className="meta-line">Forum poster: {activeSimpcityThread.threadAuthor || 'simpcity'}</p>
                  <p className="meta-line meta-line-secondary">
                    {activeSimpcityThread.mediaCount || simpcityThreadDetail?.media?.length || 0} media - {activeSimpcityThread.replyCount || 0} replies
                  </p>
                  {simpcityThreadDetail?.tags?.length > 0 && (
                    <div className="meta-chip-row">
                      {simpcityThreadDetail.tags.slice(0, 8).map((tag) => (
                        <span key={tag.slug} className="meta-chip">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <a className="modal-action-button modal-action-primary" href={activeSimpcityThread.permalink} target="_blank" rel="noreferrer">
                    Open thread
                  </a>
                </div>
              ) : (
                <div className="sidebar-empty">Select a thread in Thread view to inspect its extracted media here.</div>
              )}
            </section>
          </aside>
        )}

        {source === 'library' && (
          <aside className="sidebar-rail sidebar-rail-right">
            <FilterSummaryCard
              title="Current discovery"
              subtitle="The active Coomer query and all applied filters."
              items={librarySummaryItems}
              onClearAll={resetLibraryDiscovery}
              emptyLabel="Search a keyword and then narrow it by creator or service."
            />
            <section className="sidebar-card top-picks-sidebar">
              <div className="sidebar-section-head">
                <div>
                  <h3>Services</h3>
                  <p>Filter the current Coomer query by platform.</p>
                </div>
              </div>
              <div className="library-filter-head library-filter-head-right">
                <input
                  className="directory-search"
                  type="text"
                  value={libraryTagQuery}
                  placeholder="Filter services"
                  onChange={(event) => setLibraryTagQuery(event.target.value)}
                />
              </div>
              <div className="shortcut-list">
                {filteredLibraryTags.slice(0, 12).map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    className={`shortcut-chip ${libraryFilters.tag === tag.name ? 'active' : ''}`}
                    onClick={() => updateLibraryFilters({ tag: libraryFilters.tag === tag.name ? '' : tag.name })}
                  >
                    <span>{tag.name}</span>
                    <span className="simpcity-count">{tag.count}</span>
                  </button>
                ))}
                {filteredLibraryTags.length === 0 && <div className="sidebar-empty">No services match this Coomer query.</div>}
              </div>
            </section>
            <section className="sidebar-card saved-searches-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Creator focus</h3>
                  <p>Quick jumps into the most active creators in the current Coomer result set.</p>
                </div>
              </div>
              <div className="shortcut-list shortcut-list-spacious">
                {filteredLibraryCreators.slice(0, 6).map((creator) => (
                  <button
                    key={`${creator.service}:${creator.id}`}
                    type="button"
                    className={`shortcut-chip shortcut-chip-wide ${libraryFilters.creator === creator.id ? 'active' : ''}`}
                    onClick={() => updateLibraryFilters({ creator: libraryFilters.creator === creator.id ? '' : creator.id, tag: creator.service || libraryFilters.tag })}
                  >
                    <span>{getLibraryCreatorLabel(creator)}</span>
                    <span className="simpcity-count">{creator.count}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="sidebar-card recent-searches-card">
              <div className="sidebar-section-head">
                <div>
                  <h3>Discovery state</h3>
                  <p>Live context for the Coomer feed in the center column.</p>
                </div>
              </div>
              <div className="simpcity-thread-sidebar-copy">
                <p className="modal-kicker">Coomer</p>
                <h4>{librarySearch || 'feet'}</h4>
                <p className="meta-line">Creator: {getLibraryCreatorLabel(selectedLibraryCreator) || 'Any creator'}</p>
                <p className="meta-line">Keyword: {librarySearch || 'None'}</p>
                <p className="meta-line">Service: {libraryFilters.tag || 'Any service'}</p>
                <p className="meta-line meta-line-secondary">Sort: {librarySort === 'popular' ? 'Popular' : 'Newest'}</p>
              </div>
            </section>
          </aside>
        )}
      </div>
      )}

    </div>
  );
}

export default App;


























