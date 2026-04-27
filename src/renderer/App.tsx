import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Album, Track, Artist, ScanProgress, LastfmStatus } from '../shared/types';
import { usePlayer, formatTime } from './hooks/usePlayer';
import { useMediaSession } from './hooks/useMediaSession';
import { AlbumCover } from './components/AlbumCover';
import {
  PlayIcon, PauseIcon, PrevIcon, NextIcon, VolumeIcon,
  AlbumsIcon, SongsIcon, ArtistsIcon,
  RescanIcon, SettingsIcon, ChevronLeftIcon, ChevronDownIcon,
} from './components/Icons';
import logoUrl from './assets/logo.png';

type ViewKind = 'albums' | 'songs' | 'artists' | 'settings' | 'album-detail' | 'artist-detail';

type View =
  | { kind: 'albums' }
  | { kind: 'songs' }
  | { kind: 'artists' }
  | { kind: 'settings' }
  | { kind: 'album-detail'; album: Album }
  | { kind: 'artist-detail'; artist: Artist };

type AlbumSort = 'artist' | 'name' | 'year' | 'tracks';

const ALBUM_SORT_LABELS: Record<AlbumSort, string> = {
  artist: 'Artist',
  name: 'Album name',
  year: 'Year',
  tracks: 'Track count',
};

