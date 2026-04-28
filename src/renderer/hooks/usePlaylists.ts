import { useState, useEffect, useCallback } from 'react';
import type { Playlist } from '../../shared/types';

/**
 * Manages the user's playlists at App level. Exposes CRUD operations that
 * write through to the database via IPC and refresh the local list.
 */
export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const list = await window.api.playlistList();
    setPlaylists(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (name: string): Promise<Playlist> => {
    const playlist = await window.api.playlistCreate(name);
    await refresh();
    return playlist;
  }, [refresh]);

  const rename = useCallback(async (id: number, newName: string) => {
    await window.api.playlistRename(id, newName);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await window.api.playlistDelete(id);
    await refresh();
  }, [refresh]);

  const addTrack = useCallback(async (playlistId: number, filePath: string) => {
    await window.api.playlistAddTrack(playlistId, filePath);
    await refresh(); // updates trackCount
  }, [refresh]);

  const removeTrack = useCallback(async (playlistId: number, filePath: string) => {
    await window.api.playlistRemoveTrack(playlistId, filePath);
    await refresh();
  }, [refresh]);

  return {
    playlists,
    loaded,
    refresh,
    create,
    rename,
    remove,
    addTrack,
    removeTrack,
  };
}
