# 004 — Wire usePreferences to userState sync

## Parent PRD

`issues/userstate-backup-prd.md`

## What to build

Hook `usePreferences` into the shared `frontend/src/utils/userState.js` module from issue 001. Same pattern as 002 and 003.

- On mount, hydrate from server state if non-null; otherwise use localStorage.
- On change, contribute the updated preferences object into the consolidated debounced PUT.
- localStorage continues to write as before.

No backend changes. The `preferences` key is already in the schema from 001.

One thing to watch out for: preferences may include device-local settings that shouldn't sync across devices (e.g. last-open-tab, scroll position). Per the PRD's non-goals section, those are explicitly out of scope. If `usePreferences` currently contains any such device-local settings, leave them in localStorage only — split them out of the synced payload.

## Acceptance criteria

- [ ] Clearing browser data and reloading restores synced preferences from the server file
- [ ] Toggling a preference triggers a debounced PUT that includes the new prefs
- [ ] Any device-local-only settings inside `usePreferences` (if present) remain in localStorage and are NOT included in the PUT
- [ ] Backend down on mount: preferences falls back to localStorage cleanly
- [ ] No regression in 001, 002, or 003 acceptance criteria

## Blocked by

`issues/001-tracer-bullet-favorites-sync.md`

## User stories addressed

- US4: My preferences survive clearing browser data
