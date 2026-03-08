import Hls from 'hls.js';
import { useEffect, useMemo, useRef } from 'react';

function deriveAudioCandidatesFromUrl(url) {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'v.redd.it') return [];

    const dashIndex = parsed.pathname.indexOf('/DASH_');
    const playlistIndex = parsed.pathname.indexOf('/DASHPlaylist');
    const splitIndex = dashIndex >= 0 ? dashIndex : playlistIndex;
    if (splitIndex < 0) return [];

    const basePath = parsed.pathname.slice(0, splitIndex);
    const names = ['DASH_AUDIO_192.mp4', 'DASH_AUDIO_128.mp4', 'DASH_AUDIO_96.mp4', 'DASH_AUDIO_64.mp4', 'DASH_audio.mp4', 'audio'];
    const out = [];

    for (const name of names) {
      const variants = [`${parsed.origin}${basePath}/${name}${parsed.search}`, `${parsed.origin}${basePath}/${name}`];
      for (const candidate of variants) {
        if (!out.includes(candidate)) out.push(candidate);
      }
    }

    return out;
  } catch {
    return [];
  }
}

function VideoPlayer({
  mp4Url,
  hlsUrl,
  dashUrl,
  audioUrlCandidates = [],
  hasAudio = null,
  className,
  autoPlay = true,
  loop = true,
  prebufferOnly = false,
  allowUnmutedAutoplay = false
}) {
  const videoRef = useRef(null);
  const companionAudioRef = useRef(null);

  const effectiveAudioCandidates = useMemo(() => {
    const merged = Array.isArray(audioUrlCandidates) ? [...audioUrlCandidates] : [];
    const derived = [
      ...deriveAudioCandidatesFromUrl(mp4Url),
      ...deriveAudioCandidatesFromUrl(hlsUrl),
      ...deriveAudioCandidatesFromUrl(dashUrl)
    ];

    for (const candidate of derived) {
      if (!merged.includes(candidate)) merged.push(candidate);
    }

    return merged;
  }, [audioUrlCandidates, mp4Url, hlsUrl, dashUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls = null;
    let audioIndex = 0;
    const wasFullscreen = !prebufferOnly && document.fullscreenElement === video;

    const syncTime = () => {
      const audio = companionAudioRef.current;
      if (!audio || audio.seeking) return;
      const drift = Math.abs((audio.currentTime || 0) - (video.currentTime || 0));
      if (drift > 0.35) {
        audio.currentTime = video.currentTime || 0;
      }
    };

    const syncState = () => {
      const audio = companionAudioRef.current;
      if (!audio) return;
      audio.playbackRate = video.playbackRate || 1;
      audio.loop = video.loop;
      audio.volume = video.volume;
      audio.muted = video.muted;
      if (!video.paused) {
        audio.play().catch(() => {});
      }
    };

    const tryAudioCandidate = () => {
      const audio = companionAudioRef.current;
      if (!audio) return;
      if (audioIndex >= effectiveAudioCandidates.length) return;
      audio.src = effectiveAudioCandidates[audioIndex];
      audio.load();
      audioIndex += 1;
    };

    const setupCompanion = () => {
      const shouldTryCompanion = !prebufferOnly && hasAudio !== true && effectiveAudioCandidates.length > 0;
      if (!shouldTryCompanion) {
        companionAudioRef.current = null;
        return undefined;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      companionAudioRef.current = audio;
      syncState();

      const onAudioError = () => tryAudioCandidate();
      audio.addEventListener('error', onAudioError);
      tryAudioCandidate();

      const onPlay = () => syncState();
      const onPause = () => companionAudioRef.current?.pause();
      const onSeeked = () => syncTime();
      const onTime = () => syncTime();
      const onRate = () => {
        const a = companionAudioRef.current;
        if (a) a.playbackRate = video.playbackRate || 1;
      };
      const onVolume = () => {
        const a = companionAudioRef.current;
        if (!a) return;
        a.volume = video.volume;
        a.muted = video.muted;
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('ratechange', onRate);
      video.addEventListener('volumechange', onVolume);

      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('timeupdate', onTime);
        video.removeEventListener('ratechange', onRate);
        video.removeEventListener('volumechange', onVolume);
        audio.pause();
        companionAudioRef.current = null;
      };
    };

    const tryPlay = () => {
      if (prebufferOnly || !autoPlay) return;
      if (allowUnmutedAutoplay) video.muted = false;
      const p = video.play();
      if (p?.catch) {
        p.catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    };

    const restoreFullscreen = () => {
      if (prebufferOnly || !wasFullscreen) return;
      if (document.fullscreenElement === video) return;
      if (typeof video.requestFullscreen === 'function') {
        video.requestFullscreen().catch(() => {});
      }
    };

    const onMetadata = () => {
      if (prebufferOnly) {
        video.pause();
        return;
      }
      tryPlay();
      restoreFullscreen();
    };

    video.loop = loop && !prebufferOnly;
    video.preload = prebufferOnly ? 'auto' : 'metadata';
    if (prebufferOnly) {
      video.muted = true;
      video.playsInline = true;
      video.autoplay = false;
    }

    video.addEventListener('loadedmetadata', onMetadata);
    const teardownCompanion = setupCompanion();

    if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      if (prebufferOnly) video.load();
      else {
        tryPlay();
        restoreFullscreen();
      }
      return () => {
        video.removeEventListener('loadedmetadata', onMetadata);
        teardownCompanion?.();
      };
    }

    if (hlsUrl && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (prebufferOnly) {
          video.pause();
          return;
        }
        tryPlay();
        restoreFullscreen();
      });
    } else {
      video.src = mp4Url || hlsUrl || '';
      if (prebufferOnly) video.load();
      else {
        tryPlay();
        restoreFullscreen();
      }
    }

    return () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      teardownCompanion?.();
      if (hls) hls.destroy();
    };
  }, [
    mp4Url,
    hlsUrl,
    dashUrl,
    effectiveAudioCandidates,
    hasAudio,
    autoPlay,
    loop,
    prebufferOnly,
    allowUnmutedAutoplay
  ]);

  if (prebufferOnly) {
    return <video ref={videoRef} playsInline preload="auto" className={className} style={{ display: 'none' }} />;
  }

  return (
    <div className="video-player-wrap">
      <video ref={videoRef} controls playsInline preload="metadata" className={className} />
    </div>
  );
}

export default VideoPlayer;
