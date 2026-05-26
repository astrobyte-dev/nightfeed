# 011 — Tracer bullet: feed-mode shell + mode toggle

## Parent PRD

`issues/feed-mode-prd.md`

## What to build

The minimum end-to-end vertical slice: enter feed mode from the grid, see one item full-screen, swipe between items using native scroll-snap, exit back to the grid with state restored. **No ranking yet, no signals, no comments. Just the navigation shell.**

Build:

- `frontend/src/hooks/useMode.js` exposing `{ mode, setMode }` where `mode` is `'grid' | 'feed'`. Reads/writes to `localStorage` key `nightfeed:mode` and to URL search param `mode=feed`. URL is source of truth on load.
- `frontend/src/components/FeedMode.jsx` — a new top-level mode renderer. Takes the same `items` array the grid takes. Renders a vertical scroll-snap container, one `<FeedItem>` per item.
- `frontend/src/components/FeedItem.jsx` — the per-item full-screen renderer. For v1: reuses `<VideoPlayer>` for videos, plain `<img>` for images. No interaction beyond the existing autoplay logic.
- `frontend/src/components/FeedExitGesture.jsx` — wraps `<FeedMode>`, handles `Esc`, back button (`popstate`), and edge-swipe-right to return to grid.
- `App.jsx` change: branch on `mode`. If `feed`, render `<FeedMode items={items} onExit={...} />`. If `grid`, render today's UI. **Adds no new state to App.jsx; the mode hook owns its state.**
- `frontend/src/styles/feed.css` (new partial) for feed-mode-specific styles. Imported from `styles.css`. CSS scroll-snap (`scroll-snap-type: y mandatory`, `scroll-snap-align: start`). `touch-action: pan-y`. `overscroll-behavior: contain`.

**Scroll-position preservation:**
- Entering feed mode: capture `window.scrollY` of the grid, stash in `useMode`'s state (not localStorage; session-only).
- Exiting feed mode: restore on next frame using `requestAnimationFrame`.

**HTTPS dev setup (subtask):**
- Add `vite-plugin-mkcert` to frontend devDependencies.
- Enable in `vite.config.js` behind a `VITE_HTTPS=true` env flag so default dev stays HTTP.
- Document in README under "Mobile development".

## Acceptance criteria

- [ ] On grid view, an "Enter feed" button (placement: top bar, right side) switches to feed mode.
- [ ] In feed mode, the first item from the current grid is shown full-screen.
- [ ] Vertical swipe on the S22 Ultra moves between items with native scroll-snap. 60fps.
- [ ] `Esc` on desktop exits feed mode back to the grid at the prior scroll position.
- [ ] Browser back button exits feed mode (doesn't navigate away from the app).
- [ ] Reloading the page with `?mode=feed` in the URL lands directly in feed mode (with whatever the current source returns).
- [ ] `useMode` hook has tests covering: initial state from URL, initial state from localStorage, state setting persists to both.
- [ ] `FeedMode` and `FeedItem` are under 200 lines each.
- [ ] No new state added to `App.jsx`.
- [ ] Smoke test: open on S22 via LAN, switch to feed mode, swipe through 5 items, exit, confirm grid scroll restored.

## Blocked by

`010-scaffold-tooling.md` (no tests can be written until tooling exists).

## Followups

After this lands:
- `012` adds the bottom-anchored control row (favorite, source badge, creator name) — no new logic, just UI.
- `013` adds the ranking layer between grid order and feed order.
- `014` adds watch-time signal tracking (IndexedDB).
- `015` adds double-tap to favorite + heart animation.
- `016` adds long-press menu.
- `017` adds "not interested" learning + creator follow loop.
- `018` adds comments half-sheet (Reddit only).
- `019` adds PWA manifest + add-to-home-screen.

Issues 012–019 can be re-ordered based on what's most valuable to ship next, but 013 (ranking) should come before 014 (which feeds it).
