import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { run, getDb } from './db';
import { BrowserWindow } from 'electron';
import { IPC, ScanProgress, ScanResult } from '../shared/types';

const SUPPORTED = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav']);

async function walkDir(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [dir];

  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED.has(ext)) {
          out.push(full);
        }
      }
    }
  }
  return out;
}

export async function scanLibrary(
  rootDir: string,
  window: BrowserWindow
): Promise<ScanResult> {
  const errors: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return { tracks: 0, albums: 0, errors: [`Music folder not found: ${rootDir}`] };
  }

  // Clear existing data (full re-scan for v1; incremental later)
  const db = getDb();
  db.run('DELETE FROM tracks');

  const files = await walkDir(rootDir);
  const total = files.length;

  if (total === 0) {
    return { tracks: 0, albums: 0, errors: ['No supported audio files found.'] };
  }

  let scanned = 0;
  const albums = new Set<string>();
  const now = Date.now();
  let lastProgress = 0;

  // sql.js doesn't support per-statement transactions cleanly across many calls;
  // we wrap the whole batch in a single transaction for speed.
  db.run('BEGIN TRANSACTION');

  const stmt = db.prepare(`
    INSERT INTO tracks (filePath, title, artist, albumArtist, album, trackNumber, diskNumber, duration, year, genre, bitrate, format, addedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(filePath) DO UPDATE SET
      title=excluded.title, artist=excluded.artist, albumArtist=excluded.albumArtist,
      album=excluded.album, trackNumber=excluded.trackNumber, diskNumber=excluded.diskNumber,
      duration=excluded.duration, year=excluded.year, genre=excluded.genre,
      bitrate=excluded.bitrate, format=excluded.format
  `);

  for (const filePath of files) {
    scanned++;
    try {
      const meta = await parseFile(filePath, { duration: true });
      const common = meta.common || {};
      const format = meta.format || {};

      const title = common.title || path.basename(filePath, path.extname(filePath));
      const artist = (common.artists && common.artists[0]) || common.artist || 'Unknown Artist';
      const albumArtist = common.albumartist || artist;
      const album = common.album || 'Unknown Album';

      stmt.run([
        filePath,
        title,
        artist,
        albumArtist,
        album,
        common.track?.no || 0,
        common.disk?.no || 0,
        format.duration || 0,
        common.year || null,
        (common.genre && common.genre[0]) || null,
        format.bitrate ? Math.round(format.bitrate / 1000) : null,
        (format.container || path.extname(filePath).slice(1)).toLowerCase(),
        now,
      ]);

      albums.add(`${albumArtist}:::${album}`);
    } catch (e: any) {
      errors.push(`${path.basename(filePath)}: ${e.message || 'parse failed'}`);
    }

    const nowTime = Date.now();
    if (nowTime - lastProgress > 100 || scanned === total) {
      lastProgress = nowTime;
      const progress: ScanProgress = {
        scanned,
        total,
        current: path.basename(filePath),
      };
      try {
        window.webContents.send(IPC.SCAN_PROGRESS, progress);
      } catch {
        // ignore
      }
    }
  }

  stmt.free();
  db.run('COMMIT');

  // Force persistence after a scan
  const { flushDb } = await import('./db');
  flushDb();

  return { tracks: scanned - errors.length, albums: albums.size, errors };
}

export async function getAlbumArtPath(trackFilePath: string): Promise<string | null> {
  const dir = path.dirname(trackFilePath);
  const candidates = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.png', 'front.jpg', 'front.png'];

  for (const c of candidates) {
    const full = path.join(dir, c);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export async function getEmbeddedArtDataUrl(trackFilePath: string): Promise<string | null> {
  try {
    const meta = await parseFile(trackFilePath);
    const pic = meta.common?.picture?.[0];
    if (pic) {
      const b64 = Buffer.from(pic.data).toString('base64');
      return `data:${pic.format};base64,${b64}`;
    }
  } catch {
    // ignore
  }
  return null;
}
