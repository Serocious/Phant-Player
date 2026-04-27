import type { Album, Track, Artist, ScanProgress, ScanResult, LastfmStatus, ScrobbleData } from '../shared/types';

declare global {
  interface Window {
    api: {
      scanLibrary: (rootDir: string) => Promise<ScanResult>;
      getAlbums: () => Promise<Album[]>;
      getTracksByAlbum: (albumArtist: string, albumName: string) => Promise<Track[]>;
      getAllTracks: () => Promise<Track[]>;
      getArtists: () => Promise<Artist[]>;
      getAlbumsByArtist: (artistName: string) => Promise<Album[]>;
      getAlbumArt: (trackFilePath: string) => Promise<string | null>;
      getTrackFileUrl: (filePath: string) => Promise<string>;
      getSetting: <T = any>(key: string) => Promise<T | null>;
      setSetting: (key: string, value: any) => Promise<boolean>;
      getUserDataPath: () => Promise<string>;
      onScanProgress: (cb: (p: ScanProgress) => void) => () => void;

      lastfmStatus: () => Promise<LastfmStatus>;
      lastfmStartAuth: () => Promise<boolean>;
      lastfmCompleteAuth: () => Promise<{ username: string }>;
      lastfmDisconnect: () => Promise<boolean>;
      lastfmNowPlaying: (track: ScrobbleData) => Promise<void>;
      lastfmScrobble: (track: ScrobbleData) => Promise<void>;
    };
  }
}

export {};
