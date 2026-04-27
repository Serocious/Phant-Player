import { useEffect, useRef, useState, useCallback } from 'react';
import type { Track } from '../../shared/types';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  /** The play queue in playback order (already shuffled if shuffle is on) */
  queue: Track[];
  /** Index into queue of the currently playing track, or -1 if nothing */
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

/**
 * Internal scrobble tracking, kept in a ref to avoid re-renders.
 */
interface ScrobbleState {
  track: Track | null;
  startedAt: Date | null;
  /** Cumulative seconds of *actual* playback (excludes paused time). */
  secondsPlayed: number;
  nowPlayingSent: boolean;
  scrobbled: boolean;
  lastTimeUpdate: number;
}

/**
 * Last.fm rule: scrobble if track ≥ 30s long AND we've played at least
 * min(4 minutes, 50% of duration).
 */
function shouldScrobble(track: Track, secondsPlayed: number): boolean {
  if (track.duration < 30) return false;
  const threshold = Math.min(240, track.duration / 2);
  return secondsPlayed >= threshold;
}

/**
 * Fisher-Yates shuffle, returns a new array.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // The original (un-shuffled) order of the current queue.
  // We keep this so toggling shuffle off restores the original order.
  const originalOrderRef = useRef<Track[]>([]);

  // Scrobble tracking lives in a ref to avoid re-renders on every tick.
  const scrobbleRef = useRef<ScrobbleState>({
    track: null,
    startedAt: null,
    secondsPlayed: 0,
    nowPlayingSent: false,
    scrobbled: false,
    lastTimeUpdate: 0,
  });

  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: 'off',
  });

  // Latest state in a ref so audio event handlers can see fresh values
  // without re-binding on every render.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------- audio element setup ----------
  useEffect(() => {
    const audio = new Audio();
    audio.volume = stateRef.current.volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const audio = audioRef.current;
      if (!audio) return;

      // Track played-seconds for scrobble logic. Only count time when the
      // audio element is actually playing.
      const sb = scrobbleRef.current;
      const now = audio.currentTime;
      if (!audio.paused) {
        const delta = now - sb.lastTimeUpdate;
        if (delta > 0 && delta < 5) {
          // delta < 5 filters out big jumps from seeking
          sb.secondsPlayed += delta;
        }
      }
      sb.lastTimeUpdate = now;

      // Send "now playing" once, after a few seconds
      if (sb.track && !sb.nowPlayingSent && sb.secondsPlayed >= 3) {
        sb.nowPlayingSent = true;
        const tr = sb.track;
        window.api.lastfmNowPlaying({
          artist: tr.artist,
          track: tr.title,
          album: tr.album,
          albumArtist: tr.albumArtist,
          trackNumber: tr.trackNumber || undefined,
          duration: tr.duration || undefined,
        }).catch(() => {});
      }

      // Scrobble once threshold is hit
      if (sb.track && !sb.scrobbled && sb.startedAt && shouldScrobble(sb.track, sb.secondsPlayed)) {
        sb.scrobbled = true;
        const tr = sb.track;
        window.api.lastfmScrobble({
          artist: tr.artist,
          track: tr.title,
          album: tr.album,
          albumArtist: tr.albumArtist,
          trackNumber: tr.trackNumber || undefined,
          duration: tr.duration || undefined,
          timestamp: Math.floor(sb.startedAt.getTime() / 1000),
        }).catch(() => {});
      }

      setState((s) => ({ ...s, currentTime: audio.currentTime, duration: audio.duration || 0 }));
    };

    const onEnded = () => {
      // Decide what to do based on repeat mode
      const cur = stateRef.current;
      if (cur.repeat === 'one' && cur.currentTrack) {
        // restart same track
        audio.currentTime = 0;
        audio.play().catch(() => {});
        // reset scrobble state for the replay
        resetScrobble(cur.currentTrack);
        return;
      }

      // Advance to next, or stop, or wrap
      const nextIndex = cur.queueIndex + 1;
      if (nextIndex < cur.queue.length) {
        const next = cur.queue[nextIndex];
        loadAndPlayInternal(next);
        setState((s) => ({
          ...s,
          queueIndex: nextIndex,
          currentTrack: next,
          isPlaying: true,
          currentTime: 0,
        }));
      } else if (cur.repeat === 'all' && cur.queue.length > 0) {
        const next = cur.queue[0];
        loadAndPlayInternal(next);
        setState((s) => ({
          ...s,
          queueIndex: 0,
          currentTrack: next,
          isPlaying: true,
          currentTime: 0,
        }));
      } else {
        // End of queue, repeat off
        setState((s) => ({ ...s, isPlaying: false }));
      }
    };

    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
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

  // ---------- helpers ----------

  const resetScrobble = (track: Track) => {
    scrobbleRef.current = {
      track,
      startedAt: new Date(),
      secondsPlayed: 0,
      nowPlayingSent: false,
      scrobbled: false,
      lastTimeUpdate: 0,
    };
  };

  const loadAndPlayInternal = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    resetScrobble(track);
    const url = await window.api.getTrackFileUrl(track.filePath);
    audio.src = url;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (e) {
      console.error('Playback failed', e);
    }
  }, []);

  // ---------- public API ----------

  /**
   * Replace the queue with a new list and start playing at the given index.
   * Respects current shuffle setting.
   */
  const playQueue = useCallback((tracks: Track[], startIndex: number) => {
    if (tracks.length === 0) return;
    const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));

    originalOrderRef.current = tracks;

    let queue: Track[];
    let queueIndex: number;

    if (stateRef.current.shuffle) {
      // Put the chosen track first, then shuffle the rest after it
      const startTrack = tracks[idx];
      const others = tracks.filter((_, i) => i !== idx);
      queue = [startTrack, ...shuffleArray(others)];
      queueIndex = 0;
    } else {
      queue = tracks;
      queueIndex = idx;
    }

    const startTrack = queue[queueIndex];
    setState((s) => ({
      ...s,
      queue,
      queueIndex,
      currentTrack: startTrack,
      isPlaying: true,
      currentTime: 0,
    }));
    loadAndPlayInternal(startTrack);
  }, [loadAndPlayInternal]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.currentTrack) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, []);

  const next = useCallback(() => {
    const cur = stateRef.current;
    const nextIndex = cur.queueIndex + 1;
    if (nextIndex < cur.queue.length) {
      const t = cur.queue[nextIndex];
      setState((s) => ({
        ...s,
        queueIndex: nextIndex,
        currentTrack: t,
        isPlaying: true,
        currentTime: 0,
      }));
      loadAndPlayInternal(t);
    } else if (cur.repeat === 'all' && cur.queue.length > 0) {
      const t = cur.queue[0];
      setState((s) => ({
        ...s,
        queueIndex: 0,
        currentTrack: t,
        isPlaying: true,
        currentTime: 0,
      }));
      loadAndPlayInternal(t);
    }
  }, [loadAndPlayInternal]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // If more than 3 seconds in, restart the current track instead
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const cur = stateRef.current;
    const prevIndex = cur.queueIndex - 1;
    if (prevIndex >= 0) {
      const t = cur.queue[prevIndex];
      setState((s) => ({
        ...s,
        queueIndex: prevIndex,
        currentTrack: t,
        isPlaying: true,
        currentTime: 0,
      }));
      loadAndPlayInternal(t);
    } else {
      // restart current
      audio.currentTime = 0;
    }
  }, [loadAndPlayInternal]);

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

  /**
   * Toggle shuffle. When turning ON: keeps the current track playing, shuffles
   * everything else into a new order after it. When turning OFF: restores the
   * original order, with the current track found at its original position.
   */
  const toggleShuffle = useCallback(() => {
    setState((s) => {
      const newShuffle = !s.shuffle;
      const cur = s.currentTrack;
      if (!cur || s.queue.length === 0) {
        return { ...s, shuffle: newShuffle };
      }

      if (newShuffle) {
        // turning ON: current track stays, shuffle the rest
        const original = originalOrderRef.current.length > 0 ? originalOrderRef.current : s.queue;
        // Remember original order based on current queue (in case it was set without going through playQueue)
        if (originalOrderRef.current.length === 0) originalOrderRef.current = s.queue;
        const others = original.filter((t) => t.filePath !== cur.filePath);
        const newQueue = [cur, ...shuffleArray(others)];
        return { ...s, shuffle: true, queue: newQueue, queueIndex: 0 };
      } else {
        // turning OFF: restore original order
        const original = originalOrderRef.current.length > 0 ? originalOrderRef.current : s.queue;
        const newIndex = original.findIndex((t) => t.filePath === cur.filePath);
        return {
          ...s,
          shuffle: false,
          queue: original,
          queueIndex: newIndex >= 0 ? newIndex : 0,
        };
      }
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setState((s) => {
      const next: RepeatMode = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off';
      return { ...s, repeat: next };
    });
  }, []);

  /**
   * Add a track immediately after the currently playing one. If nothing is
   * playing, starts playing the track.
   */
  const addToQueueNext = useCallback((track: Track) => {
    setState((s) => {
      if (s.queueIndex < 0 || !s.currentTrack) {
        // Nothing playing: start playing this track immediately
        originalOrderRef.current = [track];
        loadAndPlayInternal(track);
        return {
          ...s,
          queue: [track],
          queueIndex: 0,
          currentTrack: track,
          isPlaying: true,
          currentTime: 0,
        };
      }
      // Insert at queueIndex + 1
      const newQueue = [
        ...s.queue.slice(0, s.queueIndex + 1),
        track,
        ...s.queue.slice(s.queueIndex + 1),
      ];
      // Keep originalOrder in sync — append at the end so toggling shuffle later doesn't lose it
      originalOrderRef.current = [...originalOrderRef.current, track];
      return { ...s, queue: newQueue };
    });
  }, [loadAndPlayInternal]);

  /**
   * Append a track to the end of the queue.
   */
  const addToQueueEnd = useCallback((track: Track) => {
    setState((s) => {
      if (s.queueIndex < 0 || !s.currentTrack) {
        originalOrderRef.current = [track];
        loadAndPlayInternal(track);
        return {
          ...s,
          queue: [track],
          queueIndex: 0,
          currentTrack: track,
          isPlaying: true,
          currentTime: 0,
        };
      }
      originalOrderRef.current = [...originalOrderRef.current, track];
      return { ...s, queue: [...s.queue, track] };
    });
  }, [loadAndPlayInternal]);

  /**
   * Remove a track from the queue by its index in the current queue order.
   * Cannot remove the currently playing track.
   */
  const removeFromQueue = useCallback((idx: number) => {
    setState((s) => {
      if (idx === s.queueIndex || idx < 0 || idx >= s.queue.length) return s;
      const removed = s.queue[idx];
      const newQueue = s.queue.filter((_, i) => i !== idx);
      const newIndex = idx < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      // Also remove from original order
      originalOrderRef.current = originalOrderRef.current.filter((t) => t !== removed);
      return { ...s, queue: newQueue, queueIndex: newIndex };
    });
  }, []);

  /**
   * Jump directly to a queue index.
   */
  const jumpToQueueIndex = useCallback((idx: number) => {
    const cur = stateRef.current;
    if (idx < 0 || idx >= cur.queue.length) return;
    const t = cur.queue[idx];
    setState((s) => ({
      ...s,
      queueIndex: idx,
      currentTrack: t,
      isPlaying: true,
      currentTime: 0,
    }));
    loadAndPlayInternal(t);
  }, [loadAndPlayInternal]);

  return {
    state,
    playQueue,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    addToQueueNext,
    addToQueueEnd,
    removeFromQueue,
    jumpToQueueIndex,
  };
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
