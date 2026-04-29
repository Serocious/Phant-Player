/**
 * Discord Rich Presence integration.
 *
 * Connects to the local Discord client via IPC (no network) and reports the
 * currently playing track. Album art is looked up via Last.fm first (best
 * coverage for indie/doujin/non-mainstream music) and iTunes as a fallback
 * (best for mainstream releases). Falls back to the Phant logo when neither
 * matches.
 *
 * Discord constraints to be aware of:
 *  - Album art must be a public URL; we can't pass image bytes
 *  - Activity updates rate-limited to ~5 per 20 seconds; we debounce
 *  - The IPC connection drops when Discord closes; we retry every 30s
 */
import { Client, type SetActivity } from '@xhayper/discord-rpc';
import { getApiKey as getLastfmApiKey } from './lastfm';

const CLIENT_ID_KEY = 'discordClientId';
const ENABLED_KEY = 'discordRpcEnabled';

interface ActivityInput {
  artist: string;
  title: string;
  album: string;
  durationSec: number;
  startTimestampSec: number;
  paused: boolean;
}

class DiscordRichPresence {
  private client: Client | null = null;
  private clientId: string | null = null;
  private enabled = false;
  private connecting = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingActivity: ActivityInput | null = null;
  private lastActivityKey: string = '';
  private albumArtCache = new Map<string, string | null>();

  /**
   * Configure with the user-provided client ID. Pass null to disable.
   */
  configure(clientId: string | null, enabled: boolean) {
    const idChanged = this.clientId !== clientId;
    const enabledChanged = this.enabled !== enabled;
    this.clientId = clientId;
    this.enabled = enabled;

    if (!enabled || !clientId) {
      this.disconnect();
      return;
    }
    if (idChanged || enabledChanged) {
      this.disconnect();
      this.connect();
    }
  }

  private async connect() {
    if (!this.enabled || !this.clientId || this.client || this.connecting) return;
    this.connecting = true;
    try {
      const client = new Client({ clientId: this.clientId, transport: { type: 'ipc' } });
      client.on('disconnected', () => {
        // Discord went away — null out and retry later
        this.client = null;
        this.scheduleRetry();
      });
      // Some forks emit 'error'; harmless if not
      (client as any).on?.('error', (err: any) => {
        console.warn('[discord-rpc] error:', err?.message ?? err);
      });
      await client.login();
      this.client = client;
      this.connecting = false;
      // Re-emit the most recent activity
      if (this.pendingActivity) {
        this.flushActivity();
      }
    } catch (e: any) {
      // Discord not running, or rejected the connection — quietly retry
      this.connecting = false;
      this.scheduleRetry();
    }
  }

