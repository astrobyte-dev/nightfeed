# 018 — Reddit comments half-sheet in feed mode

## Parent PRD

`issues/feed-mode-prd.md` — "Feed-mode anatomy", comments.

## What to build

A bottom-anchored half-sheet that shows Reddit comments for the active item without leaving feed mode. Only available for Reddit items; the icon hides on Coomer / Eporner / YouTube items.

Build:

- `frontend/src/components/CommentsHalfSheet.jsx` — slides up from the bottom to occupy the lower ~55% of the viewport. Drag-handle at top to dismiss. Tapping the visible upper portion of the video also dismisses.
- A new icon on the control row (added in 012). Visible only when `item.source === 'reddit'`.
- Reuses the existing `fetchRedditComments` from `frontend/src/utils/api.js`. Reuses the existing `<CommentThread>` from `LightboxModal.jsx` — first refactor it out into `frontend/src/components/CommentThread.jsx` as a top-level component.
- Lazy-loads comments only on first open per item. Cached for the session.

## Acceptance criteria

- [ ] Tapping the comments icon on a Reddit item opens the sheet at ~55% height.
- [ ] The video keeps playing (muted briefly while sheet animates open, then unmuted).
- [ ] Dragging the handle down dismisses the sheet.
- [ ] On Coomer / Eporner / YouTube items, the comments icon is not rendered.
- [ ] Comments fetch on first open, then cached for the session (no refetch on reopen of the same item).
- [ ] `<CommentThread>` refactor: existing lightbox-mode comments still work unchanged.
- [ ] New component under 200 lines.
- [ ] Test: comments icon presence is conditional on source.
- [ ] Smoke: open on S22, swipe to a Reddit item, tap comments, read, dismiss, swipe to next.

## Blocked by

- `011`, `012`
