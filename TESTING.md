# TESTING.md

How Claude / Copilot / a human contributor confirms a task is actually done. Read alongside `CLAUDE.md`.

## The four layers

Nightfeed has four layers of confirmation, used in order. A task that only passes layer 1 is not done.

### Layer 1 — Static checks

Cheap, fast, run on every change.

```bash
# At the repo root
npm run lint            # ESLint, both packages
npm run build           # Production build of the frontend
```

Lint must be **zero errors**. Warnings are acceptable but should not increase from main without justification.

Build must succeed. A frontend build catches missing imports, syntax errors, and most "I forgot to export that" mistakes that the dev server tolerates.

### Layer 2 — Automated tests

```bash
# Backend
cd backend && npm test          # node:test, runs all *.test.js

# Frontend
cd frontend && npm test         # Vitest, runs all *.test.{js,jsx}

# Or from the root:
npm test                        # runs both via workspaces
```

**What gets a test:**

- **Every new pure function** in `frontend/src/utils/` or `backend/src/utils/`. Pure means same input -> same output, no I/O.
- **Every new custom hook** in `frontend/src/hooks/`. Use `@testing-library/react` with `renderHook`.
- **Every new Express route** gets at least a happy-path test using `supertest` against the Express `app` (not the listening server).
- **Source clients** (`backend/src/services/*Client.js`) get tested with mocked `fetch` for at least one success and one error path.

**What does not need a test:**

- React components that are purely presentational (props in, JSX out, no state). A snapshot is fine if you must, but don't reach for one.
- One-line wrappers.
- The `app.js` Express wiring file.

**Coverage target:** none. Coverage targets cause people to write tests for getters. Test what matters: branching logic, normalization, ranking, parsing, hooks with state.

### Layer 3 — End-to-end (Playwright)

```bash
# At the repo root
npm run test:e2e          # spins up backend + frontend, runs Playwright against headless Chromium
```

Playwright drives a real browser against the real dev stack so the suite can assert things unit tests cannot see: actual URL bar state after `history.pushState`, real DOM properties on `<video>` elements, and console / network symptoms of runaway effects. Tests live in `frontend/tests/e2e/*.spec.js` and run under two viewport projects (`chromium-desktop` and `chromium-mobile` via Pixel 5 emulation).

**What gets an E2E test:**

- Any acceptance criterion that is reasonably automatable in a desktop or emulated-mobile browser. Touch gestures, sound autoplay, and real-device behavior remain a human task in Layer 4.
- Regressions for bugs that lint and unit tests missed. The 011 feed-mode and 005 RedGIFs-loop regressions are the v1 baseline.

**What does not need an E2E test:**

- Pure functions and hook unit behavior. That belongs in Layer 2.
- Visual styling and color choices. Layer 4 (manual smoke) catches these.
- Anything requiring a real S22 device, real touch gestures, or real audio autoplay. Layer 4.

**Fixtures and stubs:**

E2E tests stub Reddit and RedGIFs at the Playwright `page.route()` layer rather than hitting upstreams. The `stubBackend()` helper in `frontend/tests/e2e/_helpers.js` is the default; every spec calls it in `beforeEach`.

- `/api/subreddit/**` returns the captured fixture at `frontend/tests/e2e/fixtures/subreddit-pics.json`.
- `/api/external/redgifs/*` and `.../stream` return synthetic 200 responses so the lightbox can mount `VideoPlayer` and the loop test can count requests.

Why: Reddit's anonymous-API rate limit makes unstubbed runs flake in CI after a couple of executions. Stubs decouple the suite from upstream content drift and rate limits and make assertions deterministic. Production backend code is untouched.

The fixture includes a synthetic item with `externalVideoProvider: 'RedGIFs'` specifically so the 005 loop test has a RedGIFs surface to open. If a new test needs different content (a Reddit gallery, a v.redd.it native video, an audio post), extend the fixture; do not switch to real Reddit.

**When to drop the stubs:** if a future test specifically needs to exercise the real upstream response shape (contract testing the real Reddit or RedGIFs API), drop the `stubBackend()` call in that spec's `beforeEach`. That's the explicit un-deviation procedure.

**Local run notes:**

- The Playwright `webServer` config will start both `backend` and `frontend` dev servers if they aren't already running, and will reuse existing servers locally.
- First run downloads ~300 MB of Chromium binaries via `npx playwright install chromium`. CI does this every run; locally it caches.
- Playwright on Windows can be slow to detect "server ready." Timeouts are set to 120s. If a run hangs on startup, check both ports (5173 frontend, 3001 backend) are free.

**CI:** the `e2e` job runs only on `pull_request` (not on every push) so the dev-loop push isn't slowed by browser downloads. It requires the `build` job to pass first. On failure, the Playwright HTML report and any video / screenshot artifacts are uploaded with 14-day retention.

### Layer 4 — Manual smoke

Open the app and click the thing you changed. Specifically:

1. `npm run dev` at the repo root.
2. Open `http://localhost:5173`.
3. Exercise the feature path end-to-end. Not the whole app, the specific path the task touched.
4. If a backend route was added or changed, also `curl` it once and look at the JSON.

You cannot skip this. The number of bugs that lint+test pass and manual smoke catches in five seconds is not small.

## Mobile smoke (for any task that touches mobile UX)

1. `npm run dev:lan` at the repo root.
2. Find your laptop's LAN IP: `hostname -I` on Linux/Mac, `ipconfig` on Windows.
3. On the phone, open `http://<laptop-ip>:5173`.
4. Confirm the change behaves correctly with touch input on the actual S22.

Tasks that affect gestures, the For-You / feed mode, autoplay, or layout below 480px **must** pass this step.

## What to do when a test fails

Apply root-cause tracing from `CLAUDE.md`:

1. Reproduce locally.
2. Isolate to the smallest failing case.
3. Trace upstream until you have a one-sentence cause.
4. Fix the cause, not the symptom.
5. Confirm the fix doesn't break adjacent paths (re-run the full test for that package).

If a test is failing because it's wrong (the code is correct, the test was bad), say so explicitly and update the test in the same change.

## Setting all of this up (one-time)

If lint/test commands don't exist yet (this is the case at plan creation), the very first task is to scaffold them. See `issues/010-scaffold-tooling.md`. **Do not start any other task until that issue is done.** Without the static + test layers, you cannot self-verify, and Claude/Copilot will go in circles.

## What Claude/Copilot should report after a task

A short, structured "done" message in this shape:

```
DONE: <one-line summary of what changed>

Tests added:
- frontend/src/.../foo.test.js
- backend/src/.../bar.test.js

Self-check:
- lint: clean
- npm test (frontend): X passed
- npm test (backend): X passed
- npm run build: clean
- Manual smoke: opened http://localhost:5173, did <thing>, observed <thing>
- File sizes: all within guardrails
- memory.md updated: <yes/no, why>
- README updated: <yes/no, why>

Notes / followups (if any):
- ...
```

No emoji. No "I hope this helps." Just the checklist.

## Anti-patterns that fail review

- "All tests pass" without saying which tests, or how many.
- "I couldn't run the tests in my environment, but the change looks right." Then say that, ask for help running them, don't pretend.
- "I added a TODO to write the test later." No. Write the test now or revert the change.
- Skipping the manual smoke because "it's a small change."
- Coercing a failing test into passing by changing the assertion to match the broken output.
