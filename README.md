# Nightfeed

Nightfeed is a full-stack media browser for Reddit, Instagram, and indexed public SimpCity content.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Storage: SQLite (`node:sqlite`) for SimpCity indexing cache
- Styling: custom CSS, dark-first UI

## Features

- Reddit browsing with `hot`, `new`, and `top`
- Reddit keyword, flair, include/exclude term, score, and host filters
- Instagram media browsing
- SimpCity public-content index with preserved forum hierarchy:
  - Category
  - Section
  - Thread
  - Media
- Responsive media grid and split modal viewer
- Infinite scroll for feeds
- Thread detail browsing for SimpCity
- Saved/recent Reddit searches
- Local persistence for feed state and filters

## SimpCity Index Flow

Nightfeed does not scrape SimpCity live on every page load.

Instead it uses a cached index pipeline:

1. Crawl publicly accessible forum index/listing pages
2. Extract SimpCity categories and sections
3. Crawl public thread lists for each indexed section
4. Parse thread pages for:
   - inline images
   - inline videos
   - public outbound host links
5. Resolve supported public hosts through modular resolvers
6. Store normalized thread/media records in SQLite
7. Serve the frontend from cached indexed results

That keeps the UI fast and avoids tying normal browsing to a live crawl on every request.

## Public-content constraints

The SimpCity implementation is intentionally limited to publicly accessible content.

- No login-wall bypassing
- No anti-bot bypassing
- No private-content handling
- External hosts are resolved only through normal public page parsing

## Project Structure

```text
.
+- backend/
|  +- data/
|  |  +- simpcity.sqlite
|  +- src/
|  |  +- routes/
|  |  |  +- instagram.js
|  |  |  +- nsfw.js
|  |  |  +- reddit.js
|  |  |  +- simpcity.js
|  |  |  +- subreddit.js
|  |  |  +- user.js
|  |  +- services/
|  |  |  +- redditClient.js
|  |  |  +- simpcity/
|  |  |  |  +- resolveBunkr.js
|  |  |  |  +- resolveGofile.js
|  |  |  +- simpcityCrawler.js
|  |  |  +- simpcityDb.js
|  |  +- utils/
|  |  |  +- normalizeInstagram.js
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
|  |  |  +- SimpcityThreadList.jsx
|  |  |  +- VideoPlayer.jsx
|  |  +- utils/
|  |  |  +- api.js
|  |  |  +- format.js
|  |  |  +- media.js
|  |  |  +- nsfwDirectory.js
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

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create env files:

- `backend/.env` from `backend/.env.example`
- `frontend/.env` from `frontend/.env.example`

3. Start backend and frontend together:

```bash
npm run dev
```

4. Open the app:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Environment Variables

### backend/.env

- `PORT` (default `3001`)
- `REDDIT_BASE_URL` (default `https://www.reddit.com`)
- `REDDIT_USER_AGENT` (recommended for polite Reddit requests)
- `INSTAGRAM_GRAPH_BASE_URL`
- `INSTAGRAM_APP_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `SIMPCITY_BASE_URL`
- `SIMPCITY_COOKIE` (optional, only if public pages still require a normal session cookie on your own machine)

### frontend/.env

- `VITE_API_BASE_URL` (default `http://localhost:3001`)

## SimpCity Data Model

SQLite tables used for the index:

- `simpcity_categories`
- `simpcity_sections`
- `simpcity_threads`
- `simpcity_tags`
- `simpcity_thread_tags`
- `simpcity_media_items`
- `crawl_jobs`

## API

### Reddit

`GET /api/subreddit/:name`

Query params:

- `sort`: `hot | new | top`
- `after`: Reddit pagination cursor
- `limit`: 1-100
- `includeNsfw`: `true | false`
- `timeRange`: `hour | day | week | month | year | all`
- `keyword`: subreddit search query
- `includeTerms`: comma-separated required terms
- `excludeTerms`: comma-separated excluded terms
- `flair`: exact flair match
- `minScore`: minimum upvote score
- `onlyRedditHosted`: restrict to Reddit-hosted media
- `searchScope`: `title | title_flair | post`

### SimpCity

- `GET /api/simpcity/sidebar`
- `GET /api/simpcity/tags`
- `GET /api/simpcity/threads`
- `GET /api/simpcity/media`
- `GET /api/simpcity/thread/:id`
- `POST /api/simpcity/crawl`

Supported SimpCity filters include:

- `category`
- `section`
- `tag`
- `creator`
- `author`
- `search`
- `mediaType`
- `sourceHost`

## SimpCity Thread Access

SimpCity forum listings are publicly readable, but individual creator threads may return a login wall to guest requests.

When that happens, Nightfeed can still index:

- categories
- sections
- thread titles
- inferred creator names from thread titles

But full media extraction from thread bodies, including Bunkr mirrors linked inside those threads, requires a normal logged-in session cookie on your own machine.

Set `SIMPCITY_COOKIE` in `backend/.env`, then rerun the SimpCity crawl.

## Reddit Media Handling

The Reddit browser intentionally uses public Reddit listing JSON.

### What works well in-app

- Direct images
- Reddit galleries
- Reddit preview-friendly video browsing

### Preview Video behavior

Public Reddit listing responses often expose preview-oriented video streams more reliably than full post playback metadata. Nightfeed treats that as a browsing-first experience:

- preview streams remain playable in-app when available
- the modal keeps a clear `Open on Reddit` path
- the UI presents this as an intentional limitation of public Reddit data, not a broken player

## Limitations

- SimpCity indexing is best-effort and depends on public accessibility of the target pages
- External hosts may remove or rate-limit public media pages over time
- Reddit-hosted video metadata remains limited through public listing endpoints
- Unsupported embeds are intentionally skipped to keep the browsing experience stable