  private disconnect() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.client) {
      try {
        this.client.user?.clearActivity().catch(() => {});
        this.client.destroy().catch(() => {});
      } catch {}
      this.client = null;
    }
    this.lastActivityKey = '';
  }

  private scheduleRetry() {
    if (!this.enabled) return;
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, 30_000);
  }

  /**
   * Update the displayed activity. Debounced to ~750ms to avoid hammering
   * Discord's rate limit when the user skips quickly.
   */
  setActivity(activity: ActivityInput | null) {
    if (!this.enabled) return;
    this.pendingActivity = activity;

    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      this.flushActivity();
    }, 750);
  }

  private async flushActivity() {
    if (!this.client) {
      this.connect();
      return;
    }
    const a = this.pendingActivity;
    if (!a) {
      try { await this.client.user?.clearActivity(); } catch {}
      this.lastActivityKey = '';
      return;
    }

    // Avoid duplicate updates (Discord rate-limits anyway)
    const key = JSON.stringify({
      a: a.artist, t: a.title, al: a.album,
      p: a.paused, d: a.durationSec, s: a.startTimestampSec,
    });
    if (key === this.lastActivityKey) return;
    this.lastActivityKey = key;

    // Look up album art (cached). Don't await for first-paint speed —
    // present the activity with a logo first, then update with art when ready.
    const cacheKey = `${a.artist}:::${a.album}`;
    let largeImageUrl: string | undefined = this.albumArtCache.get(cacheKey) || undefined;

    const baseActivity: SetActivity = {
      type: 2, // Listening
      details: a.title.slice(0, 128),
      state: a.artist.slice(0, 128),
      largeImageKey: largeImageUrl ?? 'phant_logo',
      largeImageText: a.album.slice(0, 128),
      smallImageKey: a.paused ? 'pause' : 'play',
      smallImageText: a.paused ? 'Paused' : 'Playing',
    };
    if (!a.paused && a.durationSec > 0) {
      baseActivity.startTimestamp = a.startTimestampSec * 1000;
      baseActivity.endTimestamp = (a.startTimestampSec + a.durationSec) * 1000;
    }

    try {
      await this.client.user?.setActivity(baseActivity);
    } catch (e: any) {
      console.warn('[discord-rpc] setActivity failed:', e?.message ?? e);
    }

    // If we don't yet have album art, fetch it asynchronously
    if (!this.albumArtCache.has(cacheKey)) {
      this.fetchAlbumArt(a.artist, a.album).then(async (url) => {
        this.albumArtCache.set(cacheKey, url);
        // If the user is still on the same track, update with real art
        const stillSame = this.pendingActivity &&
          this.pendingActivity.artist === a.artist &&
          this.pendingActivity.album === a.album &&
          this.pendingActivity.title === a.title;
        if (!stillSame || !this.client || !url) return;
        try {
          await this.client.user?.setActivity({
            ...baseActivity,
            largeImageKey: url,
          });
        } catch {}
      });
    }
  }

  /**
   * Look up album art. Tries multiple sources in order:
   *   1. Last.fm (best coverage for indie / doujin / non-mainstream music)
   *   2. iTunes (best coverage for mainstream releases)
   * Returns the first successful URL, or null if none matched.
   */
  private async fetchAlbumArt(artist: string, album: string): Promise<string | null> {
    if (!artist || !album || album === 'Unknown Album') return null;

    const lastfm = await this.fetchLastfmArt(artist, album);
    if (lastfm) return lastfm;

    const itunes = await this.fetchItunesArt(artist, album);
    if (itunes) return itunes;

    return null;
  }

  /**
   * Look up album art via Last.fm's album.getInfo endpoint. Uses the user's
   * existing API key — no signing required for public reads. Filters out
   * Last.fm's well-known "no image" placeholder.
   */
  private async fetchLastfmArt(artist: string, album: string): Promise<string | null> {
    const apiKey = getLastfmApiKey();
    if (!apiKey) return null;
    const url = `https://ws.audioscrobbler.com/2.0/` +
      `?method=album.getinfo&autocorrect=1&format=json` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&artist=${encodeURIComponent(artist)}` +
      `&album=${encodeURIComponent(album)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json() as {
        album?: { image?: Array<{ '#text': string; size: string }> };
        error?: number;
      };
      if (data.error || !data.album?.image) return null;

      // Image array comes ordered: small, medium, large, extralarge, mega.
      // Pick the largest non-empty one.
      const sizes = data.album.image;
      for (let i = sizes.length - 1; i >= 0; i--) {
        const url = sizes[i]['#text'];
        if (!url) continue;
        // Skip Last.fm's "no image" placeholder
        if (url.includes('2a96cbd8b46e442fc41c2b86b821562f')) continue;
        return url;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Look up album art via the iTunes Search API. Returns a public URL or null.
   */
  private async fetchItunesArt(artist: string, album: string): Promise<string | null> {
    const term = encodeURIComponent(`${artist} ${album}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=1`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json() as { results?: Array<{ artworkUrl100?: string }> };
      const art = data.results?.[0]?.artworkUrl100;
      if (!art) return null;
      // iTunes returns 100×100 by default but accepts arbitrary sizes via string replace
      return art.replace('100x100bb', '512x512bb');
    } catch (e) {
      return null;
    }
  }

  shutdown() {
    this.disconnect();
  }
}

export const discordRichPresence = new DiscordRichPresence();
export const DISCORD_KEYS = { CLIENT_ID_KEY, ENABLED_KEY };
