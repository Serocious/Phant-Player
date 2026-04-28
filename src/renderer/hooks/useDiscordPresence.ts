import { useEffect, useRef } from 'react';
import type { PlayerState } from './usePlayer';

/**
 * Pushes the player's current activity to Discord Rich Presence whenever
 * the relevant fields change. Sends null when nothing is playing.
 *
 * The Discord side handles enable/disable and rate limiting — this just
 * fires updates whenever the player state changes.
 */
export function useDiscordPresence(state: PlayerState, enabled: boolean) {
  // Track when the current track started playing so the timestamp is stable
  // across pause/resume cycles. We only reset it when the track changes.
  const startTimestampRef = useRef<number | null>(null);
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      window.api.discordRpcSetActivity(null).catch(() => {});
      return;
    }

    const t = state.currentTrack;
    if (!t) {
      window.api.discordRpcSetActivity(null).catch(() => {});
      currentPathRef.current = null;
      startTimestampRef.current = null;
      return;
    }

    // Track changed → reset start timestamp so elapsed time is correct
    if (currentPathRef.current !== t.filePath) {
      currentPathRef.current = t.filePath;
      // Subtract currentTime so the elapsed counter shows the actual position
      startTimestampRef.current = Math.floor(Date.now() / 1000) - Math.floor(state.currentTime);
    }

    window.api.discordRpcSetActivity({
      artist: t.artist,
      title: t.title,
      album: t.album,
      durationSec: Math.floor(t.duration || 0),
      startTimestampSec: startTimestampRef.current ?? Math.floor(Date.now() / 1000),
      paused: !state.isPlaying,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentTrack?.filePath, state.isPlaying, enabled]);
}