export default function App() {
  const player = usePlayer();
  const [musicFolder, setMusicFolder] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [view, setView] = useState<View>({ kind: 'albums' });
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useMediaSession(player.state, {
    togglePlay: player.togglePlay,
    next: player.next,
    prev: player.prev,
    seek: player.seek,
  });

  useEffect(() => {
    (async () => {
      const folder = await window.api.getSetting<string>('musicFolder');
      if (folder) {
        setMusicFolder(folder);
        const a = await window.api.getAlbums();
        setAlbums(a);
        if (a.length === 0) {
          await runScan(folder);
        }
      } else {
        setNeedsSetup(true);
      }
    })();
  }, []);

  useEffect(() => {
    const off = window.api.onScanProgress((p) => setScanProgress(p));
    return off;
  }, []);

  const runScan = useCallback(async (folder: string) => {
    setIsScanning(true);
    setScanProgress({ scanned: 0, total: 0, current: 'starting...' });
    try {
      await window.api.scanLibrary(folder);
      const a = await window.api.getAlbums();
      setAlbums(a);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, []);

  const handleSetup = useCallback(async () => {
    const folder = 'E:\\Music';
    await window.api.setSetting('musicFolder', folder);
    setMusicFolder(folder);
    setNeedsSetup(false);
    await runScan(folder);
  }, [runScan]);

  const handleRescan = useCallback(() => {
    if (musicFolder) runScan(musicFolder);
  }, [musicFolder, runScan]);

  const navigate = useCallback((kind: 'albums' | 'songs' | 'artists' | 'settings') => {
    setView({ kind } as View);
  }, []);

  return (
    <div className="app">
      <div className="titlebar">
        <img src={logoUrl} alt="Phant" className="titlebar-logo" />
      </div>

      <div className="body">
        <Sidebar
          activeView={view.kind}
          onNavigate={navigate}
          onRescan={handleRescan}
          isScanning={isScanning}
        />

        <div className="content">
          {needsSetup ? (
            <SetupScreen onSetup={handleSetup} />
          ) : isScanning && scanProgress ? (
            <ScanScreen progress={scanProgress} />
          ) : view.kind === 'albums' ? (
            <AlbumsView
              albums={albums}
              onOpen={(a) => setView({ kind: 'album-detail', album: a })}
              onPlayAlbum={async (a) => {
                const tracks = await window.api.getTracksByAlbum(a.artist, a.name);
                player.playQueue(tracks, 0);
              }}
            />
          ) : view.kind === 'songs' ? (
            <SongsView
              currentTrackPath={player.state.currentTrack?.filePath ?? null}
              onPlayTracks={(tracks, idx) => player.playQueue(tracks, idx)}
            />
          ) : view.kind === 'artists' ? (
            <ArtistsView
              onOpen={(a) => setView({ kind: 'artist-detail', artist: a })}
            />
          ) : view.kind === 'settings' ? (
            <SettingsView />
          ) : view.kind === 'album-detail' ? (
            <AlbumDetailView
              album={view.album}
              onBack={() => setView({ kind: 'albums' })}
              onPlayTrack={(tracks, idx) => player.playQueue(tracks, idx)}
              currentTrackPath={player.state.currentTrack?.filePath ?? null}
            />
          ) : view.kind === 'artist-detail' ? (
            <ArtistDetailView
              artist={view.artist}
              onBack={() => setView({ kind: 'artists' })}
              onOpenAlbum={(a) => setView({ kind: 'album-detail', album: a })}
              onPlayAlbum={async (a) => {
                const tracks = await window.api.getTracksByAlbum(a.artist, a.name);
                player.playQueue(tracks, 0);
              }}
            />
          ) : null}
        </div>
      </div>

      <PlayerBar player={player} />
    </div>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({
  activeView,
  onNavigate,
  onRescan,
  isScanning,
}: {
  activeView: ViewKind;
  onNavigate: (v: 'albums' | 'songs' | 'artists' | 'settings') => void;
  onRescan: () => void;
  isScanning: boolean;
}) {
  const navItem = (kind: 'albums' | 'songs' | 'artists', icon: React.ReactNode, label: string) => (
    <div
      className={`nav-item ${activeView === kind ? 'active' : ''}`}
      onClick={() => onNavigate(kind)}
    >
      <span className="nav-item-icon">{icon}</span>
      {label}
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-section">Library</div>
      {navItem('albums', <AlbumsIcon />, 'Albums')}
      {navItem('songs', <SongsIcon />, 'Songs')}
      {navItem('artists', <ArtistsIcon />, 'Artists')}

      <div style={{ flex: 1 }} />

      <div className="sidebar-section">Library tools</div>
      <div
        className="nav-item"
        onClick={onRescan}
        style={{ opacity: isScanning ? 0.5 : 1, pointerEvents: isScanning ? 'none' : 'auto' }}
      >
        <span className="nav-item-icon"><RescanIcon /></span>
        {isScanning ? 'Scanning...' : 'Rescan library'}
      </div>
      <div
        className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <span className="nav-item-icon"><SettingsIcon /></span>
        Settings
      </div>
    </aside>
  );
}

/* ---------- Setup screen ---------- */

function SetupScreen({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">Welcome to Phant</div>
      <div className="empty-state-text">
        Your library will be loaded from <code>E:\Music</code>. Click below to scan it for the first time.
      </div>
      <button className="btn" onClick={onSetup}>Scan library</button>
    </div>
  );
}

/* ---------- Scan progress screen ---------- */

function ScanScreen({ progress }: { progress: ScanProgress }) {
  const pct = progress.total > 0 ? (progress.scanned / progress.total) * 100 : 0;
  return (
    <div className="scan-progress">
      <div className="scan-progress-title">Scanning library</div>
      <div className="scan-progress-text">
        {progress.scanned} / {progress.total} — {progress.current}
      </div>
      <div className="scan-progress-bar">
        <div className="scan-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Sort dropdown ---------- */

function SortDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="dropdown" onBlur={() => setTimeout(() => setOpen(false), 100)} tabIndex={0}>
      <button className="dropdown-trigger" onClick={() => setOpen(!open)}>
        <span className="dropdown-label">Sort: {current?.label}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="dropdown-menu">
          {options.map((o) => (
            <div
              key={o.value}
              className={`dropdown-item ${o.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Albums grid ---------- */

function AlbumsView({
  albums,
  onOpen,
  onPlayAlbum,
}: {
  albums: Album[];
  onOpen: (a: Album) => void;
  onPlayAlbum: (a: Album) => void;
}) {
  const [sort, setSort] = useState<AlbumSort>('artist');

  const sorted = useMemo(() => {
    const copy = [...albums];
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    switch (sort) {
      case 'artist':
        copy.sort((a, b) => cmp(a.artist, b.artist) || (a.year || 0) - (b.year || 0) || cmp(a.name, b.name));
        break;
      case 'name':
        copy.sort((a, b) => cmp(a.name, b.name));
        break;
      case 'year':
        copy.sort((a, b) => (b.year || 0) - (a.year || 0) || cmp(a.artist, b.artist));
        break;
      case 'tracks':
        copy.sort((a, b) => b.trackCount - a.trackCount);
        break;
    }
    return copy;
  }, [albums, sort]);

  if (albums.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No albums yet</div>
        <div className="empty-state-text">Use "Rescan library" to load your music folder.</div>
      </div>
    );
  }

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Albums</div>
          <div className="content-subtitle">{albums.length} albums</div>
        </div>
        <SortDropdown
          value={sort}
          onChange={(v) => setSort(v as AlbumSort)}
          options={Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="album-grid">
        {sorted.map((a) => (
          <div
            key={`${a.artist}:::${a.name}`}
            className="album-card"
            onClick={() => onOpen(a)}
          >
            <div className="album-cover-wrapper">
              <AlbumCover trackPath={a.firstTrackPath} alt={a.name} className="album-cover" />
              <div
                className="album-play-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayAlbum(a);
                }}
                title="Play album"
              >
                <PlayIcon size={14} />
              </div>
            </div>
            <div className="album-name">{a.name}</div>
            <div className="album-artist">{a.artist}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Songs view ---------- */

type SongSort = 'title' | 'artist' | 'album' | 'duration';
const SONG_SORT_LABELS: Record<SongSort, string> = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  duration: 'Duration',
};

function SongsView({
  currentTrackPath,
  onPlayTracks,
}: {
  currentTrackPath: string | null;
  onPlayTracks: (tracks: Track[], idx: number) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sort, setSort] = useState<SongSort>('title');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.api.getAllTracks().then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, []);

  const sorted = useMemo(() => {
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const copy = [...tracks];
    switch (sort) {
      case 'title': copy.sort((a, b) => cmp(a.title, b.title)); break;
      case 'artist': copy.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.album, b.album) || a.trackNumber - b.trackNumber); break;
      case 'album': copy.sort((a, b) => cmp(a.album, b.album) || a.diskNumber - b.diskNumber || a.trackNumber - b.trackNumber); break;
      case 'duration': copy.sort((a, b) => b.duration - a.duration); break;
    }
    return copy;
  }, [tracks, sort]);

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Songs</div>
          <div className="content-subtitle">
            {loading ? 'Loading...' : `${tracks.length} songs`}
          </div>
        </div>
        <SortDropdown
          value={sort}
          onChange={(v) => setSort(v as SongSort)}
          options={Object.entries(SONG_SORT_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="track-list track-list-wide">
        <div className="track-list-header track-row-wide">
          <div></div>
          <div>Title</div>
          <div>Artist</div>
          <div>Album</div>
          <div style={{ textAlign: 'right' }}>Time</div>
        </div>
        {sorted.map((t, i) => {
          const playing = currentTrackPath === t.filePath;
          return (
            <div
              key={t.id}
              className={`track-row track-row-wide ${playing ? 'playing' : ''}`}
              onDoubleClick={() => onPlayTracks(sorted, i)}
            >
              <div className="track-row-cover">
                <AlbumCover trackPath={t.filePath} alt={t.album} className="track-row-cover-img" />
              </div>
              <div className="track-title">{t.title}</div>
              <div className="track-secondary">{t.artist}</div>
              <div className="track-secondary">{t.album}</div>
              <div className="track-time">{formatTime(t.duration)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Artists view ---------- */

function ArtistsView({ onOpen }: { onOpen: (a: Artist) => void }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.api.getArtists().then((a) => {
      setArtists(a);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Artists</div>
          <div className="content-subtitle">
            {loading ? 'Loading...' : `${artists.length} artists`}
          </div>
        </div>
      </div>

      <div className="artist-grid">
        {artists.map((a) => (
          <div
            key={a.name}
            className="artist-card"
            onClick={() => onOpen(a)}
          >
            <AlbumCover trackPath={a.representativeTrackPath} alt={a.name} className="artist-cover" />
            <div className="artist-name">{a.name}</div>
            <div className="artist-meta">{a.albumCount} {a.albumCount === 1 ? 'album' : 'albums'} • {a.trackCount} tracks</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Artist detail ---------- */

function ArtistDetailView({
  artist,
  onBack,
  onOpenAlbum,
  onPlayAlbum,
}: {
  artist: Artist;
  onBack: () => void;
  onOpenAlbum: (a: Album) => void;
  onPlayAlbum: (a: Album) => void;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    window.api.getAlbumsByArtist(artist.name).then(setAlbums);
  }, [artist]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <button className="btn-back" onClick={onBack}>
          <ChevronLeftIcon size={14} /> <span>Back</span>
        </button>
      </div>

      <div className="content-header">
        <div>
          <div className="content-title">{artist.name}</div>
          <div className="content-subtitle">
            {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} • {artist.trackCount} tracks
          </div>
        </div>
      </div>

      <div className="album-grid">
        {albums.map((a) => (
          <div
            key={`${a.artist}:::${a.name}`}
            className="album-card"
            onClick={() => onOpenAlbum(a)}
          >
            <div className="album-cover-wrapper">
              <AlbumCover trackPath={a.firstTrackPath} alt={a.name} className="album-cover" />
              <div
                className="album-play-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayAlbum(a);
                }}
                title="Play album"
              >
                <PlayIcon size={14} />
              </div>
            </div>
            <div className="album-name">{a.name}</div>
            <div className="album-artist">{a.year || ''}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Settings ---------- */

function SettingsView() {
  const [status, setStatus] = useState<LastfmStatus | null>(null);
  const [authStep, setAuthStep] = useState<'idle' | 'awaiting-browser' | 'completing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userDataPath, setUserDataPath] = useState<string>('');

  const refresh = useCallback(async () => {
    setStatus(await window.api.lastfmStatus());
  }, []);

  useEffect(() => {
    refresh();
    window.api.getUserDataPath().then(setUserDataPath);
  }, [refresh]);

  const handleStartAuth = useCallback(async () => {
    setError(null);
    try {
      await window.api.lastfmStartAuth();
      setAuthStep('awaiting-browser');
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }, []);

  const handleCompleteAuth = useCallback(async () => {
    setError(null);
    setAuthStep('completing');
    try {
      await window.api.lastfmCompleteAuth();
      await refresh();
      setAuthStep('idle');
    } catch (e: any) {
      setError(e.message || String(e));
      setAuthStep('awaiting-browser');
    }
  }, [refresh]);

  const handleDisconnect = useCallback(async () => {
    await window.api.lastfmDisconnect();
    setAuthStep('idle');
    await refresh();
  }, [refresh]);

  return (
    <>
      <div className="content-header">
        <div className="content-title">Settings</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Last.fm scrobbling</div>

        {!status?.configured ? (
          <div className="settings-info">
            <p>Last.fm credentials aren't configured. Create a <code>config.json</code> file at:</p>
            <pre className="settings-code">{userDataPath ? `${userDataPath}\\config.json` : 'config.json'}</pre>
            <p>With these contents:</p>
            <pre className="settings-code">{`{
  "lastfm": {
    "apiKey": "your_api_key",
    "apiSecret": "your_shared_secret"
  }
}`}</pre>
            <p>Then restart the app.</p>
          </div>
        ) : status.authenticated ? (
          <div className="settings-info">
            <p>Connected as <strong>{status.username}</strong>.</p>
            <button className="btn btn-secondary" onClick={handleDisconnect}>Disconnect</button>
          </div>
        ) : authStep === 'awaiting-browser' ? (
          <div className="settings-info">
            <p>Authorise the app in the browser tab that just opened.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
              Once you've clicked "Yes, allow access" on Last.fm, come back and click below.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={handleCompleteAuth}>I've authorised — complete connection</button>
              <button className="btn btn-secondary" onClick={() => setAuthStep('idle')}>Cancel</button>
            </div>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>
        ) : authStep === 'completing' ? (
          <div className="settings-info"><p>Completing authentication…</p></div>
        ) : (
          <div className="settings-info">
            <p>Credentials are configured but you haven't connected yet.</p>
            <button className="btn" onClick={handleStartAuth}>Connect to Last.fm</button>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Album detail ---------- */

function AlbumDetailView({
  album,
  onBack,
  onPlayTrack,
  currentTrackPath,
}: {
  album: Album;
  onBack: () => void;
  onPlayTrack: (tracks: Track[], idx: number) => void;
  currentTrackPath: string | null;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    window.api.getTracksByAlbum(album.artist, album.name).then(setTracks);
  }, [album]);

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <button className="btn-back" onClick={onBack}>
          <ChevronLeftIcon size={14} /> <span>Back</span>
        </button>
      </div>

      <div className="album-detail-header">
        <AlbumCover
          trackPath={album.firstTrackPath}
          alt={album.name}
          className="album-detail-cover"
        />
        <div className="album-detail-info">
          <div className="album-detail-eyebrow">Album</div>
          <div className="album-detail-title">{album.name}</div>
          <div className="album-detail-artist">{album.artist}</div>
          <div className="album-detail-meta">
            {album.year ? `${album.year} • ` : ''}
            {tracks.length} tracks • {formatTime(totalDuration)}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-with-icon" onClick={() => onPlayTrack(tracks, 0)} disabled={tracks.length === 0}>
              <PlayIcon size={12} /> <span>Play</span>
            </button>
          </div>
        </div>
      </div>

      <div className="track-list">
        <div className="track-list-header">
          <div style={{ textAlign: 'right' }}>#</div>
          <div>Title</div>
          <div style={{ textAlign: 'right' }}>Time</div>
        </div>
        {tracks.map((t, i) => {
          const playing = currentTrackPath === t.filePath;
          return (
            <div
              key={t.id}
              className={`track-row ${playing ? 'playing' : ''}`}
              onDoubleClick={() => onPlayTrack(tracks, i)}
            >
              <div className="track-num">{playing ? <PlayIcon size={11} /> : t.trackNumber || i + 1}</div>
              <div>
                <div className="track-title">{t.title}</div>
                {t.artist !== album.artist && (
                  <div className="track-artist-sub">{t.artist}</div>
                )}
              </div>
              <div className="track-time">{formatTime(t.duration)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Player bar ---------- */

function PlayerBar({ player }: { player: ReturnType<typeof usePlayer> }) {
  const { state, togglePlay, next, prev, seek, setVolume } = player;
  const t = state.currentTrack;
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const onSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * state.duration);
  };

  const onVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setVolume(ratio);
  };

  return (
    <div className="player">
      <div className="player-track">
        {t ? (
          <>
            <AlbumCover trackPath={t.filePath} alt={t.album} className="player-cover" />
            <div className="player-info">
              <div className="player-info-title">{t.title}</div>
              <div className="player-info-artist">{t.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-info-artist">No track playing</div>
        )}
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button className="player-button" onClick={prev} disabled={!t} aria-label="Previous">
            <PrevIcon />
          </button>
          <button className="player-button play" onClick={togglePlay} disabled={!t} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
            {state.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="player-button" onClick={next} disabled={!t} aria-label="Next">
            <NextIcon />
          </button>
        </div>
        <div className="player-progress">
          <div className="player-time">{formatTime(state.currentTime)}</div>
          <div className="progress-bar" onClick={onSeekClick}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="player-time right">{formatTime(state.duration)}</div>
        </div>
      </div>

      <div className="player-extras">
        <div className="volume">
          <VolumeIcon />
          <div className="volume-bar" onClick={onVolumeClick}>
            <div className="volume-fill" style={{ width: `${state.volume * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
