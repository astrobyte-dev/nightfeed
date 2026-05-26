# 019 — PWA manifest + add-to-home-screen

## Parent PRD

`issues/feed-mode-prd.md` — "Mobile delivery".

## What to build

Make Nightfeed installable on the S22 Ultra as a standalone app icon. No service worker / offline caching — that's a future PRD and was explicitly the lowest mobile priority.

Build:

- `frontend/public/manifest.webmanifest`:
  - `name: "Nightfeed"`, `short_name: "Nightfeed"`.
  - `display: "standalone"`.
  - `start_url: "/"`.
  - `theme_color` matching the dark UI (`#07111f` from styles.css).
  - `background_color: "#07111f"`.
  - Icons: 192×192, 512×512, maskable variants.
- `frontend/public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — use a simple Nightfeed wordmark or "N" glyph on the dark background.
- `frontend/index.html` `<head>` additions:
  - `<link rel="manifest" href="/manifest.webmanifest" />`
  - `<meta name="theme-color" content="#07111f" />`
  - `<meta name="apple-mobile-web-app-capable" content="yes" />` (for iOS, even though we're S22-first)
  - `<link rel="apple-touch-icon" href="/icon-192.png" />`

## Acceptance criteria

- [ ] On the S22 Ultra (Chrome), opening Nightfeed shows an "Install app" prompt or menu option.
- [ ] After install, the home-screen icon launches Nightfeed in fullscreen (no Chrome chrome).
- [ ] Theme color matches existing dark UI.
- [ ] Lighthouse PWA audit reports manifest fields all present (icons, name, display, start_url).
- [ ] No service worker registered (deliberate scope limit).
- [ ] README updated under "Mobile development" with install steps.

## Blocked by

None functionally, but ship after feed mode is genuinely usable (post-013 or later) so the installed app is worth installing.

## Followup

A separate future PRD would consider:
- Service worker for offline shell + favorited media caching.
- Push notifications (likely never; anti-goal in `memory.md`).
- Background fetch for prefetching the feed.
