# PRD — For-You feed mode (TikTok-style)

## Problem

Nightfeed today is a grid-only browser. Browsing is good for "what's here", bad for "show me more like that." On mobile especially, the grid + lightbox flow has too much friction: tap a tile, modal opens, dismiss modal, scroll, tap another. Compare to TikTok: one full-screen item, swipe up, next item, no taps, no modal, no chrome.

The actual content people watch on Nightfeed (Reddit NSFW media, supplemented by Coomer / Eporner / YouTube) maps naturally to a vertical-swipe model. The current grid is fine as an overview / discovery / filtering surface; what's missing is the "I want to dissolve into the feed" mode.

## Goals

- A full-screen vertical-swipe feed where one item fills the viewport.
- Toggleable from the grid: one tap to enter, one gesture (swipe down at top, back button, or `Esc`) to leave.
- **Reddit is the primary tuning target.** Other sources work in feed mode, but Reddit is the case we tune against.
- Engagement-loop signals that learn over time and improve ranking. Local heuristics only, no backend model.
- Feels native on the S22 Ultra in portrait. Smooth swipes, snappy transitions, prefetched media.
- One-handed thumb reach: controls anchored bottom, big tap targets.

## Non-goals

- Cross-source recommendations (e.g., "you watched a Coomer video, here's a similar Reddit post"). Per-source learning only in v1.
- A ranking model that needs training or a backend service.
- Comments / replies / social interactions beyond reading Reddit comments inline.
- Landscape support for v1. Portrait only.
- Desktop feed-mode polish. Desktop works (keyboard arrows, scroll-wheel snap), but mobile is the design target.
- Background audio when the tab is hidden.

## Solution

A new top-level "mode" alongside grid mode. Same data source (the existing source clients, same fetch endpoints), different presentation layer and a new ranking layer in between.

### Modes

- **Grid mode (default).** Today's UI. Unchanged except for an "Enter feed" affordance.
- **Feed mode (new).** Full-screen vertical pager. One item per page. Sound on after first user gesture.

A small `mode` slice of app state ('grid' | 'feed'), persisted in localStorage and reflected in the URL. Entering feed mode preserves the current filter / source / search state so feed mode = "ranked feed view of whatever the grid is currently showing."

### Feed-mode anatomy

- The active item fills the viewport. Video autoplays muted until first user gesture, then unmutes and stays unmuted for the session.
- A thin bottom-anchored control row: creator name (tappable -> creator drawer), favorite toggle, "not interested" button, source badge, overflow menu (long-press anywhere also opens it).
- Edge-swipe right (or system back) leaves feed mode back to the grid, restoring scroll position.
- Swipe up -> next item. Swipe down at the top -> exits feed mode. Anywhere else, swipe down -> previous item.
- Double-tap anywhere on the media -> favorite (heart animation).
- Long-press -> overflow menu (download, copy link, hide creator, hide subreddit, "not interested").
- Comments (Reddit only) accessible via a small icon on the control row, opening a half-sheet that overlays the lower 50%.

### Ranking

Items in feed mode are not in grid order. They go through a ranking pass that combines:

| Signal | Source | Weight v1 |
|---|---|---|
| Item base score (upvotes / view count) | API | 1.0× |
| Recency boost (linear decay over 24h) | API | 0.5× |
| Creator preference (positive watch-time history) | Local | +0.7× |
| Creator preference (negative — fast-skipped) | Local | −0.9× |
| Subreddit preference (Reddit only) | Local | +0.4× |
| "Not interested" tags / authors / subreddits | Local | hard filter |
| Favorited similar (same creator) | Local | +0.3× |
| Already-seen (recently shown in feed) | Local | −0.6× decay |

Weights are constants in `frontend/src/feed/ranking.js`, easy to tune. The ranking function is pure: `(items, signals) -> rankedItems`. Tested in isolation.

### Signals (the engagement loop)

All four signals from the user research are in scope:

