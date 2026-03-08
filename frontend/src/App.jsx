import { useEffect, useMemo, useRef, useState } from 'react';
import SearchControls from './components/SearchControls';
import GalleryGrid from './components/GalleryGrid';
import LightboxModal from './components/LightboxModal';
import { fetchInstagramMedia, fetchRedditUserMedia, fetchSimpcityMedia, fetchSubredditMedia, fetchYouTubeMedia } from './utils/api';
import { NSFW_DIRECTORY, NSFW_TOP_PICKS } from './utils/nsfwDirectory';

const LAST_SUBREDDIT_KEY = 'subreddit-media-viewer:last-subreddit';
const LAST_REDDIT_FILTERS_KEY = 'subreddit-media-viewer:last-reddit-filters';
const REDDIT_SAVED_SEARCHES_KEY = 'subreddit-media-viewer:reddit-saved-searches';
const REDDIT_RECENT_SEARCHES_KEY = 'subreddit-media-viewer:reddit-recent-searches';
const LAST_IG_KEY = 'subreddit-media-viewer:last-instagram-user';
const LAST_YT_KEY = 'subreddit-media-viewer:last-youtube-query';
const LAST_SC_KEY = 'subreddit-media-viewer:last-simpcity-path';
const MEDIA_PAGE_SIZE_REDDIT = 48;
const MEDIA_PAGE_SIZE_IG = 24;
const MEDIA_PAGE_SIZE_YT = 24;
const MEDIA_PAGE_SIZE_SC = 18;

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

const YOUTUBE_ASMR_CATEGORIES = [
  { label: 'All ASMR', value: '' },
  { label: 'Teasing Roleplay', value: 'teasing roleplay asmr' },
  { label: 'Playful Banter', value: 'playful banter roleplay asmr' },
  { label: 'Challenge Vibe', value: 'challenge roleplay asmr' },
  { label: 'Dominant Voice', value: 'dominant voice asmr' },
  { label: 'Flirty Conversation', value: 'flirty conversation asmr' },
  { label: 'Intense Whisper', value: 'intense whisper asmr' },
  { label: 'Ear Attention', value: 'ear attention asmr' },
  { label: 'Personal Attention', value: 'personal attention asmr' },
  { label: 'Mouth Sounds', value: 'mouth sounds asmr' },
  { label: 'Sleepy Vibes', value: 'sleep aid asmr' }
];

