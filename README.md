# Nightfeed

A personal, single-user, full-stack media browser. Reddit-primary, NSFW-focused, mobile-first.

> The GitHub repo is still named `subreddit-media-viewer` for historical reasons. The project's name is **Nightfeed**.

## Status

Active personal project. Not packaged for distribution. Not intended for shared / multi-user deployment. No auth, no rate limiting beyond what upstream sources impose.

## Stack

- **Backend:** Node 20+ (ESM), Express, `morgan`, `cors`, `dotenv`. No database.
- **Frontend:** React 18 + Vite, plain JS, `hls.js` for HLS playback, dynamic `dashjs` import for DASH. State in React hooks + localStorage (+ IndexedDB once feed-mode watch tracking lands).
- **Tooling:** ESLint (flat config), Prettier, Vitest (frontend), `node:test` (backend). See `TESTING.md`.
- **AI assistants:** `CLAUDE.md` is the canonical project context for Claude / Copilot. Read it before contributing changes.

## Content sources

| Source | Endpoint prefix | Notes |
|---|---|---|
| Reddit | `/api/subreddit`, `/api/reddit`, `/api/user` | Primary source. Comments supported in the lightbox (and feed mode once shipped). |
| Coomer | `/api/coomer` | Secondary. Creator-indexed. |
| Eporner | `/api/eporner` | Secondary. |
| YouTube | `/api/youtube` | Secondary. |

Adding a new source is a future architectural goal — see `CLAUDE.md` "Source-adapter goal."

## Features

- Subreddit browsing with `hot`, `new`, `top` sorts.
- Reddit filters: keyword, flair, include/exclude terms, min score, search scope, NSFW toggle, host filter.
- Multi-source unified grid with source toggle.
- Lightbox modal with comments (Reddit) and inline video playback.
- Favorites, blocklist (hidden authors), saved subreddits, recently-searched.
- Preferences: theme (dark / light / system), density.
- URL state sync — current filter set is reflected in the URL bar.
- Skeleton grids, infinite scroll, debounced search.
- **In progress:** TikTok-style full-screen feed mode, watch-time-aware ranking, mobile gestures, PWA install. See `issues/feed-mode-prd.md`.

## Repository layout

```
.
├── CLAUDE.md, memory.md, TESTING.md   # project docs for humans + AI
├── README.md                          # this file
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/ci.yml
├── issues/                            # PRDs + tracer-bullet issues
├── backend/
│   ├── .env.example
│   └── src/{app.js, server.js, routes/, services/, utils/}
└── frontend/
    ├── .env.example
    ├── index.html
    └── src/{App.jsx, main.jsx, components/, hooks/, utils/, styles.css}
```

## Setup

1. Requires Node 20 or newer.
2. From the repo root:

   ```
   npm install
   ```

3. Create env files:
   - `backend/.env` from `backend/.env.example`
   - `frontend/.env` from `frontend/.env.example`

4. Run both packages:

   ```
   npm run dev
   ```

5. Open:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

## Environment variables

### backend/.env

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3001` | |
| `REDDIT_BASE_URL` | `https://www.reddit.com` | |
| `REDDIT_USER_AGENT` | (none) | Recommended; Reddit may rate-limit without one. |
| (others) | | See `backend/.env.example` for the current set. |

### frontend/.env

| Var | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3001` | |
| `VITE_HTTPS` | `false` | Set `true` to enable HTTPS dev via `vite-plugin-mkcert` (required for autoplay-with-sound on mobile Chrome). |

## Mobile development

Nightfeed is built mobile-first against a Samsung Galaxy S22 Ultra. To test on a phone against a laptop-hosted backend:

1. Start the LAN-exposed dev server:

   ```
   npm run dev:lan
   ```

   This binds the Vite dev server to `0.0.0.0:5173`.

2. Find your laptop's LAN IP (`hostname -I` on Linux/Mac, `ipconfig` on Windows).

3. On the phone, open `http://<laptop-ip>:5173`.

4. **For sound autoplay in feed mode**, you need HTTPS. Set `VITE_HTTPS=true` in `frontend/.env`, restart, and trust the locally-generated cert on the phone (first visit will show a warning; accept once).

5. **PWA install** (once issue 019 ships): Chrome menu -> "Install app" / "Add to Home screen". The home-screen icon launches Nightfeed fullscreen.

## Scripts

| Script | Where | Effect |
|---|---|---|
| `npm run dev` | root | Backend + frontend, hot reload. |
| `npm run dev:lan` | root | As above, frontend bound to 0.0.0.0. |
| `npm run build` | root | Production build of the frontend. |
| `npm run lint` | root | ESLint across both packages. |
| `npm test` | root | Test both packages (Vitest + `node:test`). |

## Backend API

### Reddit

`GET /api/subreddit/:name`

Query params: `sort`, `after`, `limit`, `includeNsfw`, `timeRange`, `keyword`, `includeTerms`, `excludeTerms`, `flair`, `minScore`, `onlyRedditHosted`, `searchScope`.

`GET /api/reddit/comments?permalink=...&limit=12`

`GET /api/user/:username` — Reddit user submissions.

### Other sources

`GET /api/coomer/...`, `GET /api/eporner/...`, `GET /api/youtube/...`, `GET /api/nsfw/new`, `GET /api/media/...`, `GET /api/external/redgifs/:id`.

These shift more than the Reddit routes. See the route files for the current contract: `backend/src/routes/`.

### Health

`GET /api/health` -> `{ ok: true, service: 'nightfeed-api' }`.

## Limitations

- Reddit-hosted video metadata is intentionally minimal (public listing endpoints). The lightbox provides an "Open on Reddit" path for richer playback when the in-app player is preview-only.
- Upstream rate limits are not paginated around by Nightfeed; sustained heavy use will see 429s.
- No persistence beyond localStorage and (for the upcoming feed mode) IndexedDB. State is browser-bound. A future feature ("userstate backup") will mirror it to a JSON file behind the backend; see `issues/userstate-backup-prd.md` (currently deferred).

## Contributing

This is a personal project. There's no public contribution flow. If you're working on it (or letting Claude / Copilot work on it), the contract is:

1. Read `CLAUDE.md`.
2. Pick an issue from `issues/`.
3. Follow `TESTING.md` for what "done" means.
4. Update `memory.md` if anything about state, decisions, or open questions changed.

## License

No license currently. Treat as proprietary until one is added.
