# 015 — Double-tap to favorite + heart animation

## Parent PRD

`issues/feed-mode-prd.md` — "Per-item gestures".

## What to build

Double-tap anywhere on a feed item to favorite it. A heart icon animates from the tap point and fades out. Already-favorited + double-tap = no-op (does **not** unfavorite; unfavorite is via the control row only — prevents accidental loss).

Build:

- `frontend/src/hooks/useDoubleTap.js` — pointer-event-based double-tap detector. Returns a handler to spread on the target element. Parameters: `onDoubleTap`, `delay` (default 300ms), `moveThreshold` (default 8px). Pure logic; tested with `userEvent`.
- `frontend/src/components/HeartBurst.jsx` — the animation. Absolutely positioned at the tap point, scales+fades over ~700ms then unmounts itself. CSS animation, no JS animation libs.
- Wired into `FeedItem.jsx`: `onDoubleTap` calls `useFavorites().toggle()` only if the item is not already favorited. Spawns a HeartBurst at the tap coords.

## Acceptance criteria

- [ ] Double-tap an unfavorited item: it becomes favorited, heart animates, persists across reload.
- [ ] Double-tap an already-favorited item: no-op visually (still shows a heart burst for feedback) but the favorite state stays favorited.
- [ ] Single-tap does not trigger favorite.
- [ ] Test for `useDoubleTap`: two taps within 300ms triggers; one tap doesn't; two taps >300ms apart doesn't; two taps with >8px move between them doesn't.
- [ ] On S22, double-tap is responsive (<100ms perceived).
- [ ] HeartBurst component is under 100 lines.

## Blocked by

- `011-feed-mode-shell.md`
- `012-feed-control-row.md` (so single-tap on the favorite icon already works as the deliberate path)