const YOUTUBE_ASMR_DIRECTORY = [
  {
    category: 'Roleplay',
    items: [
      { label: 'Teasing Roleplay', value: 'teasing roleplay asmr' },
      { label: 'Playful Teasing', value: 'playful teasing asmr roleplay' },
      { label: 'Bratty Teasing', value: 'bratty teasing asmr' },
      { label: 'Slow Burn Tease', value: 'slow burn tease asmr' },
      { label: 'Flirty Tease', value: 'flirty tease asmr roleplay' },
      { label: 'Good Girl Tease', value: 'good girl tease asmr' },
      { label: 'Bad Girl Tease', value: 'bad girl tease asmr' },
      { label: 'Edge Teasing', value: 'edge teasing asmr roleplay' },
      { label: 'Jealous Tease', value: 'jealous teasing asmr' },
      { label: 'Tsundere Teasing', value: 'tsundere teasing asmr' },
      { label: 'Playful Banter', value: 'playful banter roleplay asmr' },
      { label: 'Confident Banter', value: 'confident banter asmr' },
      { label: 'Challenge Me', value: 'challenge me roleplay asmr' },
      { label: 'Roast Me Light', value: 'light roast roleplay asmr' },
      { label: 'Competitive Flirt', value: 'competitive teasing roleplay asmr' },
      { label: 'Dominant Voice', value: 'dominant voice asmr' },
      { label: 'Confident Voice', value: 'confident voice asmr' },
      { label: 'Possessive Tone', value: 'possessive roleplay asmr' },
      { label: 'Flirty Scenario', value: 'flirty scenario asmr' }
    ]
  },
  {
    category: 'Whisper Styles',
    items: [
      { label: 'Soft Whisper', value: 'soft whisper asmr' },
      { label: 'Intense Whisper', value: 'intense whisper asmr' },
      { label: 'Close Mic Whisper', value: 'close mic whisper asmr' },
      { label: 'Breathy Whisper', value: 'breathy whisper asmr' }
    ]
  },
  {
    category: 'Audio Triggers',
    items: [
      { label: 'Mouth Sounds', value: 'mouth sounds asmr' },
      { label: 'Wet Mouth Sounds', value: 'wet mouth sounds asmr' },
      { label: 'Tongue Clicks', value: 'tongue clicks asmr' },
      { label: 'Tongue Click Patterns', value: 'tongue click patterns asmr' },
      { label: 'Lip Sounds', value: 'lip sounds asmr' },
      { label: 'Lip Smacks', value: 'lip smacks asmr' },
      { label: 'Plosive Sounds', value: 'plosive sounds asmr' },
      { label: 'Breath Sounds', value: 'breath sounds asmr' },
      { label: 'Whisper + Mouth Sounds', value: 'whisper mouth sounds asmr' },
      { label: 'Chewing Sounds', value: 'chewing sounds asmr' },
      { label: 'Gum Sounds', value: 'gum sounds asmr' },
      { label: 'Water Sip Sounds', value: 'water sip sounds asmr' },
      { label: 'Close Mic Mouth Sounds', value: 'close mic mouth sounds asmr' },
      { label: 'No Talking Mouth Sounds', value: 'no talking mouth sounds asmr' },
      { label: 'Ear Brushing', value: 'ear brushing asmr' },
      { label: 'Mic Scratching', value: 'mic scratching asmr' }
    ]
  },
  {
    category: 'Mood',
    items: [
      { label: 'Late Night', value: 'late night asmr roleplay' },
      { label: 'Cozy Bedroom', value: 'cozy bedroom asmr' },
      { label: 'Rainy Night', value: 'rainy night asmr' },
      { label: 'Sleep Aid', value: 'sleep aid asmr' }
    ]
  },
  {
    category: 'Build-Up Sounds',
    items: [
      { label: 'Build-Up Sounds', value: 'build up sounds asmr' },
      { label: 'Anticipation Triggers', value: 'anticipation triggers asmr' },
      { label: 'Suspense Audio', value: 'suspense audio asmr' },
      { label: 'Pacing + Breath', value: 'pacing breath asmr' },
      { label: 'Rising Intensity', value: 'rising intensity asmr' },
      { label: 'Tension and Release', value: 'tension release asmr' },
      { label: 'Slow Build Whisper', value: 'slow build whisper asmr' },
      { label: 'Heartbeat Rhythm', value: 'heartbeat rhythm asmr' },
      { label: 'Countdown Audio', value: 'countdown audio asmr' },
      { label: 'Near/Far Mic Movement', value: 'near far mic movement asmr' },
      { label: 'Layered Trigger Build', value: 'layered trigger build asmr' },
      { label: 'Pause and Hold', value: 'pause and hold asmr' },
      { label: 'Crescendo Triggers', value: 'crescendo triggers asmr' },
      { label: 'Pulse Tapping', value: 'pulse tapping asmr' },
      { label: 'Breath Crescendo', value: 'breath crescendo asmr' }
    ]
  },
  {
    category: 'Feet (General)',
    items: [
      { label: 'Playful Footwork', value: 'playful footwork challenge' },
      { label: 'Playful Tease Walk', value: 'playful tease walk pov' },
      { label: 'Edge Walk POV', value: 'edge walk pov style' },
      { label: 'Runway Tease POV', value: 'runway tease pov' },
      { label: 'Dance Foot Teaser', value: 'dance footwork teaser' },
      { label: 'Mirror Tease Moves', value: 'mirror tease footwork' },
      { label: 'Close-Up Tease Footwork', value: 'close up tease footwork' },
      { label: 'Rhythm Tease Taps', value: 'rhythm tease toe taps' },
      { label: 'Challenge Me Footwork', value: 'challenge me footwork trend' },
      { label: 'Duet Tease Challenge', value: 'duet tease footwork challenge' },
      { label: 'Footwork Transition Tease', value: 'footwork transition tease edit' },
      { label: 'Shoe Reveal Tease', value: 'shoe reveal tease transition' },
      { label: 'Sneaker Reveal Flow', value: 'sneaker reveal transition' },
      { label: 'Heels Tease Walk', value: 'heels tease walk pov' },
      { label: 'Sock Tease Styling', value: 'sock tease styling look' },
      { label: 'Sock Challenge Tease', value: 'sock challenge tease trend' },
      { label: 'Barefoot Tease Walk', value: 'barefoot tease walk vlog' },
      { label: 'One-Take Tease Clip', value: 'one take tease footwork' },
      { label: 'Looped Tease Clip', value: 'loop tease footwork short' },
      { label: 'Trending Tease Sounds', value: 'tease footwork trend audio' }
    ]
  }
];

