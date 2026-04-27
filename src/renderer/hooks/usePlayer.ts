import { useEffect, useRef, useState, useCallback } from 'react';
import type { Track } from '../../shared/types';

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

interface ScrobbleTracking {
  track: Track | null;
  startedAt: Date | null;
  secondsPlayed: number;
  lastTickAt: number; // performance.now() timestamp of last tick
  scrobbled: boolean; // already submitted for this play?
  nowPlayingSent: boolean; // already sent the nowPlaying update?
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackingRef = useRef<ScrobbleTracking>({
    track: null,
    startedAt: null,
    secondsPlayed: 0,
    lastTickAt: 0,
    scrobbled: false,
    nowPlayingSent: false,
  });

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });

  /**
   * Reset tracking when we move to a new track.
   * Called from loadAndPlay before starting a new track.
   */
  const resetTracking = useCallback((track: Track) => {
    trackingRef.current = {
      track,
      startedAt: new Date(),
      secondsPlayed: 0,
      lastTickAt: performance.now(),
      scrobbled: false,
      nowPlayingSent: false,
    };
  }, []);

  /**
   * Should the current track be scrobbled now?
   * Last.fm rules: track >= 30s AND played for either 240s or half its duration.
   */
  const shouldScrobble = useCallback((track: Track, played: number) => {
    if (track.duration < 30) return false;
    return played >= 240 || played >= track.duration / 2;
  }, []);

  // Initialise audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime, duration: audio.duration || 0 }));

      // Scrobble tracking: accumulate playtime only when actually playing
      const now = performance.now();
      const t = trackingRef.current;
      if (t.track && !audio.paused) {
        const delta = (now - t.lastTickAt) / 1000;
        // Sanity: cap delta at 2s to avoid huge jumps from tab being inactive
        if (delta > 0 && delta < 2) {
          t.secondsPlayed += delta;
        }
        t.lastTickAt = now;

        // Send nowPlaying once, ~3 seconds in
        if (!t.nowPlayingSent && t.secondsPlayed >= 3) {
          t.nowPlayingSent = true;
          const tr = t.track;
          window.api.lastfmNowPlaying({
            artist: tr.artist,
            track: tr.title,
            album: tr.album,
            albumArtist: tr.albumArtist,
            trackNumber: tr.trackNumber || undefined,
            duration: tr.duration || undefined,
          }).catch(() => {});
        }

        // Submit scrobble once threshold is met
        if (!t.scrobbled && t.startedAt && shouldScrobble(t.track, t.secondsPlayed)) {
          t.scrobbled = true;
          const tr = t.track;
          window.api.lastfmScrobble({
            artist: tr.artist,
            track: tr.title,
            album: tr.album,
            albumArtist: tr.albumArtist,
            trackNumber: tr.trackNumber || undefined,
            duration: tr.duration || undefined,
            timestamp: Math.floor(t.startedAt.getTime() / 1000),
          }).catch(() => {});
        }
      } else {
        // Even when paused, keep lastTickAt fresh so the next resume calculates correctly
        t.lastTickAt = now;
      }
    };

    const onEnded = () => {
      setState((s) => {
        const nextIndex = s.queueIndex + 1;
        if (nextIndex < s.queue.length) {
          queueMicrotask(() => loadAndPlay(s.queue[nextIndex]));
          return { ...s, queueIndex: nextIndex, currentTrack: s.queue[nextIndex], isPlaying: true, currentTime: 0 };
        }
        return { ...s, isPlaying: false };
      });
    };
    const onPlay = () => {
      // Reset tick timer on resume so we don't count paused time
      trackingRef.current.lastTickAt = performance.now();
      setState((s) => ({ ...s, isPlaying: true }));
    };
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAndPlay = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    resetTracking(track);
    const url = await window.api.getTrackFileUrl(track.filePath);
    audio.src = url;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (e) {
      console.error('Playback failed', e);
    }
  }, [resetTracking]);

  const playQueue = useCallback((tracks: Track[], startIndex: number) => {
    if (tracks.length === 0) return;
    const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
    setState((s) => ({
      ...s,
      queue: tracks,
      queueIndex: idx,
      currentTrack: tracks[idx],
      isPlaying: true,
      currentTime: 0,
    }));
    loadAndPlay(tracks[idx]);
  }, [loadAndPlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentTrack) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [state.currentTrack]);

  const next = useCallback(() => {
    setState((s) => {
      const nextIndex = s.queueIndex + 1;
      if (nextIndex < s.queue.length) {
        queueMicrotask(() => loadAndPlay(s.queue[nextIndex]));
        return { ...s, queueIndex: nextIndex, currentTrack: s.queue[nextIndex], isPlaying: true, currentTime: 0 };
      }
      return s;
    });
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setState((s) => {
      const prevIndex = s.queueIndex - 1;
      if (prevIndex >= 0) {
        queueMicrotask(() => loadAndPlay(s.queue[prevIndex]));
        return { ...s, queueIndex: prevIndex, currentTrack: s.queue[prevIndex], isPlaying: true, currentTime: 0 };
      }
      if (audioRef.current) audioRef.current.currentTime = 0;
      return s;
    });
  }, [loadAndPlay]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0));
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (audioRef.current) audioRef.current.volume = clamped;
    setState((s) => ({ ...s, volume: clamped }));
  }, []);

  return {
    state,
    playQueue,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
  };
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
