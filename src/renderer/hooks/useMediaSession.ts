import { useEffect } from 'react';
import type { Track } from '../../shared/types';

interface PlayerControls {
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
}

interface PlayerSnapshot {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

/**
 * Wire the audio player into Chromium's MediaSession API. On Windows,
 * Electron forwards this to the System Media Transport Controls (SMTC),
 * which is read by:
 *   - Discord Music Presence (rich presence)
 *   - The Windows volume overlay (now-playing display)
 *   - Bluetooth headphone media keys
 *   - The Windows lock screen
 *
 * Album art is fetched once per track and registered as artwork with SMTC.
 */
export function useMediaSession(state: PlayerSnapshot, controls: PlayerControls) {
  // Register action handlers once
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => controls.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => controls.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => controls.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => controls.next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) controls.seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || 10;
      controls.seek(Math.max(0, state.currentTime - skipTime));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || 10;
      controls.seek(state.currentTime + skipTime);
    });

    return () => {
      // Don't bother unregistering - they get overwritten anyway
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  // Update metadata when the track changes
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const t = state.currentTrack;
    if (!t) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    let cancelled = false;

    (async () => {
      // Get album art as a URL for SMTC to display
      let artwork: MediaImage[] = [];
      try {
        const artUrl = await window.api.getAlbumArt(t.filePath);
        if (artUrl && !cancelled) {
          artwork = [
            { src: artUrl, sizes: '512x512', type: 'image/jpeg' },
          ];
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album,
        artwork,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [state.currentTrack?.filePath]);

  // Update playback state and position state continuously
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
  }, [state.isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!state.duration || !isFinite(state.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: state.duration,
        playbackRate: 1,
        position: Math.min(state.currentTime, state.duration),
      });
    } catch {
      // setPositionState can throw if values are invalid
    }
  }, [state.currentTime, state.duration]);
}
