# memory.md

The document that survives between sessions. Read first when starting work on Nightfeed. Update at the end of every session that changes state, decisions, or open questions.

This file is for the human + the AI assistant. Keep entries dated. Newest at top within each section.

---

## North star

**TikTok-style For-You mode for Reddit-primary NSFW media browsing, mobile-first.** Reddit is the protagonist source. Coomer / Eporner / YouTube feed the same infrastructure but are secondary. One person, one S22 Ultra, occasionally a desktop.

## Current state (as of plan creation)

**Working:**
- Reddit subreddit browsing with filters (keyword, flair, score, etc.)
- Coomer, Eporner, YouTube as additional sources
- Grid view with lightbox modal
- Favorites, saved subreddits, blocklist (localStorage)
- URL state sync (filters in the URL bar)
- Preferences hook (theme, density)
- HLS video playback, dynamic DASH
- ESLint flat config (frontend + backend) + Prettier + `.editorconfig` + `jsconfig.json` + `.vscode/` workspace settings (issue 010)
- Smoke tests wired up: Vitest for frontend (`frontend/src/utils/format.test.js`), `node:test` for backend (`backend/src/utils/normalizePost.test.js`); expand per `TESTING.md` as features land
- CI on push + PR (`.github/workflows/ci.yml`, Node 22; `npm install`, lint, test, build)

**Broken / out of date:**
- `README.md` describes SimpCity + Instagram (both removed) and omits Coomer / Eporner / YouTube
- localStorage keys still use `subreddit-media-viewer:*` prefix (acceptable; migration is a future task)
- `App.jsx` is ~1000 lines with 40 useStates (down from 1733/47, still too large)
- `LightboxModal.jsx` is ~880 lines
- `styles.css` is ~2670 lines in a single file

**In flight (existing `issues/` folder):**
- `001-tracer-bullet-favorites-sync.md` — first slice of the userstate-backup PRD (deferred, see decisions)
- `002-wire-blocklist.md` (depends on 001)
- `003-wire-saved-subreddits.md` (depends on 001)
- `004-wire-preferences.md` (depends on 001)
- `005-redgifs-playback-loop.md` — bug fix, can proceed independently

## Decisions log

Append-only. Newest at top.

### 2026-05-26: `useUrlState` made composable (issue 011 prep)
- **`useSyncUrlState` now preserves unknown URL params.** Previously it rebuilt the URL from scratch using only the keys in the state object it was given, silently stripping any param it didn't own. Discovered while planning feed-mode entry: `useMode` writing `?mode=feed` would have been clobbered by the next filter change. Fix is generic, not feed-mode-specific, and lives in its own commit ahead of the rest of issue 011.
- **Regression test added** (`frontend/src/hooks/useUrlState.test.js`) covering: managed keys written, skipped values not written, pre-existing unknown params preserved, managed keys with skipped values removed if previously present.

### 2026-05-26: Tooling scaffold (issue 010)
- **Warn-baseline for ESLint on legacy code.** Rules existing code violates are downgraded to `warn` at the config level rather than refactored. Tightening to `error` belongs in a dedicated cleanup task, not 010. Specific downgrades: `no-empty` (allowEmptyCatch), `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react/no-unescaped-entities`, `no-constant-binary-expression`.
- **`no-dupe-keys` stays strict.** The one duplicate `width` key in `VideoPlayer.jsx` was deleted by exception (one line, behavior-neutral, user-approved). Future dupe-key bugs will still be caught.
- **Node 22 LTS is the floor.** `engines.node >=22`, CI pinned to Node 22. Backend tests use `node --test` auto-discovery (Node 22+, cross-platform; avoids the `src/**/*.test.js` glob portability problem).
- **`eslint-plugin-react-hooks` v7 is enabled** but its new strict rules are warnings until the `App.jsx` / `LightboxModal.jsx` / hooks shrink work picks them up.
- **Followup flagged, not addressed:** two `no-constant-binary-expression` warnings in `LightboxModal.jsx` look like real logic bugs; recommend addressing during that file's shrink rather than under 010.

