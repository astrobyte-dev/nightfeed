# 020 — Playwright E2E smoke tests

## Parent PRD

None. Infrastructure. Block 012 onwards behind this.

## Why now

Sessions for issues 010, 011, and 005 all surfaced bugs that lint and unit tests did not catch:

- **011, failure 1**: URL didn't update to `?mode=feed` when entering feed mode. Vitest passed because the test asserted React state through `act()`, masking the timing of `history.pushState`. Caught only by manually looking at the URL bar.
- **011, failure 2**: Native HTML5 video controls were rendering in feed mode. No unit test could see this; it's a DOM property of a real element.
- **005**: VideoPlayer's 17-dep `useEffect` was firing ~1500x/sec. No assertion in the codebase counts effect runs. Caught only by manually opening DevTools.

Three bugs, three sessions, all surfaced by manual smoke. Every one of them is the kind of bug Playwright catches automatically.

Adding E2E now is cheaper than continuing to discover these bugs the same way for issues 012-019.

## Goals

- Add Playwright with a minimal but real set of E2E tests against `npm run dev`.
- Cover the desktop-side acceptance criteria of shipped issues (011 feed-mode, 005 RedGIFs playback) as regression protection.
- Make E2E tests runnable by Claude Code itself: `npm run test:e2e` returns exit codes Claude can read.
- Wire into CI as a separate job that runs on PR but not on every commit push (E2E is slower than unit tests; we don't want to block dev-loop pushes).

## Non-goals

- Mobile-device automation. Playwright's mobile viewport emulation is in scope; driving a real S22 via ADB / Appium is not. The S22 smoke remains a human task for any issue that touches gestures, sound, or PWA behavior.
- Visual regression testing. Screenshot diffs are a future PRD if we want it.
- 100% E2E coverage. Cover the *acceptance criteria* of shipped issues, not every code path.
- Replacing unit tests. Vitest stays the primary fast-feedback layer.

## Solution

### Setup

Add to `frontend/`:

- `@playwright/test` as devDependency.
- `playwright.config.js` with:
  - `testDir: './tests/e2e'`
  - `webServer` config that starts `npm run dev` at the repo root and waits for `http://localhost:5173`.
  - `use.baseURL: 'http://localhost:5173'`.
  - Two projects: `chromium-desktop` (1280x800) and `chromium-mobile` (Pixel 5 emulation, since S22 emulation isn't a built-in preset and Pixel 5 is close enough viewport-wise).
- `tests/e2e/` folder with the test files described below.
- `frontend/package.json` scripts: `test:e2e`, `test:e2e:ui` (for the Playwright UI mode when debugging locally).
- Root `package.json` scripts: `test:e2e` fans out to the frontend workspace.
- `.gitignore` additions: `test-results/`, `playwright-report/`, `playwright/.cache/`.

### v1 test coverage (regression for issues 011 + 005)

`tests/e2e/feed-mode.spec.js`:

- **Enter feed mode**: load `/`, click the Enter Feed button, assert URL contains `mode=feed`.
- **Native video controls absent in feed mode**: in feed mode, find the active `<video>` element, assert `element.controls === false`.
- **Esc exits**: press Esc, assert URL no longer contains `mode=feed` and the grid is visible.
- **Browser back exits**: enter feed, click browser back, assert grid is visible and we did not navigate away from the app.
- **Direct URL lands in feed**: navigate to `/?mode=feed`, assert feed-mode is the rendered surface.
- **Scroll position preserved**: scroll the grid down, enter feed, exit, assert grid scroll position is roughly where it was.

`tests/e2e/lightbox-playback.spec.js`:

- **No infinite effect loop**: capture console; open a RedGIFs item in the lightbox; wait 3 seconds; assert no console message matches `/VideoPlayer.*effect run #[0-9]{3,}/` (anything over 100 fires in 3s is a regression of issue 005).
- **Video element progresses**: open a video item; wait until `video.readyState >= 2` (HAVE_CURRENT_DATA); assert no `error` event fired on the video.

`tests/e2e/smoke.spec.js`:

- **Backend up**: `GET /api/health` returns `{ ok: true }`.
- **Grid renders**: load `/`, assert at least one item tile is in the DOM within 5s.

These tests assume a real backend. The `webServer` config in `playwright.config.js` handles that. **Data dependency:** the grid tests need at least one subreddit returning items. To avoid flakiness on a real Reddit fetch (rate limits, content drift), the grid test asserts on *count >= 1*, not on a specific item.

### CI integration

`.github/workflows/ci.yml` gains a new job `e2e`:

- `runs-on: ubuntu-latest`
- `needs: build` (only run if lint/test/build passed)
- Triggered on `pull_request` only (not on every push, to keep dev-loop fast)
- Steps: checkout, setup Node 22, `npm install`, `npx playwright install --with-deps chromium`, `npm run test:e2e`
- Uploads `playwright-report/` and any `test-results/` screenshots/videos as artifacts on failure

### Acceptance criteria

- [ ] `npm run test:e2e` at the repo root spins up the backend and frontend, runs the test suite, and exits cleanly on a clean checkout of main.
- [ ] All tests in v1 coverage above pass.
- [ ] The Playwright job runs on PRs and goes green on a clean PR.
- [ ] Deliberately reverting the issue-011 useMode fix (the synchronous `history.pushState`) causes the "Enter feed mode" E2E test to fail. Tested by hand and then re-fixed.
- [ ] Deliberately reverting the issue-005 fix (the EMPTY_COMPANION_AUDIO_URLS constant) causes the "no infinite effect loop" E2E test to fail.
- [ ] `tests/e2e/` files each under 200 lines.
- [ ] Playwright report artifacts uploaded on CI failure so future-Claude can read them.
- [ ] memory.md updated: E2E layer exists, document the test:e2e command in TESTING.md's "Three layers" section as a fourth layer between unit tests and manual smoke.
- [ ] CLAUDE.md "What 'done' means" section updated: new criterion "if the task touches acceptance criteria covered by E2E, the E2E test is updated or added."

## Blocked by

None.

## Followups

After this lands:

- **All future issues** add E2E coverage matching their acceptance criteria where reasonably automatable. (Touch gestures, mobile-specific layout, sound: still manual.)
- Future PRD could add visual regression (Percy or Playwright's own screenshot diffs).
- Future PRD could add a "fixtures mode" where the backend serves recorded JSON instead of hitting real Reddit, eliminating flake from upstream content drift.

## Open questions

- **Backend fixtures vs. real fetches.** v1 uses real fetches. If we hit Reddit rate limits in CI, fixtures become the next iteration.
- **Mobile viewport coverage scope.** v1 runs the same suite on `chromium-mobile`. If that doubles run time without finding bugs, we trim later.
- **Console-message regression for the 005 loop.** Asserting "no message matches X" is fragile if logging format changes. Acceptable risk; the format is in our own code and we'll notice when we change it.
