# 017 — "Not interested" learning + creator follow loop

## Parent PRD

`issues/feed-mode-prd.md` — "Signals" #2 and #4.

## What to build

Replaces the session-only "not interested" stub from 012 with persistent learning, and adds the creator-follow loop.

### Not-interested learning

- A new hook `useNotInterested` storing a structured set:
  ```
  {
    creators: { 'reddit:u/foo': { count: 3, lastTs: 1234 }, ... },
    subreddits: { 'r/bar': { count: 5, lastTs: 1234 } },
    tags: { 'sometag': { count: 2, lastTs: 1234 } }
  }
  ```
- Per-item "not interested" tap increments the relevant creator + subreddit + tag counters by 1.
- Fast-skip (from 014's watch tracking) increments by 0.5 — softer signal.
- Items with any matching creator/subreddit/tag count >= 5 are filtered hard from the feed.
- Items with count between 2 and 5 are dimmed (50% opacity) but still shown if their base score is in the top quartile of the current batch.
- Persisted in localStorage under `nightfeed:notInterested`. (Volume here is tiny compared to watch events, so localStorage is fine.)

### Creator follow loop

- Tap creator name in the control row -> creator drawer (`<CreatorDrawer>`).
- Drawer shows: their recent items in a sub-grid, "Follow" / "Unfollow" toggle.
- A new hook `useFollowedCreators` storing a list of `{ source, id, addedTs }` in localStorage.
- Followed creators get a +0.5 boost in ranking (already in 013's weights — wire the signal in here).
- A small "★ followed" badge appears on items by followed creators, in both grid and feed views.

### Wiring

- `useFeedSignals` from 013 gains two new fields: `notInterested` and `followedCreators`.
- `ranking.js` uses them per the PRD.
- The control row's "not interested" button + the long-press menu's "hide creator" / "hide subreddit" both write to the same `useNotInterested` store.

## Acceptance criteria

- [ ] Tapping "not interested" on three different items from the same creator results in that creator's items disappearing from the feed.
- [ ] Tapping "follow" on a creator results in their items being noticeably more frequent in feed mode.
- [ ] Followed creators are badged in both grid and feed views.
- [ ] State persists across reload.
- [ ] Tests for `useNotInterested`: increment on tap, hard-filter at threshold, dim between thresholds.
- [ ] Tests for `useFollowedCreators`: add, remove, persistence.
- [ ] `<CreatorDrawer>` component under 200 lines.
- [ ] No new top-level dependency.
- [ ] memory.md updated with the per-source policy for follow + not-interested (per-source for v1 per PRD).

## Blocked by

- `011`, `012`, `013`, `014`, `016`
