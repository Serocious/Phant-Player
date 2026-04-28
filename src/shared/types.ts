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
  sampleRate: number | null; // Hz
  channels: number | null;
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
  FAVOURITES_GET_ALL: 'favourites:getAll',
  FAVOURITES_GET_TRACKS: 'favourites:getTracks',
  FAVOURITES_ADD: 'favourites:add',
  FAVOURITES_REMOVE: 'favourites:remove',
  TRACK_DETAILS: 'library:trackDetails',
  PLAYLIST_LIST: 'playlist:list',
  PLAYLIST_CREATE: 'playlist:create',
  PLAYLIST_RENAME: 'playlist:rename',
  PLAYLIST_DELETE: 'playlist:delete',
  PLAYLIST_GET_TRACKS: 'playlist:getTracks',
  PLAYLIST_ADD_TRACK: 'playlist:addTrack',
  PLAYLIST_REMOVE_TRACK: 'playlist:removeTrack',
  NOTE_GET: 'note:get',
  NOTE_SET: 'note:set',
  SHOW_IN_FOLDER: 'app:showInFolder',
  SCAN_PROGRESS: 'scan:progress',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  GET_USER_DATA_PATH: 'app:getUserDataPath',
  PICK_FOLDER: 'app:pickFolder',
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

export interface Playlist {
  id: number;
  name: string;
  createdAt: number;
  trackCount: number;
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

/**
 * On-demand details about a track: combines DB metadata with live filesystem
 * info (file size) and any data we re-read from the file (e.g. sampleRate
 * for tracks scanned before that field existed).
 */
export interface TrackDetails {
  filePath: string;
  fileName: string;
  fileSize: number; // bytes
  format: string;
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  modifiedAt: number; // unix ms
}
