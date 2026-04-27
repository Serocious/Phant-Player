import { contextBridge, ipcRenderer } from 'electron';
import { IPC, Album, Track, Artist, ScanProgress, ScanResult, LastfmStatus, ScrobbleData } from '../shared/types';

const api = {
  scanLibrary: (rootDir: string): Promise<ScanResult> =>
    ipcRenderer.invoke(IPC.LIBRARY_SCAN, rootDir),

  getAlbums: (): Promise<Album[]> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_ALBUMS),

  getTracksByAlbum: (albumArtist: string, albumName: string): Promise<Track[]> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_TRACKS_BY_ALBUM, albumArtist, albumName),

  getAllTracks: (): Promise<Track[]> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_ALL_TRACKS),

  getArtists: (): Promise<Artist[]> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_ARTISTS),

  getAlbumsByArtist: (artistName: string): Promise<Album[]> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_ALBUMS_BY_ARTIST, artistName),

  favouritesGetAll: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC.FAVOURITES_GET_ALL),

  favouritesGetTracks: (): Promise<Track[]> =>
    ipcRenderer.invoke(IPC.FAVOURITES_GET_TRACKS),

  favouritesAdd: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.FAVOURITES_ADD, filePath),

  favouritesRemove: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.FAVOURITES_REMOVE, filePath),

  getAlbumArt: (trackFilePath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_ALBUM_ART, trackFilePath),

  getTrackFileUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.LIBRARY_GET_TRACK_FILE, filePath),

  getSetting: <T = any>(key: string): Promise<T | null> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET, key),

  setSetting: (key: string, value: any): Promise<boolean> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),

  getUserDataPath: (): Promise<string> =>
    ipcRenderer.invoke(IPC.GET_USER_DATA_PATH),

  pickFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.PICK_FOLDER, defaultPath),

  onScanProgress: (cb: (p: ScanProgress) => void) => {
    const listener = (_evt: any, p: ScanProgress) => cb(p);
    ipcRenderer.on(IPC.SCAN_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC.SCAN_PROGRESS, listener);
  },

  // ---- Last.fm ----
  lastfmStatus: (): Promise<LastfmStatus> =>
    ipcRenderer.invoke(IPC.LASTFM_STATUS),

  lastfmStartAuth: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.LASTFM_START_AUTH),

  lastfmCompleteAuth: (): Promise<{ username: string }> =>
    ipcRenderer.invoke(IPC.LASTFM_COMPLETE_AUTH),

  lastfmDisconnect: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.LASTFM_DISCONNECT),

  lastfmNowPlaying: (track: ScrobbleData): Promise<void> =>
    ipcRenderer.invoke(IPC.LASTFM_NOW_PLAYING, track),

  lastfmScrobble: (track: ScrobbleData): Promise<void> =>
    ipcRenderer.invoke(IPC.LASTFM_SCROBBLE, track),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
