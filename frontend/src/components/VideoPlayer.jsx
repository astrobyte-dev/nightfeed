import Hls from 'hls.js';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const isDev = import.meta.env.DEV;
const DIRECT_LOAD_TIMEOUT_MS = 5000;

function logSourceInputs({ mp4Url, hlsUrl, dashUrl, hasAudio, sourceKind }) {
  if (!isDev) return;
  console.log('[VideoPlayer] source inputs', { mp4Url, hlsUrl, dashUrl, hasAudio, sourceKind });
}

function logEvent(video, eventName) {
  if (!isDev || !video) return;
  console.log('[VideoPlayer event]', {
    eventName,
    muted: video.muted,
    volume: video.volume,
    currentSrc: video.currentSrc,
    readyState: video.readyState
  });
}

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    mp4Url,
    hlsUrl,
    dashUrl,
    companionAudioUrls = [],
    hasAudio = null,
    sourceKind = null,
    posterUrl = '',
    className,
    autoPlay = true,
    loop = true,
    prebufferOnly = false,
    allowUnmutedAutoplay = false,
    preferredMuted = null,
    onMutedChange,
    onDiagnostics
  },
  ref
) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const companionAudioRef = useRef(null);
  const hlsRef = useRef(null);
  const dashPlayerRef = useRef(null);
  const timeoutRef = useRef(null);
  // TEMP issue 005 root-cause trace — remove after diagnosis
  const effectRunCountRef = useRef(0);
  const prevDepsRef = useRef(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [videoMetrics, setVideoMetrics] = useState({ ready: false, isPortrait: true });
  const directUrlOnly = Boolean(mp4Url && !hlsUrl && !dashUrl);
  const sanitizedCompanionAudioUrls = useMemo(
    () => (Array.isArray(companionAudioUrls) ? companionAudioUrls.filter(Boolean) : []),
    [companionAudioUrls]
  );
  const shouldUseCompanionAudio = !prebufferOnly && hasAudio !== true && sanitizedCompanionAudioUrls.length > 0;

  useImperativeHandle(ref, () => ({
    play() {
      return videoRef.current?.play?.();
    },
    pause() {
      videoRef.current?.pause?.();
    },
    togglePlay() {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        const playPromise = video.play?.();
        playPromise?.catch?.(() => {});
      } else {
        video.pause?.();
      }
    },
    toggleMute() {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      onMutedChange?.(video.muted);
    },
    toggleFullscreen() {
      const fullscreenElement = document.fullscreenElement;
      if (fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }

      const target = wrapperRef.current || videoRef.current;
      target?.requestFullscreen?.();
    },
    retry() {
      setReloadNonce((value) => value + 1);
    },
    getVideoElement() {
      return videoRef.current;
    }
  }), []);

  useEffect(() => {
    // TEMP issue 005 root-cause trace — remove after diagnosis
    effectRunCountRef.current += 1;
    const currentDeps = {
      mp4Url, hlsUrl, dashUrl, sanitizedCompanionAudioUrls, hasAudio, sourceKind,
      posterUrl, autoPlay, loop, prebufferOnly, allowUnmutedAutoplay,
      preferredMuted, onMutedChange, onDiagnostics, reloadNonce,
      shouldUseCompanionAudio, directUrlOnly
    };
    if (prevDepsRef.current === null) {
      console.log(`[VideoPlayer trace] effect run #${effectRunCountRef.current} (initial mount)`);
    } else {
      const prev = prevDepsRef.current;
      const changed = {};
      for (const k of Object.keys(currentDeps)) {
        if (!Object.is(prev[k], currentDeps[k])) {
          changed[k] = { from: prev[k], to: currentDeps[k] };
        }
      }
      console.log(`[VideoPlayer trace] effect run #${effectRunCountRef.current} — changed deps:`, changed);
    }
    prevDepsRef.current = currentDeps;
    // END TEMP

    const video = videoRef.current;
    const companionAudio = companionAudioRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let loadAttemptActive = false;
    let companionAudioIndex = 0;
    let companionAudioReady = false;
    let syncIntervalId = null;

    function updateDiagnostics(partial) {
      onDiagnostics?.((prev) => ({
        ...(prev || {}),
        sourceKind,
        previewSource: sourceKind === 'preview',
        hasAudio,
        hasHls: Boolean(hlsUrl),
        hasDash: Boolean(dashUrl),
        hasMp4: Boolean(mp4Url),
        hasPoster: Boolean(posterUrl),
        directUrlOnly,
        companionAudioEnabled: shouldUseCompanionAudio,
        ...partial
      }));
    }

    function clearCompanionSync() {
      if (syncIntervalId) {
        window.clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    }

    function syncCompanionAudio(forceSeek = false) {
      if (!shouldUseCompanionAudio || !companionAudio) return;

      companionAudio.muted = video.muted;
      companionAudio.volume = video.volume;
      companionAudio.playbackRate = video.playbackRate;
      companionAudio.loop = loop && !prebufferOnly;

      if (forceSeek || Math.abs((companionAudio.currentTime || 0) - (video.currentTime || 0)) > 0.3) {
        try {
          companionAudio.currentTime = video.currentTime || 0;
        } catch {
          // Ignore seek sync failures until the audio element becomes seekable.
        }
      }
    }

    function pauseCompanionAudio() {
      if (!shouldUseCompanionAudio || !companionAudio) return;
      companionAudio.pause();
      clearCompanionSync();
    }

    function beginCompanionSyncLoop() {
      if (!shouldUseCompanionAudio || !companionAudio || syncIntervalId) return;
      syncIntervalId = window.setInterval(() => {
        syncCompanionAudio();
      }, 250);
    }

    function tryPlayCompanionAudio(forceSeek = false) {
      if (!shouldUseCompanionAudio || !companionAudio || video.paused || video.muted || !companionAudioReady) return;
      syncCompanionAudio(forceSeek);
      const playPromise = companionAudio.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
      beginCompanionSyncLoop();
    }

    function loadCompanionAudioCandidate(index = 0) {
      if (!shouldUseCompanionAudio || !companionAudio) return;
      const nextUrl = sanitizedCompanionAudioUrls[index];
      if (!nextUrl) {
        updateDiagnostics({ companionAudioFailed: true });
        return;
      }

      companionAudioIndex = index;
      companionAudioReady = false;
      companionAudio.pause();
      companionAudio.removeAttribute('src');
      companionAudio.src = nextUrl;
      companionAudio.load();
      updateDiagnostics({ companionAudioUrl: nextUrl, companionAudioFailed: false });
    }

    function clearTimeoutGuard() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function startTimeoutGuard() {
      if (!directUrlOnly || !loadAttemptActive) return;
      clearTimeoutGuard();
      timeoutRef.current = window.setTimeout(() => {
        updateDiagnostics({ loadingState: 'timeout', stalledOrTimedOut: true, timedOut: true });
      }, DIRECT_LOAD_TIMEOUT_MS);
    }

    function cleanupPlayers() {
      clearTimeoutGuard();
      clearCompanionSync();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.reset();
        dashPlayerRef.current = null;
      }
      if (companionAudio) {
        companionAudio.pause();
        companionAudio.removeAttribute('src');
        companionAudio.load();
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    function markReady() {
      clearTimeoutGuard();
      updateDiagnostics({
        loadingState: 'ready',
        stalledOrTimedOut: false,
        timedOut: false,
        errored: false,
        currentSrc: video.currentSrc
      });
    }

    const events = {
      loadedmetadata: () => {
        setVideoMetrics({
          ready: true,
          isPortrait: (video.videoHeight || 0) >= (video.videoWidth || 0)
        });
        logEvent(video, 'loadedmetadata');
      },
      loadeddata: () => {
        logEvent(video, 'loadeddata');
        markReady();
        tryPlayCompanionAudio();
      },
      canplay: () => {
        logEvent(video, 'canplay');
        markReady();
        tryPlayCompanionAudio();
      },
      canplaythrough: () => {
        logEvent(video, 'canplaythrough');
        markReady();
        tryPlayCompanionAudio();
      },
      play: () => {
        loadAttemptActive = true;
        logEvent(video, 'play');
        updateDiagnostics({ loadingState: directUrlOnly ? 'loading' : 'ready' });
        startTimeoutGuard();
        tryPlayCompanionAudio(true);
      },
      pause: () => {
        logEvent(video, 'pause');
        pauseCompanionAudio();
      },
      waiting: () => {
        logEvent(video, 'waiting');
        if (directUrlOnly) {
          updateDiagnostics({ loadingState: 'waiting' });
          startTimeoutGuard();
        }
        pauseCompanionAudio();
      },
      stalled: () => {
        logEvent(video, 'stalled');
        if (directUrlOnly) {
          updateDiagnostics({ loadingState: 'stalled', stalledOrTimedOut: true });
          startTimeoutGuard();
        }
        pauseCompanionAudio();
      },
      suspend: () => {
        logEvent(video, 'suspend');
        if (directUrlOnly && loadAttemptActive) {
          updateDiagnostics({ loadingState: 'suspend' });
        }
      },
      seeking: () => {
        logEvent(video, 'seeking');
        syncCompanionAudio(true);
      },
      seeked: () => {
        logEvent(video, 'seeked');
        syncCompanionAudio(true);
        tryPlayCompanionAudio();
      },
      ratechange: () => {
        logEvent(video, 'ratechange');
        syncCompanionAudio(true);
      },
      volumechange: () => {
        logEvent(video, 'volumechange');
        onMutedChange?.(video.muted);
        syncCompanionAudio();
        if (video.muted) {
          pauseCompanionAudio();
          return;
        }
        tryPlayCompanionAudio();
      },
      error: () => {
        logEvent(video, 'error');
        clearTimeoutGuard();
        pauseCompanionAudio();
        updateDiagnostics({ loadingState: 'error', stalledOrTimedOut: true, errored: true, currentSrc: video.currentSrc });
      }
    };

    Object.entries(events).forEach(([eventName, handler]) => {
      video.addEventListener(eventName, handler);
    });

    const companionAudioEvents = shouldUseCompanionAudio && companionAudio
      ? {
          canplay: () => {
            companionAudioReady = true;
            syncCompanionAudio(true);
            tryPlayCompanionAudio();
          },
          loadedmetadata: () => {
            companionAudioReady = true;
            syncCompanionAudio(true);
          },
          error: () => {
            const nextIndex = companionAudioIndex + 1;
            if (nextIndex >= sanitizedCompanionAudioUrls.length) {
              updateDiagnostics({ companionAudioFailed: true });
              return;
            }
            loadCompanionAudioCandidate(nextIndex);
          }
        }
      : null;

    if (companionAudioEvents && companionAudio) {
      Object.entries(companionAudioEvents).forEach(([eventName, handler]) => {
        companionAudio.addEventListener(eventName, handler);
      });
    }

    function tryAutoplay() {
      if (prebufferOnly || !autoPlay) return;
      // Always attempt unmuted first; the catch handler will mute and retry
      // if the browser blocks unmuted autoplay (no prior user interaction).
      video.muted = preferredMuted === true;

      function attemptPlay() {
        const playPromise = video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {
            if (!video.muted) {
              video.muted = true;
              onMutedChange?.(true);
              video.play().catch(() => {});
            }
          });
        }
      }

      if (video.readyState >= 2) {
        attemptPlay();
      } else {
        const onReady = () => {
          video.removeEventListener('canplay', onReady);
          video.removeEventListener('loadeddata', onReady);
          attemptPlay();
        };
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
        // Best-effort fallback: try anyway in case events already fired
        attemptPlay();
      }
    }

    async function attachMp4Fallback() {
      if (!mp4Url) return;
      if (isDev) console.log('[VideoPlayer] MP4 fallback');
      video.src = mp4Url;
      video.load();

      updateDiagnostics({
        playbackMode: 'mp4',
        audioTracksDetected: 0,
        currentSrc: mp4Url,
        loadingState: 'loading',
        autoplayAttempted: true,
        awaitingUserAction: false
      });
      loadAttemptActive = true;
      startTimeoutGuard();
      tryAutoplay();
    }

    async function attachDash() {
      if (!dashUrl) {
        await attachMp4Fallback();
        return;
      }

      try {
        const dashjs = await import('dashjs');
        if (cancelled) return;
        if (isDev) console.log('[VideoPlayer] using DASH');
        const playerFactory = dashjs.MediaPlayer || dashjs.default?.MediaPlayer;
        const player = playerFactory?.().create();
        if (player) {
          dashPlayerRef.current = player;
          updateDiagnostics({ playbackMode: 'dash', autoplayAttempted: true, loadingState: 'loading' });
          player.initialize(video, dashUrl, autoPlay && !prebufferOnly);
          player.setMute(false);
          player.on?.(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
            const audioTracks = player.getTracksFor?.('audio') || [];
            if (isDev) {
              console.log('[VideoPlayer] using DASH');
              console.log('[VideoPlayer] DASH stream initialized', {
                audioTracks: audioTracks.length,
                currentSrc: video.currentSrc
              });
            }
            updateDiagnostics({ playbackMode: 'dash', audioTracksDetected: audioTracks.length, currentSrc: video.currentSrc || dashUrl });
          });
          return;
        }
      } catch (error) {
        if (isDev) {
          console.warn('[VideoPlayer] DASH unavailable, falling back to MP4', error);
        }
      }

      await attachMp4Fallback();
    }

    async function attachSource() {
      cleanupPlayers();
      setVideoMetrics((prev) => ({ ...prev, ready: false }));
      logSourceInputs({ mp4Url, hlsUrl, dashUrl, hasAudio, sourceKind });

      video.loop = loop && !prebufferOnly;
      video.preload = directUrlOnly || prebufferOnly ? 'metadata' : 'auto';
      const shouldStartMuted = preferredMuted === true;
      video.defaultMuted = shouldStartMuted;
      video.muted = shouldStartMuted;
      video.playsInline = true;
      video.autoplay = autoPlay && !prebufferOnly;
      video.controls = !prebufferOnly;
      video.poster = posterUrl || '';

      if (shouldUseCompanionAudio && companionAudio) {
        companionAudio.preload = 'auto';
        companionAudio.muted = video.muted;
        companionAudio.volume = video.volume;
        companionAudio.loop = loop && !prebufferOnly;
        loadCompanionAudioCandidate(0);
      }

      if (hlsUrl) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          if (isDev) console.log('[VideoPlayer] using HLS');
          updateDiagnostics({ playbackMode: 'hls-native', audioTracksDetected: video.audioTracks?.length || 0, currentSrc: hlsUrl, autoplayAttempted: true, loadingState: 'loading' });
          video.src = hlsUrl;
          video.load();
          loadAttemptActive = true;
          tryAutoplay();
          return;
        }

        if (Hls.isSupported()) {
          if (isDev) console.log('[VideoPlayer] using HLS');
          updateDiagnostics({ playbackMode: 'hls', audioTracksDetected: 0, autoplayAttempted: true, loadingState: 'loading' });
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const audioTracks = hls.audioTracks || [];
            const levels = hls.levels || [];
            if (isDev) {
              console.log('[VideoPlayer] HLS manifest parsed', {
                audioTracks: audioTracks.length,
                levels: levels.length,
                currentSrc: video.currentSrc || hlsUrl
              });
            }
            updateDiagnostics({ playbackMode: 'hls', audioTracksDetected: audioTracks.length, currentSrc: video.currentSrc || hlsUrl });
            if (!cancelled) {
              loadAttemptActive = true;
              tryAutoplay();
            }
          });
          hls.on(Hls.Events.ERROR, async (_event, data) => {
            if (!data?.fatal || cancelled) return;
            if (isDev) {
              console.warn('[VideoPlayer] HLS failed, falling back', data);
            }
            hls.destroy();
            hlsRef.current = null;
            await attachDash();
          });
          return;
        }
      }

      await attachDash();
    }

    attachSource();

    return () => {
      cancelled = true;
      clearTimeoutGuard();
      clearCompanionSync();
      Object.entries(events).forEach(([eventName, handler]) => {
        video.removeEventListener(eventName, handler);
      });
      if (companionAudioEvents && companionAudio) {
        Object.entries(companionAudioEvents).forEach(([eventName, handler]) => {
          companionAudio.removeEventListener(eventName, handler);
        });
      }
      cleanupPlayers();
    };
  }, [mp4Url, hlsUrl, dashUrl, sanitizedCompanionAudioUrls, hasAudio, sourceKind, posterUrl, autoPlay, loop, prebufferOnly, allowUnmutedAutoplay, preferredMuted, onMutedChange, onDiagnostics, reloadNonce, shouldUseCompanionAudio, directUrlOnly]);

  if (prebufferOnly) {
    return <video ref={videoRef} playsInline preload="metadata" className={className} style={{ display: 'none' }} />;
  }

  const wrapperStyle = {
    width: '100%',
    minHeight: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent'
  };

  const videoStyle = {
    display: 'block',
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    background: 'transparent'
  };

  return (
    <div ref={wrapperRef} className="video-player-shell" style={wrapperStyle}>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        className={className}
        style={videoStyle}
        poster={posterUrl || undefined}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          event.stopPropagation();
          const target = videoRef.current;
          if (!target) return;
          if (target.paused) {
            const playPromise = target.play();
            playPromise?.catch?.(() => {});
          } else {
            target.pause();
          }
        }}
      />
      {shouldUseCompanionAudio ? <audio ref={companionAudioRef} preload="auto" style={{ display: 'none' }} /> : null}
    </div>
  );
});

export default VideoPlayer;
