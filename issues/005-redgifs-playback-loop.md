# 005 — Fix RedGIFs lightbox playback runaway loop

## Parent PRD

None. Standalone bug, parked from session work on 2026-05-08.

## 2026-05-26 evidence (root cause identified)

Re-investigated under branch `fix/005-redgifs-playback` with temporary instrumentation on the 17-dep `useEffect` in `frontend/src/components/VideoPlayer.jsx`. The instrumentation logs an effect run counter and which deps changed between consecutive fires.

**Observed:**

- The loop fires at roughly 1500 effect runs per second (~7900 fires in a 5-second capture).
- `loadedmetadata` DOES fire (duration appears in the native controls bar), contra the original "never reaches `loadedmetadata`" assumption above. The loop is downstream of metadata, not upstream.
- The **only** dep that changes between fires is `sanitizedCompanionAudioUrls`. All 16 other deps (including `preferredMuted`, `onDiagnostics`, `mp4Url`, `sourceKind`, etc.) are stable.

**Cross-reference against the original four hypotheses:**

- Hypothesis #1 (`preferredMuted` feedback loop via `volumechange` → `onMutedChange` → parent `setPersistMuted`): **eliminated**. `preferredMuted` never appears in the changed-dep set.
- Hypothesis #2 (inline-computed prop with new ref per render): **partially right direction, wrong location**. The fresh literal is not in the parent's JSX; it's the default value in VideoPlayer's own destructure.
- Hypothesis #3 (`onDiagnostics` instability): **eliminated**. LightboxModal does not pass `onDiagnostics`, and the dep is stable in the trace.
- Hypothesis #4 (`current` reference instability): **eliminated**. Other deps tied to `current` (`mp4Url`, `sourceKind`, `posterUrl`) are stable in the trace.

**Actual root cause:**

`frontend/src/components/VideoPlayer.jsx:28` destructures the prop with a default value:

```js
companionAudioUrls = [],
```

JavaScript evaluates default-expression `[]` fresh on every function invocation, so when a caller omits `companionAudioUrls`, the destructure produces a brand-new array reference on every render of VideoPlayer.

`frontend/src/components/LightboxModal.jsx:596` — the RedGIFs embed `<VideoPlayer>` call site — does **not** pass `companionAudioUrls`. The regular video call site at LightboxModal.jsx:576-591 does pass it (as a memoized prop on lines 157-160), which is why the v.redd.it HLS path does not loop.

The unstable `companionAudioUrls` reference flows into `useMemo` (VideoPlayer.jsx:55-58):

```js
const sanitizedCompanionAudioUrls = useMemo(
  () => (Array.isArray(companionAudioUrls) ? companionAudioUrls.filter(Boolean) : []),
  [companionAudioUrls]
);
```

React's `Object.is` check on `[companionAudioUrls]` fails every render, the memo factory re-runs, and `.filter(Boolean)` produces yet another fresh array. `sanitizedCompanionAudioUrls` is therefore a new reference every render, which invalidates the 17-dep `useEffect`. Cleanup runs `video.removeAttribute('src')` + `video.load()`, events fire, `setVideoMetrics` / diagnostics setState trigger a re-render, and the loop closes.

The same path is also active for the prebuffer `<VideoPlayer prebufferOnly />` at LightboxModal.jsx:647, which also omits `companionAudioUrls`. The fix below resolves both surfaces at once.

This is a **fifth hypothesis** — destructure-default-array-literal — that was not on the original list.

## What's broken

When a RedGIFs-embed post is opened in the lightbox, the `<video>` element makes hundreds of media requests to `/api/external/redgifs/:id/stream`, each one cancelled within 5–16ms. The video shows a loading spinner and never reaches `loadedmetadata`. Confirmed reproducible in Chrome on r/just18, r/collegesluts and similar NSFW subreddits with RedGIFs links.

This bug is **pre-existing** — it was not introduced by the source-cut cleanup performed in the same session. The source cut did not touch [VideoPlayer.jsx](../frontend/src/components/VideoPlayer.jsx), [LightboxModal.jsx](../frontend/src/components/LightboxModal.jsx)'s redgifs branch, or [external.js](../backend/src/routes/external.js).

## Symptom signature

- DevTools Network tab: dozens-to-hundreds of rows named `stream`, status `(cancelled)`, type `media`, size `0.0 kB`, time `5–16 ms` each.
- Player UI: loading spinner overlay, native HTML5 controls visible, time stuck at `0:00`, video never starts.
- Backend logs: NOT spammed with corresponding requests, suggesting the cancellations happen client-side before reaching the proxy (or the requests are aborted during the connection phase).

## Hypothesis

The `useEffect` in [VideoPlayer.jsx:99–537](../frontend/src/components/VideoPlayer.jsx) has **17 dependencies**. Each rerun calls `cleanupPlayers()` which does `video.removeAttribute('src')` + `video.load()` — exactly the pattern that produces instant-cancellation. Something in the parent or in VideoPlayer's own state is causing one of those 17 deps to thrash.

Most likely candidates (ordered by suspicion):

1. **`preferredMuted` (i.e., `persistMuted`) toggling in a feedback loop.** The `volumechange` event handler at line 308 calls `onMutedChange?.(video.muted)` → `setPersistMuted` → re-render → effect re-fires → `tryAutoplay` sets `video.muted = preferredMuted === true` → fires `volumechange` → loop.
2. **An inline-computed prop creating a new reference each render.** E.g., `posterUrl={current?.posterUrl || post?.thumbnail || ''}` — but strings have value equality so this is unlikely unless the underlying values mutate.
3. **`onDiagnostics` callback** — VideoPlayer calls `updateDiagnostics` heavily, and if the parent ever passes a non-stable function, it'd loop. (Currently `LightboxModal` does NOT pass `onDiagnostics`, so this isn't the cause now.)
4. **`current` reference instability** — if the items array isn't stable across re-renders, `current = items[index]` would change identity, propagating through `redgifsStreamUrl` memo and downstream.

## How to investigate

1. Open DevTools Console while reproducing.
2. The `[VideoPlayer] source inputs` and `[VideoPlayer event] ...` logs will be spamming. Count occurrences per second to confirm the loop. Look at which event names dominate.
3. Add a temporary log inside the effect: `console.count('[VideoPlayer] effect run')`. If it counts up rapidly, the effect is looping.
4. Add a temporary log identifying which dep changed: compare prev vs current values for each of the 17 deps. The one that changes every fire is the culprit.
5. Once identified, the fix is one of:
   - Memoize the unstable prop in the parent.
   - Move the dep out of the effect (read via ref, computed inside).
   - Use `useEffectEvent` (or equivalent) for the volume-change feedback.

## Acceptance criteria

- [ ] Opening a RedGIFs lightbox produces ≤2 stream requests (one initial load + at most one retry).
- [ ] The `<video>` reaches `loadedmetadata` and `loadeddata` and starts playing within 2 seconds on a normal connection.
- [ ] No regression in Reddit-hosted (`v.redd.it` HLS/DASH) playback.
- [ ] No regression in MP4 fallback playback.
- [ ] Mute toggle works without retriggering source loads.
