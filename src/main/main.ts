import { app, BrowserWindow, ipcMain, protocol, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Enable Chromium features that route MediaSession metadata into Windows
// SMTC. Without these, the now-playing info won't show in the volume
// overlay or be visible to Discord Music Presence. Must be set before
// app.whenReady().
app.commandLine.appendSwitch(
  'enable-features',
  'HardwareMediaKeyHandling,SystemMediaControls,MediaSessionService'
);

import { initDb, run, all, get, closeDb } from './db';
import { scanLibrary, getAlbumArtPath, getEmbeddedArtDataUrl } from './scanner';
import {
  setConfig as setLastfmConfig,
  isConfigured as isLastfmConfigured,
  isAuthenticated as isLastfmAuthenticated,
  loadSession as loadLastfmSession,
  getUsername as getLastfmUsername,
  startAuth as startLastfmAuth,
  completeAuth as completeLastfmAuth,
  clearSession as clearLastfmSession,
  updateNowPlaying as lastfmUpdateNowPlaying,
  scrobble as lastfmScrobble,
} from './lastfm';
import { IPC, Album, Track, LastfmStatus, ScrobbleData } from '../shared/types';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#171716',
    title: 'Phant',
    icon: path.join(app.getAppPath(), 'build/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#171716',
      symbolColor: '#ebebf0',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function registerLocalFileProtocol() {
  protocol.handle('localfile', async (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      if (!fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 });
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      const stat = fs.statSync(filePath);
      const totalSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
          const chunkSize = end - start + 1;

          const fd = fs.openSync(filePath, 'r');
          const buffer = Buffer.alloc(chunkSize);
          fs.readSync(fd, buffer, 0, chunkSize, start);
          fs.closeSync(fd);

          return new Response(buffer, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': chunkSize.toString(),
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }

      const data = fs.readFileSync(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (e: any) {
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  });
}

/**
 * Load Last.fm credentials from config.json. Looks first in the project root
 * (next to package.json) for dev convenience, then in the user data folder.
 */
function loadLastfmConfigFile() {
  const candidates = [
    path.join(app.getAppPath(), 'config.json'),
    path.join(app.getPath('userData'), 'config.json'),
  ];

  for (const configPath of candidates) {
    if (!fs.existsSync(configPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (data.lastfm?.apiKey && data.lastfm?.apiSecret) {
        setLastfmConfig({ apiKey: data.lastfm.apiKey, apiSecret: data.lastfm.apiSecret });
        console.log(`[lastfm] Configured from ${configPath}`);
        loadLastfmSession();
        return;
      } else {
        console.log(`[lastfm] ${configPath} missing lastfm.apiKey or lastfm.apiSecret`);
      }
    } catch (e: any) {
      console.error(`[lastfm] Failed to read ${configPath}:`, e.message);
    }
  }

  console.log('[lastfm] No config found. Create config.json with lastfm credentials to enable scrobbling.');
  setLastfmConfig(null);
}

function setupIpc() {
  ipcMain.handle(IPC.SETTINGS_GET, (_evt, key: string) => {
    const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_evt, key: string, value: any) => {
    run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    return true;
  });

  ipcMain.handle(IPC.GET_USER_DATA_PATH, () => app.getPath('userData'));

  ipcMain.handle(IPC.PICK_FOLDER, async (_evt, defaultPath?: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose music folder',
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.LIBRARY_SCAN, async (_evt, rootDir: string) => {
    if (!mainWindow) throw new Error('No window');
    return scanLibrary(rootDir, mainWindow);
  });

  ipcMain.handle(IPC.LIBRARY_GET_ALBUMS, (): Album[] => {
    const rows = all<any>(`
      SELECT
        MIN(id) as id,
        album as name,
        albumArtist as artist,
        MIN(year) as year,
        COUNT(*) as trackCount,
        MIN(filePath) as firstTrackPath
      FROM tracks
      GROUP BY albumArtist, album
      ORDER BY albumArtist COLLATE NOCASE, year, album COLLATE NOCASE
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      artist: r.artist,
      year: r.year,
      trackCount: r.trackCount,
      artPath: null,
      firstTrackPath: r.firstTrackPath,
    }));
  });

  ipcMain.handle(IPC.LIBRARY_GET_TRACKS_BY_ALBUM, (_evt, albumArtist: string, albumName: string): Track[] => {
    return all<Track>(`
      SELECT * FROM tracks
      WHERE albumArtist = ? AND album = ?
      ORDER BY diskNumber, trackNumber, title COLLATE NOCASE
    `, [albumArtist, albumName]);
  });

  ipcMain.handle(IPC.LIBRARY_GET_ALL_TRACKS, (): Track[] => {
    return all<Track>(`
      SELECT * FROM tracks
      ORDER BY title COLLATE NOCASE
    `);
  });

  ipcMain.handle(IPC.LIBRARY_GET_ARTISTS, () => {
    return all<any>(`
      SELECT
        albumArtist as name,
        COUNT(DISTINCT album) as albumCount,
        COUNT(*) as trackCount,
        MIN(filePath) as representativeTrackPath
      FROM tracks
      GROUP BY albumArtist
      ORDER BY albumArtist COLLATE NOCASE
    `);
  });

  ipcMain.handle(IPC.LIBRARY_GET_ALBUMS_BY_ARTIST, (_evt, artistName: string): Album[] => {
    const rows = all<any>(`
      SELECT
        MIN(id) as id,
        album as name,
        albumArtist as artist,
        MIN(year) as year,
        COUNT(*) as trackCount,
        MIN(filePath) as firstTrackPath
      FROM tracks
      WHERE albumArtist = ?
      GROUP BY album
      ORDER BY year, album COLLATE NOCASE
    `, [artistName]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      artist: r.artist,
      year: r.year,
      trackCount: r.trackCount,
      artPath: null,
      firstTrackPath: r.firstTrackPath,
    }));
  });

  // ---- Favourites ----
  ipcMain.handle(IPC.FAVOURITES_GET_ALL, (): string[] => {
    const rows = all<{ filePath: string }>('SELECT filePath FROM favourites');
    return rows.map((r) => r.filePath);
  });

  ipcMain.handle(IPC.FAVOURITES_GET_TRACKS, (): Track[] => {
    return all<Track>(`
      SELECT t.*
      FROM tracks t
      INNER JOIN favourites f ON f.filePath = t.filePath
      ORDER BY f.addedAt DESC
    `);
  });

  ipcMain.handle(IPC.FAVOURITES_ADD, (_evt, filePath: string) => {
    run(
      'INSERT OR IGNORE INTO favourites (filePath, addedAt) VALUES (?, ?)',
      [filePath, Date.now()]
    );
    return true;
  });

  ipcMain.handle(IPC.FAVOURITES_REMOVE, (_evt, filePath: string) => {
    run('DELETE FROM favourites WHERE filePath = ?', [filePath]);
    return true;
  });

  ipcMain.handle(IPC.LIBRARY_GET_ALBUM_ART, async (_evt, trackFilePath: string): Promise<string | null> => {
    const folderArt = await getAlbumArtPath(trackFilePath);
    if (folderArt) {
      const normalized = folderArt.replace(/\\/g, '/');
      return `localfile:///${normalized}`;
    }
    return getEmbeddedArtDataUrl(trackFilePath);
  });

  ipcMain.handle(IPC.LIBRARY_GET_TRACK_FILE, (_evt, filePath: string): string => {
    const normalized = filePath.replace(/\\/g, '/');
    return `localfile:///${normalized}`;
  });

  // ---- Last.fm ----
  ipcMain.handle(IPC.LASTFM_STATUS, (): LastfmStatus => ({
    configured: isLastfmConfigured(),
    authenticated: isLastfmAuthenticated(),
    username: getLastfmUsername(),
  }));

  ipcMain.handle(IPC.LASTFM_START_AUTH, async () => {
    await startLastfmAuth();
    return true;
  });

  ipcMain.handle(IPC.LASTFM_COMPLETE_AUTH, async () => {
    return completeLastfmAuth();
  });

  ipcMain.handle(IPC.LASTFM_DISCONNECT, () => {
    clearLastfmSession();
    return true;
  });

  ipcMain.handle(IPC.LASTFM_NOW_PLAYING, async (_evt, track: ScrobbleData) => {
    await lastfmUpdateNowPlaying(track);
  });

  ipcMain.handle(IPC.LASTFM_SCROBBLE, async (_evt, track: ScrobbleData) => {
    await lastfmScrobble(track);
  });
}

app.whenReady().then(async () => {
  registerLocalFileProtocol();
  await initDb();
  loadLastfmConfigFile();
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
