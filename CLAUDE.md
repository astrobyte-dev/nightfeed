# CLAUDE.md

Project-wide instructions for Claude (in Claude Code, in VS Code via the Claude extension, or via Copilot Chat reading this file). Read this before starting any task. Keep it open in a tab during long sessions.

`.github/copilot-instructions.md` is a thin pointer to this file so GitHub Copilot's automatic context picks up the same content.

---

## What Nightfeed is

A personal, single-user, full-stack media browser. **Reddit is the primary source and the tuning target** — when in doubt about UX, copy, or ranking, optimize for Reddit first. Other sources (Coomer, Eporner, YouTube) feed the same grid, lightbox, and feed-mode infrastructure but are secondary.

Content is adult/NSFW-focused. That is a constraint on language ("creators", "tags", "feed") but never an excuse for shoddy code.

The target user is one person — the repo owner — on a Samsung Galaxy S22 Ultra (primary) and a desktop (secondary). Both hit the same backend running on localhost / LAN. State should follow the user across devices eventually (see deferred `issues/userstate-backup-prd.md`), but for now localStorage is the source of truth.

## Stack

- **Monorepo:** npm workspaces. Root `package.json` has `dev` (concurrent backend+frontend) and `dev:lan` (binds frontend to `0.0.0.0`).
- **Backend:** Node 20+ ESM, Express, `morgan`, `cors`, `dotenv`. No database currently. All upstream fetching is through services in `backend/src/services/`.
- **Frontend:** React 18 + Vite, plain JS (no TypeScript). `hls.js` for HLS, dynamic `await import('dashjs')` for DASH. State in React + custom hooks + localStorage. No Redux, no Zustand, no React Query.
- **Tests:** **Vitest** for the frontend (`frontend/`), **`node:test`** for the backend (`backend/`). See `TESTING.md`.

## Coding style (non-negotiable)

These are the rules from the repo owner's `userMemories`, applied to this project. Follow them on every change.

### The Karpathy four

1. **Think before coding.** State assumptions, surface tradeoffs, ask when unclear. Don't pick silently.
2. **Simplicity first.** Minimum code. No speculative features or abstractions. Rewrite bloat.
3. **Surgical changes.** Touch only what's needed. Match existing style. Only clean up orphans from your own changes.
4. **Goal-driven execution.** Define success criteria. Tests first. Step-then-verify.

### Architecture

- Early returns over nested conditions.
- Reusable functions over duplication.
- **Decompose functions over 80 lines and files over 200 lines.** This rule exists because we have files that violate it (`App.jsx`, `LightboxModal.jsx`, `styles.css`) and we are actively shrinking them, not feeding them.
- Search for existing libraries before writing custom code.
- SOLID. Clean Architecture. Command-Query Separation. Functional Core / Imperative Shell.
- Domain-specific naming. Explicit control flow.

### TDD discipline

Write the test first, watch it fail, write the minimal code to pass, refactor. **No exceptions** for "too simple to test." Delete code written before its test and start over.

### Writing style

Avoid em dashes in prose. Use commas, periods, parentheses, or semicolons. Applies to commit messages, PR descriptions, code comments, and documentation written for this repo.

### Brainstorming methodology

Before coding anything non-trivial, refine the idea through structured questioning. One question at a time. Multiple choice when possible. Propose 2-3 distinct approaches with tradeoffs. Design before implementation, always.

### Kaizen

Use 5 Whys for bugs. Apply PDCA. Favor simple solutions implemented immediately over complex ones deferred.

### Root-cause tracing

Reproduce, isolate, trace, verify root cause, fix, confirm fix doesn't break other paths. **Don't fix symptoms.** If you find yourself adding a conditional to suppress a warning or coerce a value into the shape downstream code expects, stop and trace upstream instead.

## Repository layout

```
.
├── CLAUDE.md                         <-- you are here
├── memory.md                         <-- session-spanning state, decisions, open questions
├── TESTING.md                        <-- how to run checks, what counts as "done"
├── README.md                         <-- user-facing
├── .github/
│   └── copilot-instructions.md       <-- pointer to CLAUDE.md
├── issues/                           <-- PRDs and tracer-bullet issues
│   ├── userstate-backup-prd.md       (deferred)
│   ├── 001-*.md … 005-*.md           (existing in-flight)
│   └── (new issues land here)
├── backend/
│   └── src/
│       ├── app.js                    <-- Express wiring
│       ├── server.js
│       ├── routes/                   <-- one router per source + ancillary
│       └── services/                 <-- upstream clients, no Express here
└── frontend/
    └── src/
        ├── App.jsx                   <-- being shrunk; do not grow it
        ├── components/               <-- presentational + small stateful
        ├── hooks/                    <-- custom hooks, one concern each
        └── utils/                    <-- pure functions
```

