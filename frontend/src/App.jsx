
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import SubredditPillRow from './components/SubredditPillRow';
import CategoryPillRow from './components/CategoryPillRow';
import MediaGrid from './components/MediaGrid';
import Drawer from './components/Drawer';
import LightboxModal from './components/LightboxModal';
import SkeletonGrid from './components/SkeletonGrid';
import StateMessage from './components/StateMessage';
import ErrorBoundary from './components/ErrorBoundary';
import MediaTypeToggle from './components/MediaTypeToggle';
import RelatedSubsRow from './components/RelatedSubsRow';
import SourceToggle from './components/SourceToggle';
import AdvancedSearch, { DEFAULT_ADVANCED, QUALITY_THRESHOLDS, countActiveFilters } from './components/AdvancedSearch';
import ActiveFiltersStrip from './components/ActiveFiltersStrip';
import { ToastProvider, useToast } from './components/Toast';
import { useFavorites } from './hooks/useFavorites';
import { useSavedSubreddits } from './hooks/useSavedSubreddits';
import { useHiddenAuthors } from './hooks/useBlockList';
import { usePreferences } from './hooks/usePreferences';
import { getInitialUrlState, useSyncUrlState } from './hooks/useUrlState';
import {
  fetchRedditUserMedia,
  fetchSubredditMedia,
  fetchEpornerMedia,
  fetchYouTubeMedia,
  fetchCoomerMedia
} from './utils/api';

const LAST_SUBREDDIT_KEY = 'subreddit-media-viewer:last-subreddit';
const LAST_REDDIT_FILTERS_KEY = 'subreddit-media-viewer:last-reddit-filters';
const REDDIT_SAVED_SEARCHES_KEY = 'subreddit-media-viewer:reddit-saved-searches';
const REDDIT_RECENT_SEARCHES_KEY = 'subreddit-media-viewer:reddit-recent-searches';
const HIDDEN_SUBREDDITS_KEY = 'subreddit-media-viewer:hidden-subreddits';
const MEDIA_PAGE_SIZE = 48;

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

function parseStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function makeSearchLabel(subreddit, filters) {
  const parts = [subreddit];
  if (filters.keyword) parts.push(filters.keyword);
  if (filters.flair) parts.push(`flair:${filters.flair}`);
  if (filters.minScore) parts.push(`score>=${filters.minScore}`);
  if (filters.onlyRedditHosted) parts.push('hosted');
  return parts.join(' | ');
}

function compareScore(a, b) { return (b.score || 0) - (a.score || 0); }
function compareComments(a, b) { return (b.numComments || 0) - (a.numComments || 0); }
function compareNewest(a, b) { return (b.createdUtc || 0) - (a.createdUtc || 0); }
function compareOldest(a, b) { return (a.createdUtc || 0) - (b.createdUtc || 0); }

function compareBalanced(a, b) {
  const now = Date.now() / 1000;
  const scoreA = ((a.score || 0) + (a.numComments || 0) * 2) / Math.max(2, (now - (a.createdUtc || now)) / 3600);
  const scoreB = ((b.score || 0) + (b.numComments || 0) * 2) / Math.max(2, (now - (b.createdUtc || now)) / 3600);
  return scoreB - scoreA;
}

