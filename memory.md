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

### 2026-05-26: Playwright E2E layer added (issue 020)
- **Why now.** Three sessions (010, 011, 005) shipped bugs that lint and unit tests did not catch and manual smoke did. The cost of repeating that pattern across 012-019 is higher than the cost of adding a real-browser layer once.
- **Layer 3 is E2E.** `TESTING.md` now describes four layers: static checks, automated unit tests, E2E (Playwright), manual smoke. The old "Layer 3 manual smoke" is now Layer 4. `npm run test:e2e` from the repo root spins up backend + frontend and drives headless Chromium.
- **Webserver wiring.** Backend runs on port 3001 (per `backend/src/server.js`), frontend on 5173. Playwright's `webServer` has two entries; the backend one polls `/api/health` so tests do not start until the API is ready. Without that gate, the first spec races the backend boot and gets fetch failures.
- **011 + 005 regression coverage.** Six feed-mode tests cover the 011 acceptance criteria (URL update, chromeless video, Esc / browser-back exit, direct URL landing, scroll preservation). One lightbox-playback test covers the 005 loop by counting requests to `/api/external/redgifs/:id/stream` over 3 seconds and asserting < 10; the original bug fired ~1500 req/sec, the fix fires 1-2, so the gap is wide and unambiguous. Revert validation: with `companionAudioUrls = []` restored, the loop test caught the regression at 456 stream requests in 3 seconds.
- **Why count requests instead of console messages.** Issue 020 originally proposed asserting on `/VideoPlayer.*effect run #[0-9]{3,}/` in the console, but commit `41e79b3` removed the temporary effect-run logging deliberately (per the issue 005 entry, that instrumentation was triage-only). Counting the actual symptom request the user saw is faithful to the bug, does not couple production code to test fixtures, and is deterministic.
- **Deviation from "v1 uses real fetches": test-layer stubs.** The issue spec said v1 hits real Reddit; in practice, running the full suite twice in five minutes burns through Reddit's anonymous-API budget and locks subsequent runs out for ~hours. Stubbing `/api/subreddit/**` at the Playwright `page.route()` layer with a captured `frontend/tests/e2e/fixtures/subreddit-pics.json` fixture made E2E deterministic locally and decoupled CI from upstream flake. The "fixtures mode" followup the issue named is therefore folded into 020 as a test-layer (not backend-layer) implementation. Production code is untouched. If a future need arises to test against real Reddit, drop the `stubBackend()` beforeEach.
- **Synthetic RedGIFs item in fixture.** Image-only r/pics doesn't exercise the loop bug. Added one synthetic item with `externalVideoProvider: 'RedGIFs'`, `externalVideoId: 'e2etestclip'`, etc. The stub also returns 200 from `/api/external/redgifs/*/stream` with an empty body so the lightbox can mount VideoPlayer and the test can count requests; the count is what matters, not the bytes.
- **CI split.** `e2e` job is `pull_request` only, `needs: build`. Push-only pipelines stay fast; PRs gate on E2E. On failure the Playwright HTML report and the `test-results/` artifacts (videos, traces, screenshots) upload with 14-day retention.
- **CLAUDE.md self-check updated.** New criterion: if a task touches AC covered by E2E, the E2E spec is updated or added and `npm run test:e2e` passes locally before declaring done.
- **011 useMode revert is not detectable by E2E alone.** Reverting only `useMode.js` (the synchronous-pushState fix from commit `2b4766b`) does not trip the "Enter Feed sets mode=feed" E2E test, because the URL still ends up at `mode=feed` after the Strict Mode double-invocation pushes twice. The original symptom ("URL left unchanged even though feed mode rendered") only manifests when `useUrlState` rewrites the URL on a subsequent state change and strips unknown params; reverting both `useMode` and `useUrlState` would reproduce it. The unit test `useMode.test.js` (added in 011 specifically) covers the React-state-flush level the E2E can't see. Documented so future readers don't expect E2E to be the only safety net here.
- **Surfaced bug 1: mobile scroll restoration races layout.** The "exiting feed mode restores grid scroll position" test fails under `chromium-mobile` because `useMode`'s `requestAnimationFrame(() => window.scrollTo(0, y))` runs before the grid finishes laying out at the new viewport height; `scrollTo` silently caps at 0. Skipped with a comment pointing at the fix location (`useMode.js`). Followup issue: wait for grid DOM to reach `scrollHeight >= y` before restoring.
- **Surfaced bug 2: `VideoPlayer.jsx:462` imperative controls override.** Line 462 (`video.controls = !prebufferOnly`) runs inside `useEffect` AFTER the JSX-level `controls={controls}` prop is applied, so feed mode's `controls={false}` is overwritten back to `true` once the effect fires. The 011 chromeless-feed-mode suspension only touched the prop default and the JSX binding (per [[2026-05-26-videoplayer-off-limits-suspended-narrowly]]); line 462 was missed. The "native video controls are absent" E2E test currently skips because the fixture has no native-video item that survives feed mode's embed-return-null path. Followup: extend the 011 suspension to line 462 (one-line change: `video.controls = !prebufferOnly && controls;` or similar) and add a native v.redd.it item to the fixture to unblock the test.
- **Files lint clean, off-limits files untouched.** `App.jsx`, `LightboxModal.jsx`, `VideoPlayer.jsx`, `styles.css` were not modified by 020. The two bugs above are documented for separate issues.