## File-size guardrails

| File                                  | Target ceiling | Current | Action                              |
| ------------------------------------- | -------------- | ------- | ----------------------------------- |
| `frontend/src/App.jsx`                | 300 lines      | ~1000   | Shrink: extract feed hooks, mode router |
| `frontend/src/components/LightboxModal.jsx` | 300 lines      | ~880    | Split: frame, comments, media-slot   |
| `frontend/src/components/VideoPlayer.jsx`   | 400 lines      | ~590    | Extract loaders into `videoLoaders.js` |
| `frontend/src/styles.css`             | 400 lines per partial | ~2670 single | Split per-feature, import from `styles/index.css` |
| Any new file                          | 200 lines      | —       | If you cross 200, that's a refactor signal |

If a task would make any of these files larger, **stop and refactor first** as a separate change, then come back to the original task.

## Naming conventions

- **Storage keys:** New code uses `nightfeed:<feature>:<key>`. Existing code uses `subreddit-media-viewer:*` — leave alone unless a task explicitly migrates them.
- **Express routes:** kebab-case path segments. `/api/reddit/comments`, not `/api/redditComments`.
- **React components:** PascalCase, one component per file, default export plus named where helpful.
- **Hooks:** camelCase, prefixed `use`, in `frontend/src/hooks/`.
- **Source adapters (when introduced):** `backend/src/sources/<sourceName>/` with files `client.js`, `normalize.js`, `index.js` exporting a uniform interface.

## What "done" means

A task is done when:

1. The acceptance criteria in the issue file are all checked.
2. **Tests written for new pure functions and hooks** (see `TESTING.md`).
3. `npm run lint` is clean in any package you touched. (Once ESLint is added — see issue.)
4. `npm test` passes in any package you touched.
5. **If the task touches acceptance criteria covered by E2E, the E2E test is updated or added** (see Layer 3 in `TESTING.md`), and `npm run test:e2e` passes locally.
6. `npm run build` succeeds at the repo root.
7. **You opened `http://localhost:5173` and clicked through the feature path you changed.** Even a 30-second smoke counts. Don't skip this.
8. README and `memory.md` are updated if behavior, API, or open questions changed.

## What never to do without explicit user permission

- Add a new state-management library, build tool, or framework.
- Migrate to TypeScript.
- Add database persistence beyond what `issues/userstate-backup-prd.md` describes (and that one is currently deferred).
- Change the `package.json` `engines` constraint or Node major version.
- Rename existing localStorage keys outside a dedicated migration task.
- Add authentication.
- Run `npm install` with `--force` or `--legacy-peer-deps` to make a problem go away.

## Source-adapter goal (architectural north star)

Adding a new content source should be a ~150-line change: one file in `backend/src/sources/<name>/`, one entry in the routes registry, one entry in the frontend source toggle. **Reddit is allowed to remain richer than this** (it has flair, comments, related subreddits, subreddit pills); other sources should converge on the minimal adapter interface.

The adapter interface is informal for now. It will be formalized in a future PRD. Until then, when adding/editing source code, ask: "would a 6th source need this column? if no, scope it to its source folder."

## When you're stuck

1. State the assumption you're about to make.
2. Look for a similar pattern already in the codebase. Match it.
3. If still stuck, write the question in `memory.md` under "Open questions" and ask the repo owner. Don't guess on architecture.

## Self-check before declaring done

Run through this list out loud (in chat) before saying a task is complete:

- [ ] Acceptance criteria from the issue: all checked?
- [ ] Tests added for new pure functions and hooks?
- [ ] `npm test` clean in affected packages?
- [ ] If the task touches acceptance criteria covered by E2E, the E2E spec is updated or added and `npm run test:e2e` passes?
- [ ] `npm run build` clean at repo root?
- [ ] Manually clicked the feature in a browser?
- [ ] No file crossed its size guardrail?
- [ ] No new dep added without it being mentioned in the issue?
- [ ] `memory.md` updated if anything changed about state, decisions, or open questions?
- [ ] README updated if user-facing behavior changed?
- [ ] No em dashes in commits, comments, or docs you wrote?
