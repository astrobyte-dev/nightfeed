# PRD — Durable User State Backup

## Problem

All user-curated state (favorites, blocklist, saved subreddits, preferences) lives exclusively in a single browser's localStorage on a single device. A single bad action — clearing browsing data, switching browsers, hitting site-data limits, an accidental DevTools "Clear storage" — silently wipes everything. There is no backup, no error, no recovery path. For a personal app that has accumulated months of curation, this is the project's largest operational risk.

## Goals

- Make user state durable across browser data loss.
- Make backups automatic — no manual export step the user has to remember.
- Get free version history by writing the backup file to OneDrive.
- Keep the implementation small enough to maintain solo.

## Non-goals

- Real-time multi-device sync. Last-write-wins is acceptable; the only user is one person, and simultaneous edits from two devices is not a real failure mode.
- Authentication. Single-user app on localhost.
- Backing up session/UI state (open tab, scroll position, last-viewed source).
- Backing up credentials of any kind. **Hard rule.** The schema gets a sibling README that says "do not put credentials in this file."
- A migration UI. Initial sync is automatic (see "Initial sync" below).

## Solution

Tier 2 auto-sync (chosen over manual export and full backend-as-source-of-truth):

The backend gets `GET` and `PUT /api/user/state`, backed by a JSON file on disk. Frontend hooks load from server on mount, then write through to both localStorage and the server (debounced) on change.

### Storage

- File: configurable via `USERSTATE_PATH` env var. Default to a OneDrive path so version history happens for free, e.g. `C:\Users\<user>\OneDrive\AppData\reddit-grab\userstate.json`.
- Format: pretty-printed JSON.
- Atomicity: write to `.tmp` then rename. Prevents torn writes during OneDrive sync.
- Versioning: top-level `version: 1` field. Future migrations branch on this value.

### Schema

```json
{
  "version": 1,
  "updatedAt": "2026-05-08T22:00:00.000Z",
  "favorites": [],
  "blocklist": [],
  "savedSubreddits": [],
  "preferences": {}
}
```

The shape of each field matches exactly what the corresponding hook currently writes to localStorage. No transformation, no per-field schema discipline. If a hook's localStorage shape changes, this file's shape changes with it; bump `version` when that happens.

### API

- `GET /api/user/state` → `200 { state }` (file read), or `200 { state: null }` if file missing.
- `PUT /api/user/state` → body `{ state }`, atomic write, responds `200 { ok: true, updatedAt }`.

### Backend module: `backend/src/services/userState.js`

Deep module, small interface:

```js
export async function readState();   // returns state object or null
export async function writeState(state); // atomic write
```

All filesystem details, atomicity, path resolution, and error handling live behind this interface. The route file (`backend/src/routes/user.js`) stays thin — wire two endpoints, call the service, done.

### Frontend changes

The four affected hooks: `useBlockList`, `useFavorites`, `useSavedSubreddits`, `usePreferences`.

For each hook:

1. **On mount**: `GET /api/user/state`. If server returned non-null state, hydrate from it (overwriting any localStorage). If null, hydrate from localStorage as today.
2. **On change**: write to localStorage as today, plus a debounced (~1000ms) `PUT /api/user/state` with the full state object.

Add a small shared module `frontend/src/utils/userState.js` that owns the debounced PUT and **consolidates writes from all four hooks into a single request**. This avoids the four hooks racing each other with overlapping PUTs.

### Initial sync

On first run after this feature ships, the file does not exist. Mount-time GET returns null, so localStorage wins as before. The first hook change triggers a PUT, which creates the file. From that point forward, the file is source of truth.

## Failure modes

| Failure | Behavior |
|---|---|
| Backend down on mount | Frontend silently falls back to localStorage. Hooks work as before. No error UI. |
| PUT fails | Frontend retries on next change. localStorage is still updated, so no data is lost from the user's perspective during the session. |
| Mid-write crash | Atomic rename means file is either old-complete or new-complete, never half-written. |
| OneDrive sync conflict | OneDrive produces a `userstate-<PC name>.json` duplicate. Resolve manually; rare for one user. |
| Schema version unrecognized | Backend returns the file as-is. Frontend detects unknown version, logs a warning, falls back to localStorage. |

## Acceptance criteria

- Clearing browser data and reloading restores favorites, blocklist, saved subs, and preferences from the server file.
- Editing favorites on Device A and reloading on Device B (after ~2s debounce) reflects the change on B.
- The `userstate.json` file appears in the configured path and updates within ~1s of state changes.
- Killing the backend mid-session: frontend continues working with no errors and no broken UX.
- Schema file has `version: 1`. A `userstate.README.md` sits beside it stating "do not store credentials in this file."

## Open questions

1. Default `USERSTATE_PATH` — OneDrive path explicitly required, or local-with-OneDrive-suggested? **Recommended:** required via `.env`, local fallback for first-run.
2. Should the GET on mount block first paint, or should the app render with localStorage and re-hydrate when the GET resolves? **Recommended:** the latter (avoid a full-screen flash for what is in practice a sub-50ms call to localhost).
