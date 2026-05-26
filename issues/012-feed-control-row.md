# 012 — Feed-mode bottom control row

## Parent PRD

`issues/feed-mode-prd.md`

## What to build

A bottom-anchored control row that overlays the active feed item, designed for one-handed thumb reach on the S22 Ultra. No new logic; reuses existing hooks (`useFavorites`, `useBlockList`).

Build:

- `frontend/src/components/FeedControlRow.jsx` — bottom-anchored row with:
  - Creator name (tappable, opens a creator drawer; the drawer itself is a followup issue, so v1 just `console.log`s the tap).
  - Source badge (small "Reddit" / "Coomer" / "Eporner" / "YouTube" tag).
  - Favorite toggle (heart icon, hooks into `useFavorites`).
  - "Not interested" button (eye-slash icon; in v1 just hides the current item for the session, full learning logic in 017).
  - Overflow menu button (three dots, opens existing `<CardMenu>` adapted for feed mode in 016).
- Wired into `FeedItem.jsx` (added by 011) as a fixed-position child.
- Safe-area inset support (`padding-bottom: env(safe-area-inset-bottom)`) so the row sits above the S22's gesture bar.
- Big tap targets: minimum 48×48px per button.

Style:

- Translucent backdrop (`backdrop-filter: blur(12px)`, `background: rgba(0,0,0,0.4)`).
- Icons from a lightweight inline SVG set; do not add an icon library.
- Disappears (opacity 0, pointer-events none) when the user hasn't tapped for 3s. Reappears on any pointer event. Same pattern as TikTok.

## Acceptance criteria

- [ ] On the S22 in portrait, the control row sits above the system gesture bar and is reachable by thumb.
- [ ] Each control button is at least 48×48px tap target.
- [ ] Tapping favorite toggles the heart state and persists across reload (uses existing `useFavorites`).
- [ ] Tapping "not interested" removes the item from the current feed session (without persistence for v1).
- [ ] The row auto-hides after 3s of inactivity and reappears on any touch.
- [ ] The source badge displays correctly for all four sources.
- [ ] Component is under 200 lines.
- [ ] Test: clicking favorite calls the `useFavorites` `toggle` mock.
- [ ] Smoke: open on S22, scroll through 10 items, favorite some, confirm grid view shows them as favorited on return.

## Blocked by

- `011-feed-mode-shell.md`
- `010-scaffold-tooling.md`

## Followups

- `016` replaces the overflow button stub with the real long-press / tap menu.
- `017` replaces the "not interested" session-only behavior with persistent learning.
- A separate issue adds the creator drawer that the creator-name tap will open.
