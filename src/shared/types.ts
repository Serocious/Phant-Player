export interface Track {
  id: number;
  filePath: string;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  trackNumber: number;
  diskNumber: number;
  duration: number; // seconds
  year: number | null;
  genre: string | null;
  bitrate: number | null;
  format: string; // 'mp3', 'flac', etc.
}

export interface Album {
  id: number;
  name: string;
  artist: string; // album artist
  year: number | null;
  trackCount: number;
  artPath: string | null; // file path or null
  firstTrackPath: string; // used to derive cover if no art
}

export interface ScanProgress {
  scanned: number;
  total: number;
  current: string;
}

export interface ScanResult {
  tracks: number;
  albums: number;
  errors: string[];
}

// IPC channels (string constants for type safety)
export const IPC = {
  LIBRARY_SCAN: 'library:scan',
  LIBRARY_GET_ALBUMS: 'library:getAlbums',
  LIBRARY_GET_TRACKS_BY_ALBUM: 'library:getTracksByAlbum',
  LIBRARY_GET_ALBUM_ART: 'library:getAlbumArt',
  LIBRARY_GET_TRACK_FILE: 'library:getTrackFile',
  LIBRARY_GET_ALL_TRACKS: 'library:getAllTracks',
  LIBRARY_GET_ARTISTS: 'library:getArtists',
  LIBRARY_GET_ALBUMS_BY_ARTIST: 'library:getAlbumsByArtist',
  SCAN_PROGRESS: 'scan:progress',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  GET_USER_DATA_PATH: 'app:getUserDataPath',
  LASTFM_STATUS: 'lastfm:status',
  LASTFM_START_AUTH: 'lastfm:startAuth',
  LASTFM_COMPLETE_AUTH: 'lastfm:completeAuth',
  LASTFM_DISCONNECT: 'lastfm:disconnect',
  LASTFM_NOW_PLAYING: 'lastfm:nowPlaying',
  LASTFM_SCROBBLE: 'lastfm:scrobble',
} as const;

export interface Artist {
  name: string;
  albumCount: number;
  trackCount: number;
  /** filePath of one track by this artist, used to derive a representative cover */
  representativeTrackPath: string;
}

export interface LastfmStatus {
  configured: boolean; // API key + secret present in config
  authenticated: boolean; // session key present
  username: string | null;
}

export interface ScrobbleData {
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  duration?: number;
  timestamp?: number;
}
