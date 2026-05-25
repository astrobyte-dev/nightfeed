# 002 — Wire useBlockList to userState sync

## Parent PRD

`issues/userstate-backup-prd.md`

## What to build

Hook `useBlockList` into the shared `frontend/src/utils/userState.js` module created in issue 001. Pure mechanical follow-up: same pattern as `useFavorites`.

- On mount, hydrate from server state if non-null; otherwise use localStorage as today.
- On change, contribute the updated blocklist into the consolidated debounced PUT.
- localStorage continues to write as before (write-through cache).

No backend changes. No new schema fields — the `blocklist` key is already in the schema defined in 001.

## Acceptance criteria

- [ ] Clearing browser data and reloading restores `useBlockList` state from the server file
- [ ] Adding/removing entries from the blocklist triggers a debounced PUT that includes the new blocklist
- [ ] Backend down on mount: blocklist falls back to localStorage cleanly
- [ ] No regression in 001's acceptance criteria — favorites still sync as before

## Blocked by

`issues/001-tracer-bullet-favorites-sync.md`

## User stories addressed

- US2: My blocklist survives clearing browser data