1. **Per-item gestures.** Double-tap = favorite. Long-press = menu. Swipe-left = hide author/sub. These are immediate, deliberate signals.
2. **"Not interested" learning.** Fast-skip (less than 2s on an item) records a soft negative against creator + subreddit + tags. Five fast-skips on the same creator in a 24h window auto-adds them to a "dim" list (greyed out tile, can still appear if score is high).
3. **Watch-time signals.** Per-item: >50% watched -> +0.3 to creator preference. >90% -> +0.7. <10% -> -0.4. Stored in IndexedDB (volume too high for localStorage's 5MB).
4. **Creator follow loop.** Tap creator name -> creator drawer (their items, "follow" toggle). Followed creators get a +0.5 ranking boost and a small badge in the grid.

### Storage

- Favorites, blocklist, follows -> existing localStorage hooks (unchanged shape).
- Watch-time history and seen-recently -> **IndexedDB**, table `watchEvents { id, creator, source, durationMs, watchedFraction, ts }`. Rolling 30-day window, pruned on app start.
- Computed creator preferences -> derived from watchEvents at session start, cached in memory.
- Ranking weights -> hardcoded constants for v1; settings UI is a separate future PRD.

### Mobile delivery

- HTTPS dev via `vite-plugin-mkcert` so autoplay-with-sound works on mobile Chrome (Chrome blocks unmuted autoplay on non-secure contexts).
- `dev:lan` already binds 0.0.0.0; documented in README.
- PWA manifest with `display: standalone`, theme color matching dark UI. Add-to-home-screen on S22 gives a fullscreen launcher with no Chrome chrome.
- No service worker / offline caching in v1. Offline tolerance was ranked lowest of the four mobile priorities.

### Speed (mobile priority #1)

- Skeleton tile while item is loading.
- Prefetch the next 2 items' media as soon as the current item is shown.
- Pause / unmount videos 2 items back (don't keep them in DOM).
- HLS sources start at the lowest quality for instant play, ABR climbs from there.
- Ranking happens in a Web Worker if profiling shows >16ms blocking the main thread. Otherwise inline.

### Gestures (mobile priority #2)

- Native `touch-action: pan-y` + CSS scroll-snap on a vertical pager. No JS-driven scroll. The browser's native momentum is better than anything we'd write.
- `Esc`, back button, and edge-swipe-right all exit feed mode.
- Long-press detected via `pointerdown` + 500ms timer + movement threshold (8px).
- Double-tap via `pointerup` + 300ms window + same-position threshold.
- No haptics in v1 (web vibration API works on Android but is a small win; defer).

## Failure modes

| Failure | Behavior |
|---|---|
| Video fails to load | Skip to next item after 5s timeout, log to console. Don't show a broken-image icon, just advance. |
| IndexedDB unavailable | Fall back to in-memory watch history for the session. Ranking still works, just doesn't persist. |
| Ranking returns empty (e.g., all items hard-filtered) | Show a friendly "no items match" with a "reset filters" button. Do not silently show grid order. |
| Sound autoplay blocked (no user gesture yet) | Show a one-time "Tap to enter feed" overlay. Standard mobile pattern. |
| Network drops mid-feed | Current item keeps playing if buffered, swipe to next shows a retry tile. |

## Acceptance criteria (high-level — see tracer-bullet issues for specifics)

- [ ] Toggling between grid and feed mode preserves filter/source state and restores grid scroll position on return.
- [ ] Feed mode on the S22 Ultra in portrait: 60fps swipes between items, no jank, no broken video state when swiping fast.
- [ ] All four engagement signals (gestures, "not interested", watch-time, creator follow) are wired and visibly affect ranking within a session.
- [ ] Sound starts muted, unmutes on first user gesture, stays unmuted.
- [ ] Reddit feed mode shows comments (half-sheet) without leaving feed mode.
- [ ] Ranking is a pure function with tests covering each signal individually.
- [ ] PWA install on the S22 gives a fullscreen launcher with the Nightfeed icon.
- [ ] No file added by this work exceeds the 200-line guardrail; existing oversized files are not grown.
- [ ] No new state-management library introduced.

## Slicing

Implementation is sliced into tracer-bullet issues 011–019. See those for sequencing and acceptance criteria each.

011 stands up the mode toggle and an empty feed shell. From there each issue layers one capability on top, and each is independently shippable.

## Open questions

- **Should creator follows be visible in the grid as a filter ("only followed")?** Lean yes, low cost, lifts the grid too. Open for now.
- **Cross-source ranking later?** Not in v1. Worth a future PRD if signals start to converge usefully per-source.
- **Settings UI for ranking weights?** A future PRD. v1 ships with hardcoded weights and a dev console hook to tune them at runtime (`window.__feedTuning`).