### 2026-Q2 — initial plan
- **Reddit is the primary source and the tuning target.** When in doubt about UX, ranking, or feature priority, Reddit wins.
- **TikTok mode is "Both" — full-screen For-You mode toggleable from the grid.** Not a replacement for the grid, a toggleable peer view.
- **All four engagement signals are in scope:** per-item gestures, "not interested" learning, watch-time signals, creator follow loop. Build in that order.
- **Mobile priority order:** Speed > Native gestures > One-handed reach > Offline tolerance.
- **One-tap-to-enter for sound autoplay.** Mobile browsers will not allow sound autoplay before a user gesture. We accept this and make the "Enter Feed" tap deliberate and obvious.
- **Tests:** Vitest (frontend) + `node:test` (backend). No Jest, no Mocha.
- **AI assistant scope:** Both Claude (Code / VS Code extension) and GitHub Copilot. `CLAUDE.md` is the substantive document; `.github/copilot-instructions.md` is a thin pointer.
- **userstate-backup PRD is deferred.** Real concern, not the most pressing. Revisit after TikTok mode ships. The PRD stays in `issues/`, tracer-bullet 001-004 are not scheduled.
- **Source adapter interface is an architectural goal**, not a current task. Reddit is allowed to remain richer (comments, flair, related subs); other sources should converge on a minimal interface as they're touched.
- **Workflow:** PRD-first, then numbered tracer-bullet issues. Each issue has acceptance criteria + self-test instructions. AI sessions are pointed at one issue file at a time.
- **Stack constraints:** No TypeScript migration without explicit go-ahead. No new state-management library. No database beyond the deferred userstate PRD.

## Open questions

Things genuinely undecided. Move out of this list when answered (into the decisions log) or when stale.

- **Will we replace `node:sqlite` with `better-sqlite3` if userstate-backup is revived?** Lean yes, but defer until the PRD is back on the table.
- **Should "not interested" learning persist across content sources** (e.g., disliking a creator on Coomer affects their cross-posts on Reddit), or stay per-source? Lean per-source for v1 simplicity.
- **HTTPS dev for mobile autoplay:** `vite-plugin-mkcert` works locally but the S22 will see a cert warning unless we install the local CA on the phone. Acceptable, or do we need a smoother path (e.g., Tailscale + Let's Encrypt)?
- **PWA scope:** add-to-home-screen + offline shell + cache last grid? Or full Service Worker with image caching? Latter is heavy; defer.
- **Watch-time tracking storage:** localStorage with a rolling window? IndexedDB? Backend? Lean IndexedDB-with-fallback because volumes will be too high for localStorage's 5MB.
- **Ranking algorithm visibility:** does the user (you) want to see *why* the For-You feed is ranking something high? "boosted because watch-time" debug overlay? Useful during tuning, useless after.

## Glossary

For consistency in commits, issues, and comments.

- **Source** — Reddit, Coomer, Eporner, YouTube. Never "site" or "provider."
- **Item** — a single piece of media (post, photoset, video). Never "post" generically (Reddit-specific).
- **Creator** — author, OP, channel. Source-specific synonyms are fine when scoped (e.g., "subreddit" for Reddit).
- **Feed mode / For-You mode** — the full-screen vertical-swipe view. Always one of those two names.
- **Grid mode** — the current grid view. Stays the default landing.
- **Engagement signal** — any one of: favorite, hide, watch-time, skip-fast, follow.
- **Blocklist** — hidden authors/creators. Existing code; keep this name.
- **"Not interested"** — the soft signal that dims similar items. Distinct from blocklist (hard).

## Anti-goals

Things we are explicitly *not* building. Resist drift.

- Multi-user accounts, login, auth.
- Comments / social features beyond reading Reddit comments in the lightbox.
- A recommendation algorithm that requires a backend model. Local heuristics only.
- A real database with a migration system.
- Native mobile app. PWA is the ceiling.
- "Trending across all of Nightfeed" — there's only one user; trending is meaningless.
- Notifications / push.
