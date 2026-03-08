# Subreddit Media Viewer

A polished full-stack app for browsing image and video media from Reddit, Instagram, and YouTube.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Styling: custom CSS (dark mode first, glassy cards)

## Features

- Search subreddit (`pics`, `aww`, `wallpapers`, etc.)`r`n- Browse Instagram creator media`r`n- Browse YouTube ASMR categories and queries`r`n- Sort Reddit by `hot`, `new`, or `top`
- Media filters: all / images / videos
- Include or exclude NSFW posts
- Responsive media gallery with metadata
- Modal viewer with:
  - image viewing
  - gallery navigation
  - inline video playback
  - keyboard controls (Esc, Left, Right)
- Pagination via `Load more`
- Copy Reddit post link
- Open original Reddit post
- Download button for safe direct media URLs
- Loading, empty, and error states
- Remembers last searched subreddit in `localStorage`

## Project Structure

```text
.
+- backend/
|  +- src/
|  |  +- routes/
|  |  |  +- subreddit.js
|  |  +- services/
|  |  |  +- redditClient.js
|  |  +- utils/
|  |  |  +- normalizePost.js
|  |  +- app.js
|  |  +- server.js
|  +- .env.example
|  +- package.json
+- frontend/
|  +- src/
|  |  +- components/
|  |  |  +- GalleryCard.jsx
|  |  |  +- GalleryGrid.jsx
|  |  |  +- LightboxModal.jsx
|  |  |  +- SearchControls.jsx
|  |  +- utils/
|  |  |  +- api.js
|  |  |  +- format.js
|  |  |  +- media.js
|  |  +- App.jsx
|  |  +- main.jsx
|  |  +- styles.css
|  +- .env.example
|  +- index.html
|  +- package.json
|  +- vite.config.js
+- .gitignore
+- package.json
```

## Setup

1. Install dependencies from repo root:

```bash
npm install
```

2. Create env files:

- `backend/.env` from `backend/.env.example`
- `frontend/.env` from `frontend/.env.example`

3. Start both backend and frontend:

```bash
npm run dev
```

4. Open app at:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Environment Variables

### backend/.env

- `PORT` (default `3001`)
- `REDDIT_BASE_URL` (default `https://www.reddit.com`)
- `REDDIT_USER_AGENT` (set a descriptive value)
- `REDDIT_CLIENT_ID` (optional, for future OAuth mode)
- `REDDIT_CLIENT_SECRET` (optional, for future OAuth mode)`r`n- `YOUTUBE_API_KEY` (required for YouTube tab)

### frontend/.env

- `VITE_API_BASE_URL` (default `http://localhost:3001`)

## API

### `GET /api/subreddit/:name`

Query params:

- `sort`: `hot | new | top` (default `hot`)
- `after`: Reddit pagination cursor
- `limit`: 1-100 (default 25)
- `includeNsfw`: `true | false` (default `false`)

Example:

```bash
GET /api/subreddit/pics?sort=hot&after=t3_abc123&includeNsfw=false
```

Response:

```json
{
  "subreddit": "pics",
  "sort": "hot",
  "after": "t3_xyz",
  "count": 25,
  "items": [
    {
      "id": "abc123",
      "title": "...",
      "permalink": "https://www.reddit.com/r/pics/comments/...",
      "author": "username",
      "subreddit": "pics",
      "createdUtc": 1700000000,
      "score": 1234,
      "nsfw": false,
      "type": "image",
      "thumbnail": "https://...",
      "mediaUrl": "https://i.redd.it/...jpg",
      "galleryItems": [],
      "videoUrl": null
    }
  ]
}
```

## Reddit Media Detection Notes

The backend normalizer converts Reddit post JSON into a unified media model:

- Image posts:
  - uses `post_hint=image`
  - falls back to image-like `url_overridden_by_dest` / `url`
  - uses `preview.images[0]` for thumbnail fallback
- Gallery posts:
  - reads `gallery_data.items`
  - maps each `media_id` using `media_metadata`
  - decodes Reddit escaped URLs (`&amp;`)
  - stores all gallery media in `galleryItems`
- Video posts:
  - uses `secure_media.reddit_video.fallback_url` when present
  - also supports `preview.reddit_video_preview.fallback_url` for GIF-like previews
- Skipping unsupported content:
  - external embeds and non-direct links are ignored to avoid broken media

## Limitations

- The app prioritizes Reddit-hosted/direct media URLs and intentionally skips many third-party embeds.
- Historical completeness depends on Reddit listing behavior and selected sort mode.
- Some GIF-like content is delivered as MP4; behavior depends on the source URL availability.
- Public Reddit JSON endpoints may be rate-limited. OAuth can be added later by swapping logic in `backend/src/services/redditClient.js`.

## SimpCity Source (Best Effort)

A fourth source tab is available: SimpCity.

Endpoints:

- GET /api/simpcity/feed?path=/whats-new/posts/&after=2&limit=18
- GET /api/simpcity/feed?q=keyword&after=2&limit=18

Query params:

- path: SimpCity relative path or URL to browse (default /whats-new/posts/)
- q / query: keyword search across forum listings
- fter: page number for pagination
- limit: number of normalized media cards to return

Environment:

- SIMPCITY_BASE_URL (default https://simpcity.cr)
- SIMPCITY_COOKIE (optional; helps for logged-in browsing)

Notes:

- The SimpCity route supports both path browsing and keyword search.
- It resolves direct media from thread links, including best-effort extraction for Gofile and Bunkr URLs when direct media links can be discovered.
- Some pages may still block automation with Cloudflare/CAPTCHA or require additional account permissions.
- Author-gallery expansion is not available for SimpCity posts in this build.
