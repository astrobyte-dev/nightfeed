# 013 — Feed-mode ranking layer

## Parent PRD

`issues/feed-mode-prd.md` — see "Ranking" section.

## What to build

A pure ranking function that takes the items the grid would show, plus a `signals` snapshot, and returns the same items reordered for feed mode. Feed mode starts using this. The grid is unchanged.

Build:

- `frontend/src/feed/ranking.js` — exports `rankItems(items, signals, options)` returning a new array. Pure, no side effects.
- `frontend/src/feed/weights.js` — exports the weight constants from the PRD as a single object: `DEFAULT_WEIGHTS`. Importable + overridable at runtime via `window.__feedTuning` (dev only).
- `frontend/src/feed/signals.js` — exports `useFeedSignals()` hook that gathers current snapshot of: favorites (from `useFavorites`), blocklist (from `useBlockList`), creator-follow list (new, empty in v1; populated by 017), seen-recently set (Map of itemId -> timestamp, session-only).
- `FeedMode.jsx` change: instead of using `items` directly, call `rankItems(items, signals)`.
- `frontend/src/feed/ranking.test.js` — covers each signal in isolation:
  - Base score sorts descending without signals.
  - Recency boost moves a 1h-old high-score item above a 24h-old higher-score item.
  - Favorited-creator's items rank above identical non-favorited.
  - Blocklisted authors are filtered out entirely.
  - Already-seen items decay over the next N items.
  - Seed-deterministic tiebreak (so the test is stable).

**No watch-time signal in this issue.** The hook reads from a watch-time source that will be added in 014; until then, the watch-time input is an empty array and contributes zero.

## Acceptance criteria

- [ ] `rankItems` is a pure function. Same inputs -> same outputs. No `Date.now()`, no `Math.random()` (use a `now` parameter and a seeded RNG).
- [ ] Test count for ranking: at least 8 tests, one per signal plus edge cases (empty items, all-filtered, single item).
- [ ] Feed mode visibly reorders compared to grid: favoriting a creator and re-entering feed mode shows their items earlier.
- [ ] `window.__feedTuning = { weights: { creatorPositive: 2.0 } }` followed by re-rendering feed mode applies the new weight without reload.
- [ ] No file added by this issue exceeds 200 lines.
- [ ] No new top-level dependency added.
- [ ] memory.md updated with the choice of seeded RNG library (or in-line implementation reference).

## Blocked by

- `011-feed-mode-shell.md`

## Followups

- `014` adds the watch-time signal — populates the array that's currently empty.
- A future issue: settings UI for weights (no longer dev-console-only).
