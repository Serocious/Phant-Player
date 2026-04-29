import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Album, Track, Artist, Playlist, ScanProgress, LastfmStatus } from '../shared/types';
import { usePlayer, formatTime } from './hooks/usePlayer';
import { useMediaSession } from './hooks/useMediaSession';
import { useFavourites } from './hooks/useFavourites';
import { usePlaylists } from './hooks/usePlaylists';
import { useDragSeek } from './hooks/useDragSeek';
import { useDiscordPresence } from './hooks/useDiscordPresence';
import { useUpdater } from './hooks/useUpdater';
import { useReorderDrag } from './hooks/useReorderDrag';
import { AlbumCover } from './components/AlbumCover';
import { SearchBox } from './components/SearchBox';
import { ContextMenu, type ContextMenuEntry } from './components/ContextMenu';
import { UpNextPopup } from './components/UpNextPopup';
import { FavouriteButton } from './components/FavouriteButton';
import { TrackDetailsPopup } from './components/TrackDetailsPopup';
import { TextInputModal } from './components/TextInputModal';
import { ConfirmModal } from './components/ConfirmModal';
import { UpdateToast } from './components/UpdateToast';
import {
  PlayIcon, PauseIcon, PrevIcon, NextIcon, VolumeIcon,
  AlbumsIcon, SongsIcon, ArtistsIcon,
  RescanIcon, SettingsIcon, ChevronLeftIcon, ChevronDownIcon,
  ShuffleIcon, RepeatIcon, RepeatOneIcon, QueueIcon,
  HeartIcon, InfoIcon, PlusIcon, CloseIcon,
} from './components/Icons';
import logoUrl from './assets/logo.png';

type ViewKind = 'albums' | 'songs' | 'artists' | 'favourites' | 'settings' | 'album-detail' | 'artist-detail' | 'playlist-detail';

type View =
  | { kind: 'albums' }
  | { kind: 'songs' }
  | { kind: 'artists' }
  | { kind: 'favourites' }
  | { kind: 'settings' }
  | { kind: 'album-detail'; album: Album }
  | { kind: 'artist-detail'; artist: Artist }
  | { kind: 'playlist-detail'; playlist: Playlist };

type AlbumSort = 'artist' | 'name' | 'year' | 'tracks';

const ALBUM_SORT_LABELS: Record<AlbumSort, string> = {
  artist: 'Artist',
  name: 'Album name',
  year: 'Year',
  tracks: 'Track count',
};

