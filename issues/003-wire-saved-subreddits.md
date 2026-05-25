# 003 — Wire useSavedSubreddits to userState sync

## Parent PRD

`issues/userstate-backup-prd.md`

## What to build

Hook `useSavedSubreddits` into the shared `frontend/src/utils/userState.js` module from issue 001. Same pattern as 002.

- On mount, hydrate from server state if non-null; otherwise use localStorage.
- On change, contribute the updated saved-subreddits list into the consolidated debounced PUT.
- localStorage continues to write as before.

No backend changes. The `savedSubreddits` key is already in the schema from 001.

## Acceptance criteria

- [ ] Clearing browser data and reloading restores `useSavedSubreddits` state from the server file
- [ ] Saving/unsaving a subreddit triggers a debounced PUT that includes the new list
- [ ] Backend down on mount: saved subs falls back to localStorage cleanly
- [ ] No regression in 001 or 002 acceptance criteria

## Blocked by

`issues/001-tracer-bullet-favorites-sync.md`

## User stories addressed

- US3: My saved subreddits survive clearing browser data
