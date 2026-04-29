import crypto from 'crypto';
import { shell } from 'electron';
import { run, get } from './db';

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

interface Config {
  apiKey: string;
  apiSecret: string;
}

let config: Config | null = null;
let sessionKey: string | null = null;
let username: string | null = null;
// Pending auth token while user authorises in browser
let pendingAuthToken: string | null = null;

export function setConfig(cfg: Config | null) {
  config = cfg;
}

export function isConfigured(): boolean {
  return !!(config && config.apiKey && config.apiSecret);
}

/**
 * Returns the Last.fm API key if configured, otherwise null. The API key alone
 * (no secret, no auth) is enough to call public read-only endpoints like
 * album.getInfo. Used by the Discord RPC module for album-art lookups.
 */
export function getApiKey(): string | null {
  return config?.apiKey || null;
}

/**
 * Load any saved session from the database. Returns the saved username if
 * found, else null.
 */
export function loadSession(): { username: string } | null {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['lastfm_session']);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    sessionKey = parsed.sessionKey;
    username = parsed.username;
    return { username: username! };
  } catch {
    return null;
  }
}

function saveSession(sk: string, name: string) {
  sessionKey = sk;
  username = name;
  run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['lastfm_session', JSON.stringify({ sessionKey: sk, username: name })]
  );
}

export function clearSession() {
  sessionKey = null;
  username = null;
  pendingAuthToken = null;
  run('DELETE FROM settings WHERE key = ?', ['lastfm_session']);
}

export function isAuthenticated(): boolean {
  return !!sessionKey;
}

export function getUsername(): string | null {
  return username;
}

/**
 * Sign a Last.fm API call. Signature = MD5 of all params (excluding "format"
 * and "callback") concatenated as key+value pairs in alphabetical key order,
 * with the shared secret appended.
 */
function sign(params: Record<string, string>): string {
  if (!config) throw new Error('Last.fm not configured');
  const keys = Object.keys(params)
    .filter((k) => k !== 'format' && k !== 'callback')
    .sort();
  const concat = keys.map((k) => k + params[k]).join('') + config.apiSecret;
  return crypto.createHash('md5').update(concat, 'utf8').digest('hex');
}

async function apiGet(method: string, extraParams: Record<string, string> = {}): Promise<any> {
  if (!config) throw new Error('Last.fm not configured');
  const params: Record<string, string> = {
    method,
    api_key: config.apiKey,
    format: 'json',
    ...extraParams,
  };
  const url = new URL(API_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(
  method: string,
  extraParams: Record<string, string> = {},
  signed = true
): Promise<any> {
  if (!config) throw new Error('Last.fm not configured');
  const params: Record<string, string> = {
    method,
    api_key: config.apiKey,
    ...extraParams,
  };
  if (signed) {
    params.api_sig = sign(params);
  }
  params.format = 'json';

  const body = new URLSearchParams(params);
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

/**
 * Step 1 of auth: get a request token, open the browser to the Last.fm
 * authorisation page. After the user clicks "Yes, allow access", call
 * completeAuth() to exchange the token for a session key.
 */
export async function startAuth(): Promise<void> {
  if (!config) throw new Error('Last.fm not configured');
  const result = await apiGet('auth.getToken');
  if (!result.token) {
    throw new Error(`Failed to get auth token: ${JSON.stringify(result)}`);
  }
  pendingAuthToken = result.token;

  const authUrl = `https://www.last.fm/api/auth/?api_key=${config.apiKey}&token=${result.token}`;
  await shell.openExternal(authUrl);
}

/**
 * Step 2 of auth: exchange the pending token for a session key. The user
 * must have authorised in their browser before calling this.
 */
export async function completeAuth(): Promise<{ username: string }> {
  if (!pendingAuthToken) throw new Error('No pending auth — call startAuth first');

  const result = await apiPost('auth.getSession', { token: pendingAuthToken }, true);

  if (!result.session) {
    throw new Error(`Auth failed: ${result.message || JSON.stringify(result)}`);
  }

  saveSession(result.session.key, result.session.name);
  pendingAuthToken = null;
  return { username: result.session.name };
}

interface ScrobbleTrack {
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  duration?: number; // seconds
  timestamp?: number; // unix seconds
}

/**
 * Update "now playing" status. Shows live on the user's last.fm profile
 * but does not count as a scrobble.
 */
export async function updateNowPlaying(t: ScrobbleTrack): Promise<void> {
  if (!sessionKey) return;
  const params: Record<string, string> = {
    sk: sessionKey,
    artist: t.artist,
    track: t.track,
  };
  if (t.album) params.album = t.album;
  if (t.albumArtist) params.albumArtist = t.albumArtist;
  if (t.trackNumber) params.trackNumber = t.trackNumber.toString();
  if (t.duration) params.duration = Math.round(t.duration).toString();

  try {
    const result = await apiPost('track.updateNowPlaying', params, true);
    if (result.error) {
      console.warn('[lastfm] now playing failed:', result.message);
    }
  } catch (e) {
    console.warn('[lastfm] now playing error:', e);
  }
}

/**
 * Submit a scrobble. Should only be called after the official rule is
 * satisfied: track is at least 30 seconds long, AND has been played for
 * at least 4 minutes OR 50% of its duration (whichever is shorter).
 */
export async function scrobble(t: ScrobbleTrack): Promise<void> {
  if (!sessionKey) return;
  const params: Record<string, string> = {
    sk: sessionKey,
    artist: t.artist,
    track: t.track,
    timestamp: (t.timestamp ?? Math.floor(Date.now() / 1000)).toString(),
  };
  if (t.album) params.album = t.album;
  if (t.albumArtist) params.albumArtist = t.albumArtist;
  if (t.trackNumber) params.trackNumber = t.trackNumber.toString();
  if (t.duration) params.duration = Math.round(t.duration).toString();

  try {
    const result = await apiPost('track.scrobble', params, true);
    if (result.error) {
      console.warn('[lastfm] scrobble failed:', result.message);
    } else if (result.scrobbles?.['@attr']?.accepted === 1) {
      console.log('[lastfm] scrobbled:', t.artist, '-', t.track);
    }
  } catch (e) {
    console.warn('[lastfm] scrobble error:', e);
  }
}