export default function App() {
  const player = usePlayer();
  const favourites = useFavourites();
  const playlists = usePlaylists();
  const [musicFolder, setMusicFolder] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [view, setView] = useState<View>({ kind: 'albums' });
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuEntry[] } | null>(null);
  const [detailsTrack, setDetailsTrack] = useState<Track | null>(null);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  /** When set, user is creating a playlist AND we should add this track to it */
  const [pendingTrackForNewPlaylist, setPendingTrackForNewPlaylist] = useState<Track | null>(null);
  const [renamePlaylist, setRenamePlaylist] = useState<Playlist | null>(null);
  const [deletePlaylist, setDeletePlaylist] = useState<Playlist | null>(null);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const updater = useUpdater();
  const [updateToastDismissed, setUpdateToastDismissed] = useState(false);

  // When a new actionable update state arrives, un-dismiss the toast so it
  // appears again. Otherwise once the user dismisses, they won't see it
  // until app restart.
  useEffect(() => {
    setUpdateToastDismissed(false);
  }, [updater.status.state, (updater.status as any).version]);

  // Load Discord settings on startup, then wire to the rich presence module.
  useEffect(() => {
    (async () => {
      const id = await window.api.getSetting<string>('discordClientId');
      const enabled = await window.api.getSetting<boolean>('discordRpcEnabled');
      const idStr = id || '';
      const en = !!enabled && !!idStr;
      setDiscordClientId(idStr);
      setDiscordEnabled(en);
      window.api.discordRpcConfigure(idStr || null, en).catch(() => {});
    })();
  }, []);

  // Reconfigure the main-process module whenever the user changes settings
  useEffect(() => {
    window.api.discordRpcConfigure(
      discordClientId || null,
      discordEnabled && !!discordClientId,
    ).catch(() => {});
  }, [discordClientId, discordEnabled]);

  // Push activity updates
  useDiscordPresence(player.state, discordEnabled && !!discordClientId);

  useMediaSession(player.state, {
    togglePlay: player.togglePlay,
    next: player.next,
    prev: player.prev,
    seek: player.seek,
  });

  const handleTrackContextMenu = useCallback(
    (e: React.MouseEvent, track: Track) => {
      e.preventDefault();
      const isFav = favourites.isFavourite(track.filePath);

      // Build the "Add to playlist" submenu
      const playlistSubmenu: ContextMenuEntry[] = [
        {
          label: '+ New playlist…',
          onClick: () => {
            setPendingTrackForNewPlaylist(track);
            setCreatePlaylistOpen(true);
          },
        },
      ];
      if (playlists.playlists.length > 0) {
        playlistSubmenu.push({ divider: true });
        for (const pl of playlists.playlists) {
          playlistSubmenu.push({
            label: pl.name,
            onClick: () => playlists.addTrack(pl.id, track.filePath),
          });
        }
      }

      const items: ContextMenuEntry[] = [
        {
          label: 'Play next',
          onClick: () => player.addToQueueNext(track),
        },
        {
          label: 'Add to queue',
          onClick: () => player.addToQueueEnd(track),
        },
        { divider: true },
        {
          label: isFav ? 'Remove from favourites' : 'Add to favourites',
          onClick: () => favourites.toggle(track.filePath),
        },
        {
          label: 'Add to playlist',
          submenu: playlistSubmenu,
        },
        { divider: true },
        {
          label: 'Track details',
          onClick: () => setDetailsTrack(track),
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [player, favourites, playlists]
  );

  const openTrackDetails = useCallback((track: Track) => {
    setDetailsTrack(track);
  }, []);

  /** Right-click menu for a playlist in the sidebar */
  const handlePlaylistContextMenu = useCallback(
    (e: React.MouseEvent, pl: Playlist) => {
      e.preventDefault();
      const items: ContextMenuEntry[] = [
        {
          label: 'Rename',
          onClick: () => setRenamePlaylist(pl),
        },
        { divider: true },
        {
          label: 'Delete',
          danger: true,
          onClick: () => setDeletePlaylist(pl),
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    []
  );

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
        // Restore queue from previous session (silently — paused, ready to resume)
        await player.restoreQueue();
      } else {
        setNeedsSetup(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSetup = useCallback(async (folder: string) => {
    await window.api.setSetting('musicFolder', folder);
    setMusicFolder(folder);
    setNeedsSetup(false);
    await runScan(folder);
  }, [runScan]);

  const handleChangeFolder = useCallback(async (newFolder: string) => {
    await window.api.setSetting('musicFolder', newFolder);
    setMusicFolder(newFolder);
    await runScan(newFolder);
  }, [runScan]);

  const handleRescan = useCallback(() => {
    if (musicFolder) runScan(musicFolder);
  }, [musicFolder, runScan]);

  const navigate = useCallback((kind: 'albums' | 'songs' | 'artists' | 'favourites' | 'settings') => {
    setView({ kind } as View);
  }, []);

  return (
    <div className="app">
      <div className="titlebar">
        <img src={logoUrl} alt="Phant" className="titlebar-logo" />
      </div>

      <div className="body">
        <Sidebar
          activeView={view}
          onNavigate={navigate}
          onRescan={handleRescan}
          isScanning={isScanning}
          playlists={playlists.playlists}
          onCreatePlaylist={() => {
            setPendingTrackForNewPlaylist(null);
            setCreatePlaylistOpen(true);
          }}
          onOpenPlaylist={(pl) => setView({ kind: 'playlist-detail', playlist: pl })}
          onPlaylistContextMenu={handlePlaylistContextMenu}
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
              onTrackContextMenu={handleTrackContextMenu}
              favourites={favourites}
              onOpenDetails={openTrackDetails}
            />
          ) : view.kind === 'artists' ? (
            <ArtistsView
              onOpen={(a) => setView({ kind: 'artist-detail', artist: a })}
            />
          ) : view.kind === 'favourites' ? (
            <FavouritesView
              currentTrackPath={player.state.currentTrack?.filePath ?? null}
              onPlayTracks={(tracks, idx) => player.playQueue(tracks, idx)}
              onTrackContextMenu={handleTrackContextMenu}
              favourites={favourites}
              onOpenDetails={openTrackDetails}
            />
          ) : view.kind === 'settings' ? (
            <SettingsView
              musicFolder={musicFolder}
              onChangeFolder={handleChangeFolder}
              discordClientId={discordClientId}
              discordEnabled={discordEnabled}
              onChangeDiscordClientId={async (id) => {
                setDiscordClientId(id);
                await window.api.setSetting('discordClientId', id);
              }}
              onChangeDiscordEnabled={async (en) => {
                setDiscordEnabled(en);
                await window.api.setSetting('discordRpcEnabled', en);
              }}
              updater={updater}
            />
          ) : view.kind === 'album-detail' ? (
            <AlbumDetailView
              album={view.album}
              onBack={() => setView({ kind: 'albums' })}
              onPlayTrack={(tracks, idx) => player.playQueue(tracks, idx)}
              currentTrackPath={player.state.currentTrack?.filePath ?? null}
              onTrackContextMenu={handleTrackContextMenu}
              favourites={favourites}
              onOpenDetails={openTrackDetails}
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
          ) : view.kind === 'playlist-detail' ? (
            <PlaylistDetailView
              playlist={view.playlist}
              currentTrackPath={player.state.currentTrack?.filePath ?? null}
              onPlayTracks={(tracks, idx) => player.playQueue(tracks, idx)}
              onTrackContextMenu={handleTrackContextMenu}
              favourites={favourites}
              playlists={playlists}
              onOpenDetails={openTrackDetails}
            />
          ) : null}
        </div>
      </div>

      <PlayerBar player={player} favourites={favourites} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {detailsTrack && (
        <TrackDetailsPopup
          track={detailsTrack}
          onClose={() => setDetailsTrack(null)}
        />
      )}

      {createPlaylistOpen && (
        <TextInputModal
          title="New playlist"
          placeholder="Playlist name"
          confirmLabel="Create"
          onCancel={() => {
            setCreatePlaylistOpen(false);
            setPendingTrackForNewPlaylist(null);
          }}
          onConfirm={async (name) => {
            const created = await playlists.create(name);
            // If we were creating this playlist to add a track to it, do that now
            if (pendingTrackForNewPlaylist) {
              await playlists.addTrack(created.id, pendingTrackForNewPlaylist.filePath);
              setPendingTrackForNewPlaylist(null);
            }
            setCreatePlaylistOpen(false);
          }}
        />
      )}

      {renamePlaylist && (
        <TextInputModal
          title="Rename playlist"
          initialValue={renamePlaylist.name}
          confirmLabel="Rename"
          onCancel={() => setRenamePlaylist(null)}
          onConfirm={async (newName) => {
            await playlists.rename(renamePlaylist.id, newName);
            // Update the active view if we just renamed the playlist we're viewing
            if (view.kind === 'playlist-detail' && view.playlist.id === renamePlaylist.id) {
              setView({ kind: 'playlist-detail', playlist: { ...view.playlist, name: newName } });
            }
            setRenamePlaylist(null);
          }}
        />
      )}

      {deletePlaylist && (
        <ConfirmModal
          title="Delete playlist"
          message={`Delete "${deletePlaylist.name}"? This cannot be undone. The tracks themselves stay in your library.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeletePlaylist(null)}
          onConfirm={async () => {
            await playlists.remove(deletePlaylist.id);
            // If we were viewing this playlist, navigate away
            if (view.kind === 'playlist-detail' && view.playlist.id === deletePlaylist.id) {
              setView({ kind: 'albums' });
            }
            setDeletePlaylist(null);
          }}
        />
      )}

      {!updateToastDismissed && (
        <UpdateToast
          status={updater.status}
          onInstall={updater.installNow}
          onDismiss={() => setUpdateToastDismissed(true)}
        />
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({
  activeView,
  onNavigate,
  onRescan,
  isScanning,
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
  onPlaylistContextMenu,
}: {
  activeView: View;
  onNavigate: (v: 'albums' | 'songs' | 'artists' | 'favourites' | 'settings') => void;
  onRescan: () => void;
  isScanning: boolean;
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (pl: Playlist) => void;
  onPlaylistContextMenu: (e: React.MouseEvent, pl: Playlist) => void;
}) {
  const navItem = (kind: 'albums' | 'songs' | 'artists' | 'favourites', icon: React.ReactNode, label: string) => (
    <div
      className={`nav-item ${activeView.kind === kind ? 'active' : ''}`}
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
      {navItem('favourites', <HeartIcon size={16} />, 'Favourites')}

      <div className="sidebar-section sidebar-section-with-action">
        <span>Playlists</span>
        <button
          className="sidebar-action-btn"
          onClick={onCreatePlaylist}
          title="New playlist"
          aria-label="New playlist"
        >
          <PlusIcon size={12} />
        </button>
      </div>
      <div className="sidebar-playlists">
        {playlists.length === 0 ? (
          <div className="sidebar-empty">No playlists yet</div>
        ) : (
          playlists.map((pl) => {
            const isActive = activeView.kind === 'playlist-detail' && activeView.playlist.id === pl.id;
            return (
              <div
                key={pl.id}
                className={`nav-item nav-item-playlist ${isActive ? 'active' : ''}`}
                onClick={() => onOpenPlaylist(pl)}
                onContextMenu={(e) => onPlaylistContextMenu(e, pl)}
                title={pl.name}
              >
                <span className="nav-item-playlist-name">{pl.name}</span>
                <span className="nav-item-playlist-count">{pl.trackCount}</span>
              </div>
            );
          })
        )}
      </div>

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
        className={`nav-item ${activeView.kind === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <span className="nav-item-icon"><SettingsIcon /></span>
        Settings
      </div>
    </aside>
  );
}

/* ---------- Setup screen ---------- */

function SetupScreen({ onSetup }: { onSetup: (folder: string) => void }) {
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    setPicking(true);
    try {
      const folder = await window.api.pickFolder();
      if (folder) onSetup(folder);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="empty-state">
      <div className="empty-state-title">Welcome to Phant</div>
      <div className="empty-state-text">
        Choose your music folder to get started. Phant will scan it for MP3, FLAC, and other audio files.
      </div>
      <button className="btn" onClick={handlePick} disabled={picking}>
        {picking ? 'Choosing…' : 'Choose music folder'}
      </button>
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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return albums;
    const q = query.toLowerCase();
    return albums.filter((a) =>
      a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
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
  }, [filtered, sort]);

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
          <div className="content-subtitle">
            {query ? `${sorted.length} of ${albums.length}` : `${albums.length} albums`}
          </div>
        </div>
        <div className="content-header-controls">
          <SearchBox value={query} onChange={setQuery} placeholder="Search albums…" />
          <SortDropdown
            value={sort}
            onChange={(v) => setSort(v as AlbumSort)}
            options={Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state-inline">No matches for "{query}"</div>
      ) : (
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
      )}
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
  onTrackContextMenu,
  favourites,
  onOpenDetails,
}: {
  currentTrackPath: string | null;
  onPlayTracks: (tracks: Track[], idx: number) => void;
  onTrackContextMenu: (e: React.MouseEvent, track: Track) => void;
  favourites: ReturnType<typeof useFavourites>;
  onOpenDetails: (track: Track) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sort, setSort] = useState<SongSort>('title');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    window.api.getAllTracks().then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return tracks;
    const q = query.toLowerCase();
    return tracks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  }, [tracks, query]);

  const sorted = useMemo(() => {
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const copy = [...filtered];
    switch (sort) {
      case 'title': copy.sort((a, b) => cmp(a.title, b.title)); break;
      case 'artist': copy.sort((a, b) => cmp(a.artist, b.artist) || cmp(a.album, b.album) || a.trackNumber - b.trackNumber); break;
      case 'album': copy.sort((a, b) => cmp(a.album, b.album) || a.diskNumber - b.diskNumber || a.trackNumber - b.trackNumber); break;
      case 'duration': copy.sort((a, b) => b.duration - a.duration); break;
    }
    return copy;
  }, [filtered, sort]);

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Songs</div>
          <div className="content-subtitle">
            {loading ? 'Loading...' : query ? `${sorted.length} of ${tracks.length}` : `${tracks.length} songs`}
          </div>
        </div>
        <div className="content-header-controls">
          <SearchBox value={query} onChange={setQuery} placeholder="Search songs…" />
          <SortDropdown
            value={sort}
            onChange={(v) => setSort(v as SongSort)}
            options={Object.entries(SONG_SORT_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      {sorted.length === 0 && !loading ? (
        <div className="empty-state-inline">{query ? `No matches for "${query}"` : 'No songs found.'}</div>
      ) : (
        <div className="track-list track-list-wide">
          <div className="track-list-header track-row-wide">
            <div></div>
            <div>Title</div>
            <div>Artist</div>
            <div>Album</div>
            <div></div>
            <div></div>
            <div style={{ textAlign: 'right' }}>Time</div>
          </div>
          {sorted.map((t, i) => {
            const playing = currentTrackPath === t.filePath;
            const isFav = favourites.isFavourite(t.filePath);
            return (
              <div
                key={t.id}
                className={`track-row track-row-wide ${playing ? 'playing' : ''}`}
                onDoubleClick={() => onPlayTracks(sorted, i)}
                onContextMenu={(e) => onTrackContextMenu(e, t)}
              >
                <div className="track-row-cover">
                  <AlbumCover trackPath={t.filePath} alt={t.album} className="track-row-cover-img" />
                  <button
                    className="track-row-play-overlay"
                    onClick={(e) => { e.stopPropagation(); onPlayTracks(sorted, i); }}
                    title="Play"
                    aria-label="Play"
                  >
                    <PlayIcon size={12} />
                  </button>
                </div>
                <div className="track-title">{t.title}</div>
                <div className="track-secondary">{t.artist}</div>
                <div className="track-secondary">{t.album}</div>
                <div className="track-fav">
                  <FavouriteButton
                    isFavourite={isFav}
                    onToggle={() => favourites.toggle(t.filePath)}
                    showOnHover={!isFav}
                  />
                </div>
                <div className="track-info">
                  <button
                    className="info-btn show-on-hover"
                    onClick={(e) => { e.stopPropagation(); onOpenDetails(t); }}
                    title="Track details"
                    aria-label="Track details"
                  >
                    <InfoIcon />
                  </button>
                </div>
                <div className="track-time">{formatTime(t.duration)}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Artists view ---------- */

function ArtistsView({ onOpen }: { onOpen: (a: Artist) => void }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    window.api.getArtists().then((a) => {
      setArtists(a);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return artists;
    const q = query.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Artists</div>
          <div className="content-subtitle">
            {loading ? 'Loading...' : query ? `${filtered.length} of ${artists.length}` : `${artists.length} artists`}
          </div>
        </div>
        <div className="content-header-controls">
          <SearchBox value={query} onChange={setQuery} placeholder="Search artists…" />
        </div>
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="empty-state-inline">{query ? `No matches for "${query}"` : 'No artists found.'}</div>
      ) : (
        <div className="artist-grid">
          {filtered.map((a) => (
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
      )}
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

/* ---------- Playlist detail view ---------- */

function PlaylistDetailView({
  playlist,
  currentTrackPath,
  onPlayTracks,
  onTrackContextMenu,
  favourites,
  playlists,
  onOpenDetails,
}: {
  playlist: Playlist;
  currentTrackPath: string | null;
  onPlayTracks: (tracks: Track[], idx: number) => void;
  onTrackContextMenu: (e: React.MouseEvent, track: Track) => void;
  favourites: ReturnType<typeof useFavourites>;
  playlists: ReturnType<typeof usePlaylists>;
  onOpenDetails: (track: Track) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Reload tracks whenever the playlist or its track count changes
  const trackCount = playlist.trackCount;
  useEffect(() => {
    setLoading(true);
    window.api.playlistGetTracks(playlist.id).then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, [playlist.id, trackCount]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tracks;
    const q = query.toLowerCase();
    return tracks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  }, [tracks, query]);

  const totalDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    [tracks]
  );

  const formatTotalDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}${remMin > 0 ? ` ${remMin} min` : ''}`;
  };

  const reorderEnabled = !query.trim() && !loading && tracks.length > 1;

  // Drag-to-reorder. Commits via the playlistReorder IPC.
  const drag = useReorderDrag({
    rowCount: tracks.length,
    onCommit: async (from, to) => {
      const next = [...tracks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setTracks(next); // optimistic update
      try {
        await window.api.playlistReorder(playlist.id, next.map((t) => t.filePath));
      } catch (e) {
        console.error('Reorder failed:', e);
        setTracks(tracks); // revert
      }
    },
  });

  const draggedTrack = drag.dragIndex !== null ? tracks[drag.dragIndex] : null;

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-eyebrow">Playlist</div>
          <div className="content-title">{playlist.name}</div>
          <div className="content-subtitle">
            {loading
              ? 'Loading...'
              : tracks.length === 0
                ? 'Empty playlist'
                : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'} • ${formatTotalDuration(totalDuration)}`}
          </div>
        </div>
        {tracks.length > 0 && (
          <div className="content-header-controls">
            <SearchBox value={query} onChange={setQuery} placeholder="Search playlist…" />
            <button
              className="btn"
              onClick={() => onPlayTracks(filtered, 0)}
              disabled={filtered.length === 0}
            >
              <PlayIcon size={11} />
              <span style={{ marginLeft: 6 }}>Play</span>
            </button>
          </div>
        )}
      </div>

      {tracks.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-title">This playlist is empty</div>
          <div className="empty-state-text">
            Right-click any track and choose "Add to playlist" → "{playlist.name}" to add it here.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state-inline">No matches for "{query}"</div>
      ) : (
        <div className={`track-list track-list-wide ${drag.isDragging ? 'is-dragging' : ''}`}>
          <div className="track-list-header track-row-wide">
            <div></div>
            <div>Title</div>
            <div>Artist</div>
            <div>Album</div>
            <div></div>
            <div></div>
            <div style={{ textAlign: 'right' }}>Time</div>
          </div>
          {filtered.map((t, i) => {
            const playing = currentTrackPath === t.filePath;
            const isFav = favourites.isFavourite(t.filePath);
            const realIdx = i;
            const isDragging = drag.dragIndex === realIdx;
            const showDropAbove =
              drag.dropIndex === realIdx &&
              drag.dragIndex !== null &&
              drag.dropIndex !== drag.dragIndex &&
              drag.dropIndex !== drag.dragIndex + 1;
            const showDropBelow =
              drag.dropIndex === realIdx + 1 &&
              i === filtered.length - 1 &&
              drag.dragIndex !== null &&
              drag.dropIndex !== drag.dragIndex &&
              drag.dropIndex !== drag.dragIndex + 1;

            return (
              <React.Fragment key={t.id}>
                {showDropAbove && <div className="drop-indicator" />}
                <div
                  ref={(el) => drag.setRowRef(realIdx, el)}
                  className={`track-row track-row-wide ${playing ? 'playing' : ''} ${isDragging ? 'being-dragged' : ''} ${reorderEnabled ? 'reorderable' : ''}`}
                  onDoubleClick={() => onPlayTracks(filtered, i)}
                  onContextMenu={(e) => onTrackContextMenu(e, t)}
                  onMouseDown={(e) => {
                    if (reorderEnabled) drag.startTracking(e, realIdx);
                  }}
                >
                  <div className="track-row-cover">
                    <AlbumCover trackPath={t.filePath} alt={t.album} className="track-row-cover-img" />
                    <button
                      className="track-row-play-overlay"
                      onClick={(e) => { e.stopPropagation(); onPlayTracks(filtered, i); }}
                      title="Play"
                      aria-label="Play"
                    >
                      <PlayIcon size={12} />
                    </button>
                  </div>
                  <div className="track-title">{t.title}</div>
                  <div className="track-secondary">{t.artist}</div>
                  <div className="track-secondary">{t.album}</div>
                  <div className="track-fav">
                    <FavouriteButton
                      isFavourite={isFav}
                      onToggle={() => favourites.toggle(t.filePath)}
                      showOnHover={!isFav}
                    />
                  </div>
                  <div className="track-info">
                    <button
                      className="info-btn show-on-hover"
                      onClick={(e) => { e.stopPropagation(); onOpenDetails(t); }}
                      title="Track details"
                      aria-label="Track details"
                    >
                      <InfoIcon />
                    </button>
                    <button
                      className="info-btn show-on-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        playlists.removeTrack(playlist.id, t.filePath);
                      }}
                      title="Remove from playlist"
                      aria-label="Remove from playlist"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </div>
                  <div className="track-time">{formatTime(t.duration)}</div>
                </div>
                {showDropBelow && <div className="drop-indicator" />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Floating ghost row that follows the cursor during drag */}
      {draggedTrack && drag.ghostPos && (
        <div
          className="drag-ghost"
          style={{
            left: drag.ghostPos.x + 12,
            top: drag.ghostPos.y - 16,
          }}
        >
          <AlbumCover trackPath={draggedTrack.filePath} alt={draggedTrack.album} className="drag-ghost-cover" />
          <div className="drag-ghost-info">
            <div className="drag-ghost-title">{draggedTrack.title}</div>
            <div className="drag-ghost-artist">{draggedTrack.artist}</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Favourites view ---------- */

function FavouritesView({
  currentTrackPath,
  onPlayTracks,
  onTrackContextMenu,
  favourites,
  onOpenDetails,
}: {
  currentTrackPath: string | null;
  onPlayTracks: (tracks: Track[], idx: number) => void;
  onTrackContextMenu: (e: React.MouseEvent, track: Track) => void;
  favourites: ReturnType<typeof useFavourites>;
  onOpenDetails: (track: Track) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Reload when the favourites set changes (e.g. user toggled a favourite from
  // somewhere else in the app)
  const favCount = favourites.favourites.size;
  useEffect(() => {
    setLoading(true);
    window.api.favouritesGetTracks().then((t) => {
      setTracks(t);
      setLoading(false);
    });
  }, [favCount]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tracks;
    const q = query.toLowerCase();
    return tracks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  }, [tracks, query]);

  const reorderEnabled = !query.trim() && !loading && tracks.length > 1;

  // Drag-to-reorder. Commits via the favouritesReorder IPC.
  const drag = useReorderDrag({
    rowCount: tracks.length,
    onCommit: async (from, to) => {
      const next = [...tracks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setTracks(next); // optimistic update
      try {
        await window.api.favouritesReorder(next.map((t) => t.filePath));
      } catch (e) {
        console.error('Reorder failed:', e);
        setTracks(tracks); // revert
      }
    },
  });

  const draggedTrack = drag.dragIndex !== null ? tracks[drag.dragIndex] : null;

  return (
    <>
      <div className="content-header">
        <div>
          <div className="content-title">Favourites</div>
          <div className="content-subtitle">
            {loading
              ? 'Loading...'
              : query
                ? `${filtered.length} of ${tracks.length}`
                : `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`}
          </div>
        </div>
        {tracks.length > 0 && (
          <div className="content-header-controls">
            <SearchBox value={query} onChange={setQuery} placeholder="Search favourites…" />
          </div>
        )}
      </div>

      {tracks.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-title">No favourites yet</div>
          <div className="empty-state-text">
            Tap the heart on any track to save it here. You can also right-click a track and choose "Add to favourites".
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state-inline">No matches for "{query}"</div>
      ) : (
        <div className={`track-list track-list-wide ${drag.isDragging ? 'is-dragging' : ''}`}>
          <div className="track-list-header track-row-wide">
            <div></div>
            <div>Title</div>
            <div>Artist</div>
            <div>Album</div>
            <div></div>
            <div></div>
            <div style={{ textAlign: 'right' }}>Time</div>
          </div>
          {filtered.map((t, i) => {
            const playing = currentTrackPath === t.filePath;
            const isFav = favourites.isFavourite(t.filePath);
            const realIdx = i;
            const isDragging = drag.dragIndex === realIdx;
            const showDropAbove =
              drag.dropIndex === realIdx &&
              drag.dragIndex !== null &&
              drag.dropIndex !== drag.dragIndex &&
              drag.dropIndex !== drag.dragIndex + 1;
            const showDropBelow =
              drag.dropIndex === realIdx + 1 &&
              i === filtered.length - 1 &&
              drag.dragIndex !== null &&
              drag.dropIndex !== drag.dragIndex &&
              drag.dropIndex !== drag.dragIndex + 1;

            return (
              <React.Fragment key={t.id}>
                {showDropAbove && <div className="drop-indicator" />}
                <div
                  ref={(el) => drag.setRowRef(realIdx, el)}
                  className={`track-row track-row-wide ${playing ? 'playing' : ''} ${isDragging ? 'being-dragged' : ''} ${reorderEnabled ? 'reorderable' : ''}`}
                  onDoubleClick={() => onPlayTracks(filtered, i)}
                  onContextMenu={(e) => onTrackContextMenu(e, t)}
                  onMouseDown={(e) => {
                    if (reorderEnabled) drag.startTracking(e, realIdx);
                  }}
                >
                  <div className="track-row-cover">
                    <AlbumCover trackPath={t.filePath} alt={t.album} className="track-row-cover-img" />
                    <button
                      className="track-row-play-overlay"
                      onClick={(e) => { e.stopPropagation(); onPlayTracks(filtered, i); }}
                      title="Play"
                      aria-label="Play"
                    >
                      <PlayIcon size={12} />
                    </button>
                  </div>
                  <div className="track-title">{t.title}</div>
                  <div className="track-secondary">{t.artist}</div>
                  <div className="track-secondary">{t.album}</div>
                  <div className="track-fav">
                    <FavouriteButton
                      isFavourite={isFav}
                      onToggle={() => favourites.toggle(t.filePath)}
                    />
                  </div>
                  <div className="track-info">
                    <button
                      className="info-btn show-on-hover"
                      onClick={(e) => { e.stopPropagation(); onOpenDetails(t); }}
                      title="Track details"
                      aria-label="Track details"
                    >
                      <InfoIcon />
                    </button>
                  </div>
                  <div className="track-time">{formatTime(t.duration)}</div>
                </div>
                {showDropBelow && <div className="drop-indicator" />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Floating ghost row that follows the cursor during drag */}
      {draggedTrack && drag.ghostPos && (
        <div
          className="drag-ghost"
          style={{
            left: drag.ghostPos.x + 12,
            top: drag.ghostPos.y - 16,
          }}
        >
          <AlbumCover trackPath={draggedTrack.filePath} alt={draggedTrack.album} className="drag-ghost-cover" />
          <div className="drag-ghost-info">
            <div className="drag-ghost-title">{draggedTrack.title}</div>
            <div className="drag-ghost-artist">{draggedTrack.artist}</div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Settings ---------- */

function SettingsView({
  musicFolder,
  onChangeFolder,
  discordClientId,
  discordEnabled,
  onChangeDiscordClientId,
  onChangeDiscordEnabled,
  updater,
}: {
  musicFolder: string | null;
  onChangeFolder: (folder: string) => void;
  discordClientId: string;
  discordEnabled: boolean;
  onChangeDiscordClientId: (id: string) => void;
  onChangeDiscordEnabled: (enabled: boolean) => void;
  updater: ReturnType<typeof useUpdater>;
}) {
  const [status, setStatus] = useState<LastfmStatus | null>(null);
  const [authStep, setAuthStep] = useState<'idle' | 'awaiting-browser' | 'completing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [userDataPath, setUserDataPath] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');

  const refresh = useCallback(async () => {
    setStatus(await window.api.lastfmStatus());
  }, []);

  useEffect(() => {
    refresh();
    window.api.getUserDataPath().then(setUserDataPath);
    window.api.getAppVersion().then(setAppVersion);
  }, [refresh]);

  const handlePickFolder = useCallback(async () => {
    const folder = await window.api.pickFolder(musicFolder || undefined);
    if (folder && folder !== musicFolder) {
      onChangeFolder(folder);
    }
  }, [musicFolder, onChangeFolder]);

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
        <div className="settings-section-title">Music folder</div>
        <div className="settings-info">
          <p>Phant scans this folder for audio files. Changing it will re-scan your library.</p>
          <div className="folder-row">
            <code className="folder-path">{musicFolder || 'Not set'}</code>
            <button className="btn btn-secondary" onClick={handlePickFolder}>Change…</button>
          </div>
        </div>
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

      <div className="settings-section">
        <div className="settings-section-title">Discord Rich Presence</div>
        <div className="settings-info">
          <p>Show what you're listening to in your Discord status.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            You'll need to register a Discord application to get a Client ID. Visit{' '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.api.openExternal('https://discord.com/developers/applications'); }}
            >discord.com/developers/applications</a>, click "New Application", give it a name (e.g. "Phant"), then copy its Application ID. The app's name and icon are what'll appear in your Discord status.
          </p>

          <div className="setting-row">
            <label className="setting-label" htmlFor="discord-client-id">Discord Client ID</label>
            <input
              id="discord-client-id"
              type="text"
              className="text-input"
              placeholder="e.g. 1234567890123456789"
              value={discordClientId}
              onChange={(e) => onChangeDiscordClientId(e.target.value.trim())}
            />
          </div>

          <div className="setting-row">
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={discordEnabled}
                disabled={!discordClientId}
                onChange={(e) => onChangeDiscordEnabled(e.target.checked)}
              />
              <span>Enabled</span>
            </label>
            {!discordClientId && (
              <span className="setting-hint">Set a Client ID first</span>
            )}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
            Album art is looked up via the iTunes API. Tracks not on Apple Music will show the Phant logo instead.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Updates</div>
        <div className="settings-info">
          <div className="folder-row">
            <div>
              <div style={{ fontSize: 13 }}>
                You're on Phant <strong>{appVersion || '…'}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {updater.status.state === 'checking' && 'Checking for updates…'}
                {updater.status.state === 'available' && `Update ${updater.status.version} found, downloading…`}
                {updater.status.state === 'downloading' && `Downloading… ${Math.round(updater.status.percent)}%`}
                {updater.status.state === 'ready' && `Update ${updater.status.version} ready to install`}
                {updater.status.state === 'not-available' && 'You\'re on the latest version.'}
                {updater.status.state === 'error' && `Couldn't check for updates: ${updater.status.message}`}
                {updater.status.state === 'idle' && 'Phant checks for updates automatically every few hours.'}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={updater.checkForUpdates}
              disabled={updater.status.state === 'checking' || updater.status.state === 'downloading'}
            >
              Check now
            </button>
          </div>
          {updater.status.state === 'ready' && (
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={updater.installNow}
            >
              Restart and install
            </button>
          )}
        </div>
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
  onTrackContextMenu,
  favourites,
  onOpenDetails,
}: {
  album: Album;
  onBack: () => void;
  onPlayTrack: (tracks: Track[], idx: number) => void;
  currentTrackPath: string | null;
  onTrackContextMenu: (e: React.MouseEvent, track: Track) => void;
  favourites: ReturnType<typeof useFavourites>;
  onOpenDetails: (track: Track) => void;
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

      <div className="track-list track-list-album">
        <div className="track-list-header track-row-album">
          <div style={{ textAlign: 'right' }}>#</div>
          <div>Title</div>
          <div></div>
          <div></div>
          <div style={{ textAlign: 'right' }}>Time</div>
        </div>
        {tracks.map((t, i) => {
          const playing = currentTrackPath === t.filePath;
          const isFav = favourites.isFavourite(t.filePath);
          return (
            <div
              key={t.id}
              className={`track-row track-row-album ${playing ? 'playing' : ''}`}
              onDoubleClick={() => onPlayTrack(tracks, i)}
              onContextMenu={(e) => onTrackContextMenu(e, t)}
            >
              <div className="track-num">{playing ? <PlayIcon size={11} /> : t.trackNumber || i + 1}</div>
              <div>
                <div className="track-title">{t.title}</div>
                {t.artist !== album.artist && (
                  <div className="track-artist-sub">{t.artist}</div>
                )}
              </div>
              <div className="track-fav">
                <FavouriteButton
                  isFavourite={isFav}
                  onToggle={() => favourites.toggle(t.filePath)}
                  showOnHover={!isFav}
                />
              </div>
              <div className="track-info">
                <button
                  className="info-btn show-on-hover"
                  onClick={(e) => { e.stopPropagation(); onOpenDetails(t); }}
                  title="Track details"
                  aria-label="Track details"
                >
                  <InfoIcon />
                </button>
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

function PlayerBar({
  player,
  favourites,
}: {
  player: ReturnType<typeof usePlayer>;
  favourites: ReturnType<typeof useFavourites>;
}) {
  const { state, togglePlay, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, jumpToQueueIndex, removeFromQueue } = player;
  const t = state.currentTrack;
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  const [upNextOpen, setUpNextOpen] = useState(false);

  const repeatLabel = state.repeat === 'off' ? 'Repeat: off' : state.repeat === 'all' ? 'Repeat: all' : 'Repeat: one';
  const upcomingCount = Math.max(0, state.queue.length - state.queueIndex - 1);
  const isCurrentFav = t ? favourites.isFavourite(t.filePath) : false;

  // Drag-to-seek for both bars
  const seekDrag = useDragSeek((ratio) => {
    if (state.duration > 0) seek(ratio * state.duration);
  });
  const volumeDrag = useDragSeek((ratio) => {
    setVolume(ratio);
  });

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
            <FavouriteButton
              isFavourite={isCurrentFav}
              onToggle={() => favourites.toggle(t.filePath)}
              size={16}
              className="player-fav-button"
            />
          </>
        ) : (
          <div className="player-info-artist">No track playing</div>
        )}
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button
            className={`player-button toggle ${state.shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            aria-label="Shuffle"
            title={state.shuffle ? 'Shuffle: on' : 'Shuffle: off'}
          >
            <ShuffleIcon />
          </button>
          <button className="player-button" onClick={prev} disabled={!t} aria-label="Previous">
            <PrevIcon />
          </button>
          <button className="player-button play" onClick={togglePlay} disabled={!t} aria-label={state.isPlaying ? 'Pause' : 'Play'}>
            {state.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="player-button" onClick={next} disabled={!t} aria-label="Next">
            <NextIcon />
          </button>
          <button
            className={`player-button toggle ${state.repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            aria-label={repeatLabel}
            title={repeatLabel}
          >
            {state.repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
          </button>
        </div>
        <div className="player-progress">
          <div className="player-time">{formatTime(state.currentTime)}</div>
          <div
            ref={seekDrag.barRef}
            className={`progress-bar ${seekDrag.dragging ? 'dragging' : ''}`}
            onMouseDown={seekDrag.onMouseDown}
          >
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="player-time right">{formatTime(state.duration)}</div>
        </div>
      </div>

      <div className="player-extras">
        <div className="up-next-button-wrapper">
          <button
            className={`player-button toggle ${upNextOpen ? 'active' : ''}`}
            onClick={() => setUpNextOpen(!upNextOpen)}
            aria-label="Up next"
            title="Up next"
          >
            <QueueIcon />
            {upcomingCount > 0 && <span className="up-next-badge">{upcomingCount}</span>}
          </button>
          {upNextOpen && (
            <UpNextPopup
              queue={state.queue}
              queueIndex={state.queueIndex}
              onClose={() => setUpNextOpen(false)}
              onJump={jumpToQueueIndex}
              onRemove={removeFromQueue}
            />
          )}
        </div>
        <div className="volume">
          <VolumeIcon />
          <div
            ref={volumeDrag.barRef}
            className={`volume-bar ${volumeDrag.dragging ? 'dragging' : ''}`}
            onMouseDown={volumeDrag.onMouseDown}
          >
            <div className="volume-fill" style={{ width: `${state.volume * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