### 2026-05-26: Pattern — destructure-default-non-primitive-literal causes useMemo/useEffect dependency invalidation (issue 005)

When a React component destructures a prop with a default value that is a non-primitive literal (`= []`, `= {}`, `= () => {}`, etc.), JavaScript evaluates that default expression on every function invocation. If the caller omits the prop, the destructure produces a brand-new reference every render. If that destructured value then feeds into a `useMemo` or `useEffect` dependency array, the consumer's `Object.is` check fails on every render and the memo factory or effect re-runs even though the semantic value is unchanged. Downstream `setState` calls in event handlers (e.g., `video.load()` firing `loadedmetadata` → `setVideoMetrics`) can close the loop and produce a runaway render cycle.

**Caught in the wild as issue 005:** `frontend/src/components/VideoPlayer.jsx:28` had `companionAudioUrls = []`. `LightboxModal.jsx`'s RedGIFs embed branch and prebuffer branch both omitted the prop. The default produced a fresh `[]` per render. The downstream `useMemo` invalidated, `sanitizedCompanionAudioUrls` became a new reference each render, the 17-dep `useEffect` re-fired ~1500x/sec, and `video.load()` in the cleanup spammed cancelled requests at `/api/external/redgifs/:id/stream`. The regular `v.redd.it` HLS path was unaffected because `LightboxModal` did pass a memoised `companionAudioUrls` to that VideoPlayer.

**Fix pattern:** hoist the default to a module-level `const`, so the default expression resolves to a single shared reference across all invocations. Example: `const EMPTY = []; ... function Foo({ items = EMPTY }) { ... }`.

**Triage pattern when a similar render loop appears:**
1. Add temporary instrumentation to the suspect `useEffect`: an effect-run counter plus an `Object.is`-based dep comparator that logs which deps changed between fires (see commit `6b4a0e9` for the canonical implementation). Tag the logs with a distinctive prefix so the console filter can isolate them.
2. Reproduce the loop. Capture ~5s of console output. The unstable dep will be the one that appears in every "changed deps" entry.
3. Trace the unstable dep back through any `useMemo` chain to its origin. If the origin is a destructured prop with a non-primitive default literal, you've hit this pattern.
4. Hoist the default. Remove the instrumentation in a separate cleanup commit so the fix diff is readable on its own.

**Grep this entry by `destructure-default-non-primitive` when triaging similar loops in the future.**

### 2026-05-26: `VideoPlayer.jsx` off-limits rule suspended narrowly (issue 011)
- **Suspension is exactly two lines.** A `controls` prop with a `true` default in the destructure, and the literal `controls` attribute on the `<video>` element changed to `controls={controls}`. Nothing else in `VideoPlayer.jsx` was touched.
- **Why suspend rather than work around.** The alternative was a CSS hack in `feed.css` using `::-webkit-media-controls` (and other vendor pseudos) to hide chrome. That couples feed-mode styling to Chromium's shadow DOM internals and would rot on engine updates. A real prop with a backwards-compatible default is structurally correct and reusable for the eventual feed-mode control row (issue 012) and any future surfaces that want chromeless playback.
- **Scope of the suspension.** Only for the prop. Pre-existing warnings in `VideoPlayer.jsx` (no-console, set-state-in-effect, exhaustive-deps, no-unused-vars) remain; they belong in that file's planned shrink, not in 011.

### 2026-05-26: Feed-mode shell shipped (issue 011)
- **Single exit code path.** Esc keydown, leftmost-25px edge-swipe-right (dx > 60px, dy < 40px), and browser back all call `history.back()`. The popstate listener in `FeedExitGesture` detects the URL no longer has `mode=feed` and calls `setMode('grid')`. One convergence point; no double-handling.
- **Cold-load history bootstrap.** When `useMode` initialises into feed mode directly from URL or localStorage (the current history entry was not pushed by us), the hook synthesises a grid history entry below the current one via `replaceState` + `pushState`. Guarantees browser back exits feed mode unconditionally.
- **`FeedExitGesture` has no DOM.** Listeners attach to `window` so the edge-swipe registers regardless of which child receives the touch. The component is a behaviour-only Fragment wrapper.
- **Item-kind discriminator is `getModalItems()` in `utils/media.js`.** Already exists for the lightbox; feed mode reuses it directly. Not duplicated, no new utility introduced.
- **`VideoPlayer` untouched.** `FeedItem` passes `mp4Url/hlsUrl/dashUrl/hasAudio/sourceKind/posterUrl/className`. The existing `autoPlay=true`, `loop=true` defaults match feed-mode semantics.
- **`feed.css` imported from `FeedMode.jsx` via Vite**, not from `styles.css`. `styles.css` stays off-limits.
- **Followup flagged, not addressed:** sound autoplay-after-user-gesture across feed scrolls. The Enter-Feed button click is the unlock gesture per the initial plan; whether `VideoPlayer` needs adjustment to propagate that across siblings is a future investigation, likely under issue 014 or its own slice.

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