function compareVideoLength(a, b, direction) {
  const aLen = a.type === 'video' && Number.isFinite(a.videoDurationSec) ? a.videoDurationSec : null;
  const bLen = b.type === 'video' && Number.isFinite(b.videoDurationSec) ? b.videoDurationSec : null;
  if (aLen !== null && bLen !== null) return direction === 'desc' ? bLen - aLen : aLen - bLen;
  if (aLen !== null) return -1;
  if (bLen !== null) return 1;
  return compareNewest(a, b);
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

function serializeSnapshot(snapshot) { return JSON.stringify(snapshot); }

function createFeedSnapshot({ subreddit, authorView, sort, includeNsfw, mediaFilter, order, redditFilters }) {
  return { subreddit, authorView, sort, includeNsfw, mediaFilter, order, redditFilters };
}

function getInitialSubreddit() {
  const url = getInitialUrlState();
  if (url.r) return url.r;
  return localStorage.getItem(LAST_SUBREDDIT_KEY) || 'nsfw';
}

function getInitialFilters() {
  const url = getInitialUrlState();
  const stored = parseStoredJson(LAST_REDDIT_FILTERS_KEY, {});
  const merged = { ...DEFAULT_REDDIT_FILTERS, ...stored };
  if (url.kw !== undefined) merged.keyword = url.kw;
  if (url.inc !== undefined) merged.includeTerms = url.inc;
  if (url.exc !== undefined) merged.excludeTerms = url.exc;
  if (url.t !== undefined) merged.timeRange = url.t;
  if (url.scope !== undefined) merged.searchScope = url.scope;
  if (url.flair !== undefined) merged.flair = url.flair;
  if (url.score !== undefined) merged.minScore = Number(url.score) || 0;
  if (url.hosted === '1') merged.onlyRedditHosted = true;
  if (url.dup === '0') merged.suppressDuplicates = false;
  return merged;
}

function getInitialSort() {
  const url = getInitialUrlState();
  return url.sort || 'hot';
}

function getInitialMediaFilter() {
  const url = getInitialUrlState();
  if (url.media) return url.media;
  try {
    const stored = localStorage.getItem('subreddit-media-viewer:media-filter');
    if (stored) return stored;
  } catch {}
  return 'videos';
}

function getInitialOrder() {
  const url = getInitialUrlState();
  return url.order || 'newest';
}

const VALID_SOURCES = new Set(['reddit', 'eporner', 'youtube', 'coomer']);
const VALID_BOORU_SITES = new Set(['rule34', 'e621', 'gelbooru', 'safebooru']);

function getInitialSource() {
  const url = getInitialUrlState();
  if (VALID_SOURCES.has(url.src)) return url.src;
  try {
    const stored = localStorage.getItem('subreddit-media-viewer:source');
    if (VALID_SOURCES.has(stored)) return stored;
  } catch {}
  return 'reddit';
}

function getInitialBooruSite() {
  const url = getInitialUrlState();
  if (VALID_BOORU_SITES.has(url.bs)) return url.bs;
  try {
    const stored = localStorage.getItem('subreddit-media-viewer:booru-site');
    if (VALID_BOORU_SITES.has(stored)) return stored;
  } catch {}
  return 'safebooru';
}

function getInitialEpornerQuery() {
  const url = getInitialUrlState();
  if (url.eq) return url.eq;
  try {
    return localStorage.getItem('subreddit-media-viewer:eporner-query') || '';
  } catch {}
  return '';
}

function AppShell() {
  const toast = useToast();
  const { theme, setTheme, density, setDensity } = usePreferences();
  const { favorites, isFavorited, toggle: toggleFavorite, remove: removeFavorite, clearAll: clearFavorites } = useFavorites();
  const { saved: savedSubreddits, isSaved: isSubredditSaved, toggle: toggleSavedSubreddit, remove: removeSavedSubreddit } = useSavedSubreddits();
  const { hidden: hiddenAuthors, isHidden: isAuthorHidden, hide: hideAuthor, unhide: unhideAuthor } = useHiddenAuthors();
  const [durationMin, setDurationMin] = useState(null);
  const [durationMax, setDurationMax] = useState(null);
  const [source, setSource] = useState(getInitialSource);
  const [epornerQuery, setEpornerQuery] = useState(getInitialEpornerQuery);
  const [epornerOrder, setEpornerOrder] = useState('most-popular');
  const [booruSite, setBooruSite] = useState(getInitialBooruSite);
  const [booruQuery, setBooruQuery] = useState(() => {
    try { return localStorage.getItem('subreddit-media-viewer:booru-query') || ''; } catch { return ''; }
  });
  const [youtubeQuery, setYoutubeQuery] = useState(() => {
    try { return localStorage.getItem('subreddit-media-viewer:youtube-query') || 'asmr'; } catch { return 'asmr'; }
  });
  const [youtubeOrder, setYoutubeOrder] = useState('relevance');
  const [coomerQuery, setCoomerQuery] = useState(() => {
    try { return localStorage.getItem('subreddit-media-viewer:coomer-query') || 'feet'; } catch { return 'feet'; }
  });
  const [coomerSort, setCoomerSort] = useState('newest');
  const [blueskyQuery, setBlueskyQuery] = useState(() => {
    try { return localStorage.getItem('subreddit-media-viewer:bluesky-query') || 'feet'; } catch { return 'feet'; }
  });
  const [blueskySort, setBlueskySort] = useState('top');
  const [xvideosQuery, setXvideosQuery] = useState(() => {
    try { return localStorage.getItem('subreddit-media-viewer:xvideos-query') || 'feet'; } catch { return 'feet'; }
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState(() => {
    try {
      const stored = localStorage.getItem('subreddit-media-viewer:advanced');
      return stored ? { ...DEFAULT_ADVANCED, ...JSON.parse(stored) } : DEFAULT_ADVANCED;
    } catch { return DEFAULT_ADVANCED; }
  });

  const [subreddit, setSubreddit] = useState(getInitialSubreddit);
  const [authorView, setAuthorView] = useState(null);
  const [sort, setSort] = useState(getInitialSort);
  const [includeNsfw, setIncludeNsfw] = useState(true);
  const [mediaFilter, setMediaFilter] = useState(getInitialMediaFilter);
  const [order, setOrder] = useState(getInitialOrder);
  const [redditFilters, setRedditFilters] = useState(getInitialFilters);
  const [redditAvailableFlairs, setRedditAvailableFlairs] = useState([]);
  const [redditSavedSearches, setRedditSavedSearches] = useState(() => parseStoredJson(REDDIT_SAVED_SEARCHES_KEY, []));
  const [redditRecentSearches, setRedditRecentSearches] = useState(() => parseStoredJson(REDDIT_RECENT_SEARCHES_KEY, []));
  const [hiddenSubreddits, setHiddenSubreddits] = useState(() => parseStoredJson(HIDDEN_SUBREDDITS_KEY, []));
  const [items, setItems] = useState([]);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const loadMoreSentinelRef = useRef(null);
  const ignoreHistoryRef = useRef(false);

  const urlState = useMemo(() => ({
    src: source !== 'reddit' ? source : '',
    eq: source === 'eporner' ? epornerQuery : '',
    bs: source === 'booru' ? booruSite : '',
    bq: source === 'booru' ? booruQuery : '',
    yq: source === 'youtube' ? youtubeQuery : '',
    cq: source === 'coomer' ? coomerQuery : '',
    bskyq: source === 'bluesky' ? blueskyQuery : '',
    xvq: source === 'xvideos' ? xvideosQuery : '',
    r: source === 'reddit' && !authorView ? subreddit : '',
    u: authorView?.username || '',
    sort: sort !== 'hot' ? sort : '',
    media: mediaFilter !== 'videos' ? mediaFilter : '',
    order: order !== 'newest' ? order : '',
    kw: redditFilters.keyword,
    inc: redditFilters.includeTerms,
    exc: redditFilters.excludeTerms,
    t: redditFilters.timeRange !== 'all' ? redditFilters.timeRange : '',
    scope: redditFilters.searchScope !== 'title' ? redditFilters.searchScope : '',
    flair: redditFilters.flair,
    score: redditFilters.minScore,
    hosted: redditFilters.onlyRedditHosted ? '1' : '',
    dup: redditFilters.suppressDuplicates ? '' : '0'
  }), [subreddit, authorView, sort, mediaFilter, order, redditFilters]);

  useSyncUrlState(urlState);

  const currentSnapshot = useMemo(
    () => createFeedSnapshot({ subreddit, authorView, sort, includeNsfw, mediaFilter, order, redditFilters }),
    [subreddit, authorView, sort, includeNsfw, mediaFilter, order, redditFilters]
  );

  const [feedHistory, setFeedHistory] = useState(() => [currentSnapshot]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => { localStorage.setItem(LAST_SUBREDDIT_KEY, subreddit); }, [subreddit]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:media-filter', mediaFilter); } catch {} }, [mediaFilter]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:source', source); } catch {} }, [source]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:eporner-query', epornerQuery); } catch {} }, [epornerQuery]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:advanced', JSON.stringify(advanced)); } catch {} }, [advanced]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:booru-site', booruSite); } catch {} }, [booruSite]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:booru-query', booruQuery); } catch {} }, [booruQuery]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:youtube-query', youtubeQuery); } catch {} }, [youtubeQuery]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:coomer-query', coomerQuery); } catch {} }, [coomerQuery]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:bluesky-query', blueskyQuery); } catch {} }, [blueskyQuery]);
  useEffect(() => { try { localStorage.setItem('subreddit-media-viewer:xvideos-query', xvideosQuery); } catch {} }, [xvideosQuery]);
  useEffect(() => { localStorage.setItem(LAST_REDDIT_FILTERS_KEY, JSON.stringify(redditFilters)); }, [redditFilters]);
  useEffect(() => { localStorage.setItem(REDDIT_SAVED_SEARCHES_KEY, JSON.stringify(redditSavedSearches)); }, [redditSavedSearches]);
  useEffect(() => { localStorage.setItem(REDDIT_RECENT_SEARCHES_KEY, JSON.stringify(redditRecentSearches)); }, [redditRecentSearches]);
  useEffect(() => { localStorage.setItem(HIDDEN_SUBREDDITS_KEY, JSON.stringify(hiddenSubreddits)); }, [hiddenSubreddits]);

  useEffect(() => {
    const serializedCurrent = serializeSnapshot(currentSnapshot);
    if (ignoreHistoryRef.current) { ignoreHistoryRef.current = false; return; }
    setFeedHistory((prev) => {
      const nextBase = prev.slice(0, historyIndex + 1);
      const active = nextBase[nextBase.length - 1];
      if (active && serializeSnapshot(active) === serializedCurrent) return prev;
      const next = [...nextBase, currentSnapshot].slice(-40);
      const nextIndex = next.length - 1;
      if (nextIndex !== historyIndex) setHistoryIndex(nextIndex);
      return next;
    });
  }, [currentSnapshot, historyIndex]);

  const hiddenSubredditSet = useMemo(() => new Set(hiddenSubreddits.map((s) => String(s).toLowerCase())), [hiddenSubreddits]);

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
    setSubreddit(snapshot.subreddit);
    setAuthorView(snapshot.authorView);
    setSort(snapshot.sort);
    setIncludeNsfw(snapshot.includeNsfw);
    setMediaFilter(snapshot.mediaFilter);
    setOrder(snapshot.order);
    setRedditFilters(snapshot.redditFilters);
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

  useEffect(() => {
    let isCancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError('');
      setLoadMoreError('');
      setActivePost(null);

      try {
        if (source === 'eporner') {
          const data = await fetchEpornerMedia({
            query: epornerQuery || 'all',
            page: 1,
            order: epornerOrder,
            perPage: MEDIA_PAGE_SIZE,
            include: advanced.include || [],
            exclude: advanced.exclude || [],
            performers: advanced.performers || []
          });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setRedditAvailableFlairs([]);
        } else if (source === 'youtube') {
          const data = await fetchYouTubeMedia({
            query: youtubeQuery || 'asmr',
            order: youtubeOrder,
            limit: MEDIA_PAGE_SIZE
          });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setRedditAvailableFlairs([]);
        } else if (source === 'coomer') {
          const data = await fetchCoomerMedia({
            query: coomerQuery,
            type: mediaFilter === 'all' ? 'all' : (mediaFilter === 'images' ? 'image' : mediaFilter === 'audio' ? 'audio' : 'video'),
            sort: coomerSort,
            limit: MEDIA_PAGE_SIZE
          });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setRedditAvailableFlairs([]);
        } else if (authorView?.source === 'reddit') {
          const data = await fetchRedditUserMedia({ username: authorView.username, sort, includeNsfw, after: null, limit: MEDIA_PAGE_SIZE });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setRedditAvailableFlairs([]);
        } else {
          const data = await fetchSubredditMedia({
            subreddit, sort, includeNsfw, after: null, limit: MEDIA_PAGE_SIZE,
            timeRange: redditFilters.timeRange, keyword: redditFilters.keyword,
            includeTerms: redditFilters.includeTerms, excludeTerms: redditFilters.excludeTerms,
            flair: redditFilters.flair, minScore: redditFilters.minScore,
            onlyRedditHosted: redditFilters.onlyRedditHosted, searchScope: redditFilters.searchScope
          });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
          setRedditAvailableFlairs(data.availableFlairs || []);
          const label = makeSearchLabel(subreddit, redditFilters);
          setRedditRecentSearches((prev) => [{ id: label, label, subreddit, filters: redditFilters }, ...prev.filter((item) => item.id !== label)].slice(0, 8));
        }
      } catch (err) {
        if (isCancelled) return;
        const message = err.message || 'Unable to load media right now.';
        if (source === 'reddit' && !authorView && message === 'Subreddit not found') hideSubreddit(subreddit);
        setItems([]);
        setAfter(null);
        setError(message);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => { isCancelled = true; };
  }, [source, epornerQuery, epornerOrder, booruSite, booruQuery, youtubeQuery, youtubeOrder, coomerQuery, coomerSort, blueskyQuery, blueskySort, xvideosQuery, mediaFilter, subreddit, sort, includeNsfw, authorView, redditFilters, reloadToken, advanced.include, advanced.exclude, advanced.performers]);

  const filteredItems = useMemo(() => {
    let next = items;
    if (mediaFilter === 'images') next = next.filter((item) => item.type === 'image' || item.type === 'gallery');
    if (mediaFilter === 'videos') next = next.filter((item) => item.type === 'video');
    if (mediaFilter === 'audio') next = next.filter((item) => item.type === 'audio');
    if (redditFilters.suppressDuplicates) next = dedupeItems(next);

    // Combined duration filter (drawer + advanced)
    const minDur = advanced.durationMin ?? durationMin;
    const maxDur = advanced.durationMax ?? durationMax;
    if (minDur != null || maxDur != null) {
      next = next.filter((item) => {
        if (item.type !== 'video') return minDur == null && maxDur == null;
        const d = Number(item.videoDurationSec) || 0;
        if (minDur != null && d < minDur) return false;
        if (maxDur != null && d > maxDur) return false;
        return true;
      });
    }

    // Advanced media-type override
    if (advanced.mediaType && advanced.mediaType !== 'any') {
      if (advanced.mediaType === 'videos') next = next.filter((i) => i.type === 'video');
      else if (advanced.mediaType === 'images') next = next.filter((i) => i.type === 'image' || i.type === 'gallery');
      else if (advanced.mediaType === 'audio') next = next.filter((i) => i.type === 'audio');
    }

    // Aspect ratio
    if (advanced.aspectRatio && advanced.aspectRatio !== 'any') {
      next = next.filter((item) => {
        const w = Number(item.externalVideoWidth) || 0;
        const h = Number(item.externalVideoHeight) || 0;
        if (!w || !h) return true;
        const ratio = w / h;
        if (advanced.aspectRatio === 'portrait') return ratio < 0.95;
        if (advanced.aspectRatio === 'landscape') return ratio > 1.05;
        if (advanced.aspectRatio === 'square') return ratio >= 0.95 && ratio <= 1.05;
        return true;
      });
    }

    // Quality (video height bucket)
    if (advanced.quality && advanced.quality !== 'any') {
      const bucket = QUALITY_THRESHOLDS[advanced.quality];
      if (bucket) {
        next = next.filter((item) => {
          const h = Number(item.externalVideoHeight) || 0;
          if (!h) return true;
          return h >= bucket.min && h <= bucket.max;
        });
      }
    }

    // Min score
    const adjustedMinScore = Math.max(redditFilters.minScore || 0, advanced.minScore || 0);
    if (adjustedMinScore > 0) {
      next = next.filter((item) => (item.score || 0) >= adjustedMinScore);
    }

    // Has audio
    if (advanced.hasAudio === 'yes') next = next.filter((i) => i.videoHasAudio === true || i.canPlayFullAudioInApp === true);
    if (advanced.hasAudio === 'no') next = next.filter((i) => i.videoHasAudio === false);

    // Client-side text include/exclude (catches what the server didn't)
    if (advanced.include?.length) {
      next = next.filter((item) => {
        const hay = `${item.title || ''} ${item.flair || ''} ${item.author || ''} ${item.subreddit || ''}`.toLowerCase();
        return advanced.include.every((tag) => hay.includes(tag.toLowerCase()));
      });
    }
    if (advanced.exclude?.length) {
      next = next.filter((item) => {
        const hay = `${item.title || ''} ${item.flair || ''} ${item.author || ''} ${item.subreddit || ''}`.toLowerCase();
        return !advanced.exclude.some((tag) => hay.includes(tag.toLowerCase()));
      });
    }

    if (hiddenAuthors.length > 0) {
      next = next.filter((item) => !isAuthorHidden(item.author));
    }
    return next;
  }, [items, mediaFilter, redditFilters.suppressDuplicates, redditFilters.minScore, durationMin, durationMax, advanced, hiddenAuthors, isAuthorHidden]);

  const displayItems = useMemo(() => {
    const copy = [...filteredItems];
    if (order === 'oldest') return copy.sort(compareOldest);
    if (order === 'score') return copy.sort(compareScore);
    if (order === 'comments') return copy.sort(compareComments);
    if (order === 'balanced') return copy.sort(compareBalanced);
    if (order === 'longest') return copy.sort((a, b) => compareVideoLength(a, b, 'desc'));
    if (order === 'shortest') return copy.sort((a, b) => compareVideoLength(a, b, 'asc'));
    if (order === 'random') return shuffle(copy);
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

  function openPreviousPost() {
    if (activeIndex < 0 || navigationItems.length === 0) return;
    setActivePost(navigationItems[(activeIndex - 1 + navigationItems.length) % navigationItems.length]);
  }

  function openNextPost() {
    if (activeIndex < 0 || navigationItems.length === 0) return;
    setActivePost(navigationItems[(activeIndex + 1) % navigationItems.length]);
  }

  function openFirstPost() {
    if (navigationItems.length === 0) return;
    setActivePost(navigationItems[0]);
  }

  function openLastPost() {
    if (navigationItems.length === 0) return;
    setActivePost(navigationItems[navigationItems.length - 1]);
  }

  const handleLoadMore = useCallback(async () => {
    if (!after || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError('');

    try {
      if (source === 'eporner') {
        const data = await fetchEpornerMedia({
          query: epornerQuery || 'all',
          page: Number(after),
          order: epornerOrder,
          perPage: MEDIA_PAGE_SIZE,
          include: advanced.include || [],
          exclude: advanced.exclude || [],
          performers: advanced.performers || []
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (source === 'youtube') {
        const data = await fetchYouTubeMedia({
          query: youtubeQuery || 'asmr',
          pageToken: after,
          order: youtubeOrder,
          limit: MEDIA_PAGE_SIZE
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (source === 'coomer') {
        const data = await fetchCoomerMedia({
          query: coomerQuery,
          after,
          type: mediaFilter === 'all' ? 'all' : (mediaFilter === 'images' ? 'image' : mediaFilter === 'audio' ? 'audio' : 'video'),
          sort: coomerSort,
          limit: MEDIA_PAGE_SIZE
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (authorView?.source === 'reddit') {
        const data = await fetchRedditUserMedia({ username: authorView.username, sort, includeNsfw, after, limit: MEDIA_PAGE_SIZE });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else {
        const data = await fetchSubredditMedia({
          subreddit, sort, includeNsfw, after, limit: MEDIA_PAGE_SIZE,
          timeRange: redditFilters.timeRange, keyword: redditFilters.keyword,
          includeTerms: redditFilters.includeTerms, excludeTerms: redditFilters.excludeTerms,
          flair: redditFilters.flair, minScore: redditFilters.minScore,
          onlyRedditHosted: redditFilters.onlyRedditHosted, searchScope: redditFilters.searchScope
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
        setRedditAvailableFlairs(data.availableFlairs || []);
      }
    } catch (err) {
      setLoadMoreError(err.message || 'Unable to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }, [source, epornerQuery, epornerOrder, booruSite, booruQuery, youtubeQuery, youtubeOrder, coomerQuery, coomerSort, blueskyQuery, blueskySort, xvideosQuery, mediaFilter, after, loadingMore, authorView, sort, includeNsfw, subreddit, redditFilters, advanced.include, advanced.exclude, advanced.performers]);

  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node || !after || loading || loadingMore || loadMoreError) return undefined;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) handleLoadMore(); },
      { rootMargin: '900px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [after, loading, loadingMore, loadMoreError, handleLoadMore]);

  function handleSearch(value) {
    if (source === 'eporner') { setEpornerQuery(value); return; }
    if (source === 'booru') { setBooruQuery(value); return; }
    if (source === 'youtube') { setYoutubeQuery(value || 'asmr'); return; }
    if (source === 'coomer') { setCoomerQuery(value || 'feet'); return; }
    if (source === 'bluesky') { setBlueskyQuery(value || 'feet'); return; }
    if (source === 'xvideos') { setXvideosQuery(value || 'feet'); return; }
    setAuthorView(null);
    setActiveCategory('');
    setSubreddit(value);
  }

  function handleSourceChange(next) {
    if (next === source) return;
    setSource(next);
    setActivePost(null);
  }

  function handleRedditFilterChange(key, value) {
    setAuthorView(null);
    setRedditFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearAllFilters() {
    setRedditFilters({ ...DEFAULT_REDDIT_FILTERS });
    setMediaFilter('videos');
    setOrder('newest');
  }

  function handleSaveRedditSearch() {
    const id = `${subreddit}|${JSON.stringify(redditFilters)}`;
    const label = makeSearchLabel(subreddit, redditFilters);
    setRedditSavedSearches((prev) => [{ id, label, subreddit, filters: redditFilters }, ...prev.filter((item) => item.id !== id)].slice(0, 12));
    toast.show('Search saved');
  }

  function applyRedditSearch(search) {
    setAuthorView(null);
    setSubreddit(search.subreddit);
    setRedditFilters(search.filters);
  }

  function removeRedditSearch(id) {
    setRedditSavedSearches((prev) => prev.filter((item) => item.id !== id));
  }

  function removeRecentRedditSearch(id) {
    setRedditRecentSearches((prev) => prev.filter((item) => item.id !== id));
  }

  function handlePickNsfwSubreddit(name) {
    setAuthorView(null);
    setActiveCategory('');
    setIncludeNsfw(true);
    setSubreddit(name);
  }

  function handlePickNsfwCategory(categoryName, itemsInCategory) {
    if (!Array.isArray(itemsInCategory) || itemsInCategory.length === 0) return;
    const multireddit = itemsInCategory.join('+');
    setAuthorView(null);
    setActiveCategory(categoryName);
    setIncludeNsfw(true);
    setSubreddit(multireddit);
  }

  function handleSelectAuthor(username) {
    setAuthorView({ source: 'reddit', username });
    setIncludeNsfw(true);
    setActivePost(null);
  }

  function handleOpenAuthorGallery(postItem) {
    if (!postItem?.author) return;
    setAuthorView({ source: 'reddit', username: postItem.author });
    setIncludeNsfw(true);
    setActivePost(null);
  }

  function handleToggleFavorite(post) {
    toggleFavorite(post);
  }

  function handleHideAuthor(author) {
    hideAuthor(author);
    toast.show(`Hidden u/${author}`);
  }

  function handleHideSubreddit(name) {
    hideSubreddit(name);
    toast.show(`Hidden r/${name}`);
  }

  async function handleCopyLink(post) {
    try {
      await navigator.clipboard.writeText(post.permalink);
      toast.show('Link copied');
    } catch {
      toast.show('Could not copy link', { variant: 'error' });
    }
  }

  function handleOpenInNewTab(post) {
    if (!post?.permalink) return;
    window.open(post.permalink, '_blank', 'noopener,noreferrer');
  }

  function handleToggleSaveSubreddit(entry) {
    const added = toggleSavedSubreddit(entry);
    toast.show(added ? `Saved r/${entry.name}` : `Removed r/${entry.name}`);
  }

  function handleDurationChange(which, value) {
    if (which === 'min') setDurationMin(value);
    else if (which === 'max') setDurationMax(value);
  }

  function handleOpenFavorite(fav) {
    if (!fav?.permalink) return;
    const enriched = displayItems.find((it) => it.id === fav.id);
    if (enriched) {
      setActivePost(enriched);
    } else if (typeof window !== 'undefined') {
      window.open(fav.permalink, '_blank', 'noopener');
    }
  }

  function handleRetry() {
    setReloadToken((n) => n + 1);
  }

  const hasNoResults = !loading && !error && displayItems.length === 0;
  const hasActiveFilter = redditFilters.keyword || redditFilters.flair || redditFilters.minScore > 0 ||
    redditFilters.includeTerms || redditFilters.excludeTerms || redditFilters.onlyRedditHosted ||
    mediaFilter !== 'videos';

  const mediaCounts = useMemo(() => {
    let videos = 0;
    let images = 0;
    let audio = 0;
    for (const it of items) {
      if (it.type === 'video') videos++;
      else if (it.type === 'image' || it.type === 'gallery') images++;
      else if (it.type === 'audio') audio++;
    }
    return { videos, images, audio, all: items.length };
  }, [items]);

  return (
    <div className="app-shell-beeg">
      <TopBar
        sort={sort}
        onSearch={handleSearch}
        onSortChange={setSort}
        onDrawerOpen={() => setIsDrawerOpen(true)}
        theme={theme}
        onThemeChange={setTheme}
        initialQuery={
          source === 'eporner' ? epornerQuery
          : source === 'booru' ? booruQuery
          : source === 'youtube' ? youtubeQuery
          : source === 'coomer' ? coomerQuery
          : source === 'bluesky' ? blueskyQuery
          : source === 'xvideos' ? xvideosQuery
          : (authorView ? '' : subreddit)
        }
        recentSearches={redditRecentSearches}
        savedSearches={redditSavedSearches}
        hiddenSubreddits={hiddenSubreddits}
        savedSubreddits={savedSubreddits}
        onPickCategory={handlePickNsfwCategory}
        onApplySearch={applyRedditSearch}
        onToggleSaveSubreddit={handleToggleSaveSubreddit}
        isSubredditSaved={isSubredditSaved}
        source={source}
        onSourceChange={handleSourceChange}
        epornerOrder={epornerOrder}
        onEpornerOrderChange={setEpornerOrder}
        booruSite={booruSite}
        onBooruSiteChange={setBooruSite}
        youtubeOrder={youtubeOrder}
        onYoutubeOrderChange={setYoutubeOrder}
        coomerSort={coomerSort}
        onCoomerSortChange={setCoomerSort}
        blueskySort={blueskySort}
        onBlueskySortChange={setBlueskySort}
        onOpenAdvanced={() => setAdvancedOpen(true)}
        advancedFilterCount={countActiveFilters(advanced)}
      />

      {source === 'reddit' && (
        <div className="beeg-rows">
          <SubredditPillRow activeSubreddit={subreddit} onSelectSubreddit={handlePickNsfwSubreddit} hiddenSubreddits={hiddenSubreddits} />
          <CategoryPillRow activeCategory={activeCategory} onSelectCategory={handlePickNsfwCategory} />
          {!authorView && (
            <RelatedSubsRow
              subreddit={subreddit}
              onPickSubreddit={handlePickNsfwSubreddit}
              onToggleSave={handleToggleSaveSubreddit}
              isSaved={isSubredditSaved}
              hiddenSet={hiddenSubredditSet}
            />
          )}
        </div>
      )}

      <div className="media-type-toggle-bar">
        <MediaTypeToggle value={mediaFilter} onChange={setMediaFilter} counts={mediaCounts} />
      </div>

      <ActiveFiltersStrip
        adv={advanced}
        onChange={setAdvanced}
        onOpenAdvanced={() => setAdvancedOpen(true)}
        onClearAll={() => setAdvanced(DEFAULT_ADVANCED)}
      />

      <AdvancedSearch
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        source={source}
        value={advanced}
        onApply={(v) => setAdvanced(v)}
        onReset={() => setAdvanced(DEFAULT_ADVANCED)}
      />

      {authorView && (
        <div className="state-box state-box-author">
          Viewing u/{authorView.username}'s posts
          <button type="button" className="state-box-back" onClick={() => setAuthorView(null)}>Back to feed</button>
        </div>
      )}

      <main className="content-main-beeg" aria-busy={loading ? 'true' : 'false'}>
        <ErrorBoundary>
          {loading && (
            <>
              <div className="sr-only" aria-live="polite">Loading media…</div>
              <SkeletonGrid count={12} />
            </>
          )}

          {!loading && error && (
            <StateMessage
              variant="error"
              title="Couldn't load this feed"
              message={error}
              primaryLabel="Try again"
              onPrimary={handleRetry}
              secondaryLabel="Browse categories"
              onSecondary={() => setIsDrawerOpen(true)}
            />
          )}

          {hasNoResults && (
            <StateMessage
              variant="empty"
              title="No posts to show"
              message={hasActiveFilter
                ? "Your filters might be too narrow. Try clearing them or broadening the time range."
                : "This feed didn't return any posts. Try a different subreddit or sort."}
              primaryLabel={hasActiveFilter ? 'Clear filters' : 'Browse categories'}
              onPrimary={hasActiveFilter ? clearAllFilters : () => setIsDrawerOpen(true)}
              secondaryLabel="Reload"
              onSecondary={handleRetry}
            />
          )}

          {!loading && !error && displayItems.length > 0 && (
            <MediaGrid
              items={displayItems}
              onOpen={setActivePost}
              isFavorited={isFavorited}
              onToggleFavorite={handleToggleFavorite}
              onHideAuthor={handleHideAuthor}
              onHideSubreddit={handleHideSubreddit}
              onCopyLink={handleCopyLink}
              onOpenInNewTab={handleOpenInNewTab}
            />
          )}

          {!loading && after && !loadMoreError && <div ref={loadMoreSentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />}
          {loadingMore && (
            <div className="load-more-row" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>Loading more…</span>
            </div>
          )}
          {loadMoreError && (
            <div className="load-more-row error" role="alert">
              <span>{loadMoreError}</span>
              <button type="button" className="state-panel-button primary" onClick={() => { setLoadMoreError(''); handleLoadMore(); }}>Retry</button>
            </div>
          )}
        </ErrorBoundary>
      </main>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < feedHistory.length - 1}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        redditFilters={redditFilters}
        redditAvailableFlairs={redditAvailableFlairs}
        includeNsfw={includeNsfw}
        mediaFilter={mediaFilter}
        order={order}
        onRedditFilterChange={handleRedditFilterChange}
        onNsfwToggle={setIncludeNsfw}
        onMediaFilterChange={setMediaFilter}
        onOrderChange={setOrder}
        savedSearches={redditSavedSearches}
        recentSearches={redditRecentSearches}
        onSaveSearch={handleSaveRedditSearch}
        onApplySearch={applyRedditSearch}
        onRemoveSaved={removeRedditSearch}
        onRemoveRecent={removeRecentRedditSearch}
        subreddit={subreddit}
        hiddenSubreddits={hiddenSubreddits}
        onPickSubreddit={handlePickNsfwSubreddit}
        onPickCategory={(categoryItems) => handlePickNsfwCategory('', categoryItems)}
        favorites={favorites}
        onOpenFavorite={handleOpenFavorite}
        onRemoveFavorite={removeFavorite}
        onClearFavorites={clearFavorites}
        theme={theme}
        onThemeChange={setTheme}
        density={density}
        onDensityChange={setDensity}
        savedSubreddits={savedSubreddits}
        onPickSavedSubreddit={handlePickNsfwSubreddit}
        onRemoveSavedSubreddit={removeSavedSubreddit}
        hiddenAuthors={hiddenAuthors}
        onUnhideAuthor={unhideAuthor}
        onUnhideSubreddit={(name) => setHiddenSubreddits((prev) => prev.filter((s) => s.toLowerCase() !== name.toLowerCase()))}
        durationMin={durationMin}
        durationMax={durationMax}
        onDurationChange={handleDurationChange}
      />

      <LightboxModal
        post={activePost}
        onClose={() => setActivePost(null)}
        onPrevPost={openPreviousPost}
        onNextPost={openNextPost}
        onFirstPost={openFirstPost}
        onLastPost={openLastPost}
        onOpenAuthorGallery={handleOpenAuthorGallery}
        canNavigate={navigationItems.length > 1}
        enableWheelNavigation={activePost?.type === 'video' && navigationItems.length > 1}
        nextVideoToPrebuffer={nextVideoToPrebuffer}
        isFavorited={activePost ? isFavorited(activePost.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

export default App;