const YOUTUBE_TOP_PICKS = [
  { label: 'Teasing', value: 'teasing roleplay asmr' },
  { label: 'Dominant', value: 'dominant voice asmr' },
  { label: 'Whisper', value: 'intense whisper asmr' },
  { label: 'Mouth Sounds', value: 'mouth sounds asmr' },
  { label: 'Personal Attention', value: 'personal attention asmr' }
];

function buildSimpcityQuery(input) {
  const value = (input || '').trim();
  if (!value) {
    return { path: '/whats-new/posts/', query: '' };
  }

  if (value.startsWith('/') || /^https?:\/\//i.test(value)) {
    return { path: value, query: '' };
  }

  return { path: '/search/', query: value };
}
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

function App() {
  const [source, setSource] = useState('reddit');
  const [redditInput, setRedditInput] = useState(localStorage.getItem(LAST_SUBREDDIT_KEY) || 'pics');
  const [subreddit, setSubreddit] = useState(localStorage.getItem(LAST_SUBREDDIT_KEY) || 'pics');
  const [instagramInput, setInstagramInput] = useState(localStorage.getItem(LAST_IG_KEY) || 'instagram');
  const [instagramUsername, setInstagramUsername] = useState(localStorage.getItem(LAST_IG_KEY) || 'instagram');
  const [youtubeInput, setYoutubeInput] = useState(localStorage.getItem(LAST_YT_KEY) || 'asmr');
  const [youtubeQuery, setYoutubeQuery] = useState(localStorage.getItem(LAST_YT_KEY) || 'asmr');
  const [simpcityInput, setSimpcityInput] = useState(localStorage.getItem(LAST_SC_KEY) || '/whats-new/posts/');
  const [simpcityPath, setSimpcityPath] = useState(localStorage.getItem(LAST_SC_KEY) || '/whats-new/posts/');
  const [youtubeCategory, setYoutubeCategory] = useState(YOUTUBE_ASMR_CATEGORIES[0].value);
  const [youtubeOrder, setYoutubeOrder] = useState('relevance');
  const [authorView, setAuthorView] = useState(null);
  const [sort, setSort] = useState('hot');
  const [includeNsfw, setIncludeNsfw] = useState(false);
  const [mediaFilter, setMediaFilter] = useState('all');
  const [order, setOrder] = useState('newest');
  const [redditFilters, setRedditFilters] = useState(() => ({ ...DEFAULT_REDDIT_FILTERS, ...parseStoredJson(LAST_REDDIT_FILTERS_KEY, {}) }));
  const [redditAvailableFlairs, setRedditAvailableFlairs] = useState([]);
  const [redditSavedSearches, setRedditSavedSearches] = useState(() => parseStoredJson(REDDIT_SAVED_SEARCHES_KEY, []));
  const [redditRecentSearches, setRedditRecentSearches] = useState(() => parseStoredJson(REDDIT_RECENT_SEARCHES_KEY, []));
  const [items, setItems] = useState([]);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [nsfwQuery, setNsfwQuery] = useState('');
  const [youtubeDirectoryQuery, setYoutubeDirectoryQuery] = useState('');
  const debounceTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(LAST_SUBREDDIT_KEY, subreddit);
  }, [subreddit]);

  useEffect(() => {
    localStorage.setItem(LAST_IG_KEY, instagramUsername);
  }, [instagramUsername]);

  useEffect(() => {
    localStorage.setItem(LAST_YT_KEY, youtubeQuery);
  }, [youtubeQuery]);

  useEffect(() => {
    localStorage.setItem(LAST_SC_KEY, simpcityPath);
  }, [simpcityPath]);

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
        } else if (source === 'instagram') {
          const targetUser = authorView?.source === 'instagram' ? authorView.username : instagramUsername;
          const data = await fetchInstagramMedia({ username: targetUser, after: null, limit: MEDIA_PAGE_SIZE_IG });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
        } else if (source === 'youtube') {
          const query = authorView?.source === 'youtube' ? authorView.username : youtubeQuery;
          const data = await fetchYouTubeMedia({ query, category: youtubeCategory, order: youtubeOrder, after: null, limit: MEDIA_PAGE_SIZE_YT });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
        } else {
          const simpcityInputValue = authorView?.source === 'simpcity' ? authorView.username : simpcityPath;
          const simpcityParams = buildSimpcityQuery(simpcityInputValue);
          const data = await fetchSimpcityMedia({ ...simpcityParams, after: null, limit: MEDIA_PAGE_SIZE_SC });
          if (isCancelled) return;
          setItems(data.items || []);
          setAfter(data.after || null);
        }
      } catch (err) {
        if (isCancelled) return;
        const message = err.message || 'Unable to load media right now.';
        const isYouTubeQuota = source === 'youtube' && /quota/i.test(message);
        if (!isYouTubeQuota) {
          setItems([]);
          setAfter(null);
        }
        setError(isYouTubeQuota ? 'YouTube API quota is currently exhausted. Existing results are shown; try again later.' : message);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      isCancelled = true;
    };
  }, [source, subreddit, sort, includeNsfw, instagramUsername, youtubeQuery, youtubeCategory, youtubeOrder, simpcityPath, authorView, redditFilters]);

  const filteredItems = useMemo(() => {
    let next = items;
    if (mediaFilter === 'images') next = next.filter((item) => item.type === 'image' || item.type === 'gallery');
    if (mediaFilter === 'videos') next = next.filter((item) => item.type === 'video');
    if (source === 'reddit' && redditFilters.suppressDuplicates) next = dedupeItems(next);
    return next;
  }, [items, mediaFilter, source, redditFilters.suppressDuplicates]);

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

    return { url: nextPost.videoUrl || nextPost.mediaUrl || null, hlsUrl: nextPost.videoHlsUrl || null };
  }, [activePost, navigationItems, activeIndex]);

  const filteredDirectory = useMemo(() => {
    const query = nsfwQuery.trim().toLowerCase();
    if (!query) return NSFW_DIRECTORY;
    return NSFW_DIRECTORY.map((section) => ({
      ...section,
      items: section.items.filter((name) => name.toLowerCase().includes(query) || section.category.toLowerCase().includes(query))
    })).filter((section) => section.items.length > 0);
  }, [nsfwQuery]);

  const filteredYouTubeDirectory = useMemo(() => {
    const query = youtubeDirectoryQuery.trim().toLowerCase();
    if (!query) return YOUTUBE_ASMR_DIRECTORY;

    return YOUTUBE_ASMR_DIRECTORY.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query) || section.category.toLowerCase().includes(query))
    })).filter((section) => section.items.length > 0);
  }, [youtubeDirectoryQuery]);

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

  async function handleLoadMore() {
    if (!after || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      if (source === 'reddit') {
        if (authorView?.source === 'reddit') {
          const data = await fetchRedditUserMedia({ username: authorView.username, sort, includeNsfw, after, limit: MEDIA_PAGE_SIZE_REDDIT });
          setItems((prev) => [...prev, ...(data.items || [])]);
          setAfter(data.after || null);
        } else {
          const data = await fetchSubredditMedia({
            subreddit,
            sort,
            includeNsfw,
            after,
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
        const data = await fetchInstagramMedia({ username: targetUser, after, limit: MEDIA_PAGE_SIZE_IG });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else if (source === 'youtube') {
        const query = authorView?.source === 'youtube' ? authorView.username : youtubeQuery;
        const data = await fetchYouTubeMedia({ query, category: youtubeCategory, order: youtubeOrder, after, limit: MEDIA_PAGE_SIZE_YT });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      } else {
        const simpcityInputValue = authorView?.source === 'simpcity' ? authorView.username : simpcityPath;
        const simpcityParams = buildSimpcityQuery(simpcityInputValue);
        const data = await fetchSimpcityMedia({ ...simpcityParams, after, limit: MEDIA_PAGE_SIZE_SC });
        setItems((prev) => [...prev, ...(data.items || [])]);
        setAfter(data.after || null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setAuthorView(null);

    if (source === 'reddit') {
      const next = redditInput.trim().replace(/^r\//i, '');
      if (!next) return;
      setSubreddit(next);
      return;
    }

    if (source === 'instagram') {
      const nextIg = instagramInput.trim().replace(/^@/, '');
      if (!nextIg) return;
      setInstagramUsername(nextIg);
      return;
    }

    if (source === 'youtube') {
      const nextYt = youtubeInput.trim();
      if (!nextYt) return;
      setYoutubeQuery(nextYt);
      return;
    }

    const nextSc = simpcityInput.trim();
    if (!nextSc) return;
    setSimpcityPath(nextSc);
  }

  function handleInputChange(value) {
    if (source === 'reddit') {
      setRedditInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const next = value.trim().replace(/^r\//i, '');
        if (next) {
          setAuthorView(null);
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

    if (source === 'youtube') {
      setYoutubeInput(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const next = value.trim();
        if (next) {
          setAuthorView(null);
          setYoutubeQuery(next);
        }
      }, 700);
      return;
    }

    setSimpcityInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const next = value.trim();
      if (next) {
        setAuthorView(null);
        setSimpcityPath(next);
      }
    }, 700);
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
    setRedditInput(search.subreddit);
    setSubreddit(search.subreddit);
    setRedditFilters(search.filters);
  }

  function removeRedditSearch(id) {
    setRedditSavedSearches((prev) => prev.filter((item) => item.id !== id));
  }
  function handlePickNsfwSubreddit(name) {
    setSource('reddit');
    setAuthorView(null);
    setIncludeNsfw(true);
    setRedditInput(name);
    setSubreddit(name);
  }

  function handlePickYouTubeCategory(categoryValue) {
    setSource('youtube');
    setAuthorView(null);
    setYoutubeCategory(categoryValue);
    if (!youtubeInput.trim()) {
      setYoutubeInput('asmr');
      setYoutubeQuery('asmr');
    } else {
      setYoutubeQuery(youtubeInput.trim());
    }
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

    if (postItem.source === 'youtube') {
      setSource('youtube');
      setAuthorView({ source: 'youtube', username: postItem.author });
      setYoutubeInput(postItem.author);
      setYoutubeQuery(postItem.author);
      setYoutubeCategory('');
      setActivePost(null);
      return;
    }

    if (postItem.source === 'simpcity') {
      return;
    }

    setSource('reddit');
    setAuthorView({ source: 'reddit', username: postItem.author });
    setIncludeNsfw(true);
    setActivePost(null);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>Subreddit Media Viewer</h1>
        <p>Browse images, galleries, and videos from Reddit, Instagram, YouTube, and SimpCity.</p>
      </header>

      {authorView && (
        <div className="state-box">
          Viewing creator gallery: {authorView.source === 'instagram' ? '@' : authorView.source === 'youtube' ? '' : 'u/'}{authorView.username}
          <button type="button" className="load-more" onClick={() => setAuthorView(null)} style={{ marginLeft: '10px' }}>
            Back to feed
          </button>
        </div>
      )}

      <SearchControls
        source={source}
        inputValue={source === 'reddit' ? redditInput : source === 'instagram' ? instagramInput : source === 'youtube' ? youtubeInput : simpcityInput}
        sort={sort}
        mediaFilter={mediaFilter}
        includeNsfw={includeNsfw}
        order={order}
        youtubeCategory={youtubeCategory}
        youtubeCategories={YOUTUBE_ASMR_CATEGORIES}
        youtubeOrder={youtubeOrder}
        redditFilters={redditFilters}
        redditAvailableFlairs={redditAvailableFlairs}
        redditSavedSearches={redditSavedSearches}
        redditRecentSearches={redditRecentSearches}
        onSourceChange={(nextSource) => {
          setAuthorView(null);
          setSource(nextSource);
        }}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onSortChange={setSort}
        onMediaFilterChange={setMediaFilter}
        onNsfwToggle={setIncludeNsfw}
        onOrderChange={setOrder}
        onYoutubeCategoryChange={setYoutubeCategory}
        onYoutubeOrderChange={setYoutubeOrder}
        onRedditFilterChange={handleRedditFilterChange}
        onSaveRedditSearch={handleSaveRedditSearch}
        onApplyRedditSearch={applyRedditSearch}
        onRemoveRedditSearch={removeRedditSearch}
      />

      <div className={`content-layout ${source === 'instagram' ? 'instagram-layout' : ''}`}>
        {source === 'reddit' && (
          <aside className="sidebar-card directory-sidebar">
            <h3>NSFW Directory</h3>
            <p>Click any subreddit to load it instantly.</p>
            <input
              className="directory-search"
              type="text"
              placeholder="Filter subreddits"
              value={nsfwQuery}
              onChange={(event) => setNsfwQuery(event.target.value)}
            />

            <div className="directory-sections">
              {filteredDirectory.map((section) => (
                <details key={section.category} open={nsfwQuery.length > 0}>
                  <summary>{section.category}</summary>
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
              ))}
            </div>
          </aside>
        )}

        {source === 'youtube' && (
          <aside className="sidebar-card directory-sidebar">
            <h3>ASMR Directory</h3>
            <p>Pick a category to refine results.</p>
            <input
              className="directory-search"
              type="text"
              placeholder="Filter categories"
              value={youtubeDirectoryQuery}
              onChange={(event) => setYoutubeDirectoryQuery(event.target.value)}
            />

            <div className="directory-sections">
              {filteredYouTubeDirectory.map((section) => (
                <details key={section.category} open={youtubeDirectoryQuery.length > 0}>
                  <summary>{section.category}</summary>
                  <div className="nsfw-list">
                    {section.items.map((item) => (
                      <button
                        key={`${section.category}-${item.value}`}
                        type="button"
                        className={`nsfw-chip ${youtubeCategory === item.value ? 'active' : ''}`}
                        onClick={() => handlePickYouTubeCategory(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </aside>
        )}

        <main className="content-main">
          {loading && <div className="state-box">Loading media...</div>}
          {!loading && error && <div className="state-box error">{error}</div>}
          {!loading && !error && displayItems.length === 0 && <div className="state-box">No media posts found for this query.</div>}

          <GalleryGrid items={displayItems} onOpen={setActivePost} />

          {!loading && after && (
            <div className="load-more-wrap">
              <button type="button" className="load-more" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </main>

        {source === 'reddit' && (
          <aside className="sidebar-card top-picks-sidebar">
            <h3>Top NSFW Picks</h3>
            <p>Quick jump list.</p>
            <div className="nsfw-list">
              {NSFW_TOP_PICKS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`nsfw-chip ${subreddit.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
                  onClick={() => handlePickNsfwSubreddit(name)}
                >
                  r/{name}
                </button>
              ))}
            </div>
          </aside>
        )}

        {source === 'youtube' && (
          <aside className="sidebar-card top-picks-sidebar">
            <h3>Top ASMR Picks</h3>
            <p>Quick jump list.</p>
            <div className="nsfw-list">
              {YOUTUBE_TOP_PICKS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`nsfw-chip ${youtubeCategory === item.value ? 'active' : ''}`}
                  onClick={() => handlePickYouTubeCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      <LightboxModal
        post={activePost}
        onClose={() => setActivePost(null)}
        onPrevPost={openPreviousPost}
        onNextPost={openNextPost}
        onOpenAuthorGallery={handleOpenAuthorGallery}
        canNavigate={navigationItems.length > 1}
        enableWheelNavigation={activePost?.type === 'video' && navigationItems.length > 1}
        nextVideoToPrebuffer={nextVideoToPrebuffer}
      />
    </div>
  );
}

export default App;

























