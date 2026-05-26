# 016 — Long-press menu in feed mode

## Parent PRD

`issues/feed-mode-prd.md` — "Per-item gestures".

## What to build

Long-press (500ms) anywhere on a feed item opens an action sheet with the same actions the existing `<CardMenu>` shows in the grid: download, copy link, open in browser, hide creator, hide subreddit (Reddit only), "not interested".

Build:

- `frontend/src/hooks/useLongPress.js` — pointer-down + 500ms timer + 8px movement cancel + pointer-up cancel. Returns handlers to spread.
- `frontend/src/components/FeedActionSheet.jsx` — bottom sheet (slides up from bottom on mobile, centered modal on desktop). Reuses the action list from `<CardMenu>` — refactor `<CardMenu>` to expose its action list as `getCardActions(item, handlers)` returning a JSON description (`{ id, label, icon, onClick }[]`). Both surfaces consume from this.
- Wired into `FeedItem.jsx`: long-press opens the sheet, ESC/backdrop-tap closes.
- Pauses video playback while the sheet is open; resumes on close.

## Acceptance criteria

- [ ] 500ms press anywhere on the item opens the sheet.
- [ ] Tapping outside the sheet closes it. ESC also closes.
- [ ] Single-tap and double-tap do not trigger the long press.
- [ ] Scrolling cancels the press (movement threshold).
- [ ] The action list matches the grid `<CardMenu>` exactly. No surprises.
- [ ] Video pauses on sheet open, resumes on close.
- [ ] Tests: long-press detector for the success path + each cancel reason.
- [ ] Refactored `<CardMenu>` still passes its existing usage in the grid (no visible change there).

## Blocked by

- `011`, `012`

## Followup

- `017` populates the "not interested" / "hide creator" / "hide subreddit" handlers with persistent learning logic.
