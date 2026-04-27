import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbPath = '';
let saveTimer: NodeJS.Timeout | null = null;

/**
 * sql.js loads its WASM file relative to the script. In Electron we need to
 * tell it where to find the file.
 */
async function loadSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  // sql.js ships its WASM at node_modules/sql.js/dist/sql-wasm.wasm
  const wasmDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.js'));
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, file),
  });
  return SQL;
}

/**
 * Persist the in-memory database to disk. Called on a debounce after writes.
 */
function persistDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/**
 * Schedule a save (debounced). Calls within ~500ms of each other coalesce
 * into one disk write.
 */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistDb();
    saveTimer = null;
  }, 500);
}

export async function initDb(): Promise<Database> {
  if (db) return db;

  const sql = await loadSqlJs();

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  dbPath = path.join(userDataPath, 'library.db');

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new sql.Database(new Uint8Array(buf));
  } else {
    db = new sql.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filePath TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      albumArtist TEXT NOT NULL,
      album TEXT NOT NULL,
      trackNumber INTEGER DEFAULT 0,
      diskNumber INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      year INTEGER,
      genre TEXT,
      bitrate INTEGER,
      format TEXT NOT NULL,
      addedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album, albumArtist);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(albumArtist);
    CREATE INDEX IF NOT EXISTS idx_tracks_addedAt ON tracks(addedAt);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS favourites (
      filePath TEXT PRIMARY KEY,
      addedAt INTEGER NOT NULL
    );
  `);

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialised — call initDb() first');
  return db;
}

/**
 * Helper: run an INSERT/UPDATE/DELETE with bound params, schedule a save.
 */
export function run(sql: string, params: any[] = []) {
  const d = getDb();
  d.run(sql, params);
  scheduleSave();
}

/**
 * Helper: run a SELECT and return rows as objects.
 */
export function all<T = any>(sql: string, params: any[] = []): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Helper: SELECT a single row.
 */
export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  return all<T>(sql, params)[0];
}

/**
 * Force a synchronous save - used at app shutdown.
 */
export function flushDb() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistDb();
}

export function closeDb() {
  flushDb();
  if (db) {
    db.close();
    db = null;
  }
}
