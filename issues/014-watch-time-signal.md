# 014 — Watch-time signal (IndexedDB)

## Parent PRD

`issues/feed-mode-prd.md` — "Signals" #3.

## What to build

Per-item watch tracking, persisted to IndexedDB, surfaced as creator-preference deltas the ranking function can use.

Build:

- `frontend/src/feed/watchStore.js` — wraps IndexedDB. Tiny interface:
  - `recordWatchEvent({ itemId, creator, source, durationMs, mediaDurationMs })` — derives `watchedFraction`, writes a row.
  - `getRecentEvents(windowMs = 30 * 24 * 60 * 60 * 1000)` — reads the rolling window.
  - `getCreatorPreferences()` — aggregates events into `{ creator -> score }` map. Returns a Promise.
  - `prune()` — removes events older than the window. Called on app start.
- `frontend/src/hooks/useWatchTracking.js` — used inside `FeedItem.jsx`. Listens for play/pause events on the video and records on item-leave (when the item scrolls out of view). Images: records a flat "viewed" with 5s as the implicit duration if shown for >1s.
- Wired into `useFeedSignals` (from 013): the watch-derived creator-preferences map is added to the signals snapshot.
- Pruning runs on `useMode` initial mount once per session.
- Fallback: if `window.indexedDB` is undefined or throws, fall back to an in-memory `Map` for the session. Log once at startup, never again.

**Aggregation weights inside `getCreatorPreferences`** (PRD section "Watch-time signals"):

- watchedFraction > 0.9 -> +0.7 per event
- watchedFraction > 0.5 -> +0.3 per event
- watchedFraction < 0.1 -> -0.4 per event
- Otherwise 0.

Final per-creator score is the sum, clamped to [-3.0, +3.0] to prevent runaway weighting.

## Acceptance criteria

- [ ] Scrolling past an item I watched fully (>90%) and re-entering feed mode shows their other items earlier.
- [ ] Scrolling past 5 items quickly (each <10%) measurably pushes that creator down.
- [ ] IndexedDB row count never exceeds the 30-day window (`prune()` enforced).
- [ ] If IndexedDB is unavailable, ranking still works (in-memory fallback) and a single warning logs at startup.
- [ ] Tests for `watchStore`: write+read roundtrip, prune correctness, creator-preference aggregation given a fixture of events.
- [ ] Tests for `useWatchTracking`: starting playback then unmounting records exactly one event with the right `durationMs`.
- [ ] No new top-level dependency (IndexedDB is browser-native).
- [ ] Files under 200 lines each.

## Blocked by

- `011-feed-mode-shell.md`
- `013-feed-ranking.md`

## Open questions

- **Storage size policy.** 30 days of watch events on heavy use could be tens of thousands of rows. IndexedDB handles it, but worth a `console.log` once per session of `events: N` so we notice if it explodes.
