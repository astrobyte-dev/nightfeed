# 001 — Tracer bullet: backend + favorites synced

## Parent PRD

`issues/userstate-backup-prd.md`

## What to build

The full vertical slice from disk to UI for one hook (`useFavorites`). This issue stands up the shared infrastructure — `userState` service, route, frontend utility — that issues 002–004 will consume.

Build:

- `backend/src/services/userState.js` exposing `readState()` and `writeState(state)`. Atomic write via `.tmp` + rename. Path resolved from `USERSTATE_PATH` env var, with a local fallback for first-run. See PRD section "Backend module".
- `backend/src/routes/user.js`: extend with `GET /api/user/state` and `PUT /api/user/state`. Thin wrapper over the service. See PRD section "API".
- `frontend/src/utils/userState.js`: a shared module that owns the debounced (~1000ms) consolidated PUT and a single GET-on-mount call. Other hooks call into it. See PRD section "Frontend changes".
- Rewire `useFavorites` to: GET on mount and hydrate from server if non-null, write through to the consolidated PUT on every change. localStorage continues to write as before.
- Sibling file `userstate.README.md` next to the JSON file with the text "DO NOT STORE CREDENTIALS IN userstate.json — this file is synced to OneDrive and not protected."
- Schema includes top-level `version: 1` and `updatedAt`. See PRD section "Schema".

When this lands, issues 002–004 are pure mechanical follow-ups.

## Acceptance criteria

- [ ] Clearing browser data and reloading restores `useFavorites` state from the server file
- [ ] Setting `USERSTATE_PATH=...` in `backend/.env` causes the JSON file to be written to that path; unset falls back to local default
- [ ] Killing the backend process mid-write leaves the file intact (atomic rename verified)
- [ ] Backend down on mount: frontend silently uses localStorage, no errors, hooks work as before
- [ ] First run (file does not exist): `GET /api/user/state` returns `{ state: null }`, frontend hydrates from localStorage, first change creates the file
- [ ] Schema version unrecognized: frontend logs a warning and falls back to localStorage
- [ ] Repeated rapid changes within ~1000ms produce a single PUT (debounce verified)
- [ ] `userstate.README.md` sibling file exists with the no-credentials warning

## Blocked by

None — can start immediately.

## User stories addressed

From the parent PRD:

- US1: My favorites survive clearing browser data
- US5: Backend going down doesn't break the app
- US6: Mid-write crashes don't corrupt the state file
- US7 (partial): Editing on Device A reflects on Device B after debounce — verified for favorites; remaining hooks covered by 002–004
