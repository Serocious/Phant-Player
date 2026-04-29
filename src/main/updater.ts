/**
 * Auto-update integration via electron-updater.
 *
 * Strategy: silent background download, notify the renderer when an update
 * is ready to install. Renderer can also trigger a manual check via the
 * "Check for updates" button in Settings.
 *
 * Update state is broadcast to the renderer via IPC so the UI can show a
 * toast / banner when a new version is ready.
 */
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, app } from 'electron';

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available'; currentVersion: string }
  | { state: 'error'; message: string };

const UPDATE_CHANNEL = 'updater:status';
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

class Updater {
  private currentStatus: UpdateStatus = { state: 'idle' };
  private intervalHandle: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  private wired = false;

  /**
   * Start the auto-updater. Skips itself in dev mode (when there's no
   * packaged app to update).
   */
  start(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;

    if (!app.isPackaged) {
      console.log('[updater] skipping: not packaged');
      this.setStatus({ state: 'idle' });
      return;
    }

    if (!this.wired) {
      this.wireEvents();
      this.wired = true;
    }

    autoUpdater.autoDownload = true;       // Silent download
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    // Initial check ~5s after launch (give the app time to settle), then every 4h
    setTimeout(() => this.check(), 5_000);
    this.intervalHandle = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Trigger an update check now. Safe to call any time — if a check or
   * download is already in flight, electron-updater handles it.
   */
  async check(triggeredManually = false) {
    if (!app.isPackaged) {
      // In dev, simulate a "not available" response for the UI's manual button
      this.setStatus({ state: 'not-available', currentVersion: app.getVersion() });
      return;
    }
    try {
      this.setStatus({ state: 'checking' });
      await autoUpdater.checkForUpdates();
    } catch (e: any) {
      console.warn('[updater] check failed:', e?.message ?? e);
      this.setStatus({
        state: 'error',
        message: e?.message ?? 'Update check failed',
      });
      // If the user triggered the check manually, surface the error briefly
      // and reset back to idle so they can try again.
      if (triggeredManually) {
        setTimeout(() => this.setStatus({ state: 'idle' }), 5000);
      }
    }
  }

  /**
   * Quit and install the downloaded update. Only call when status is 'ready'.
   */
  quitAndInstall() {
    if (!app.isPackaged) return;
    if (this.currentStatus.state !== 'ready') return;
    autoUpdater.quitAndInstall();
  }

  getStatus(): UpdateStatus {
    return this.currentStatus;
  }

  private wireEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.setStatus({ state: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setStatus({
        state: 'not-available',
        currentVersion: info.version || app.getVersion(),
      });
      // Drop back to idle after a short delay so the manual-check toast disappears
      setTimeout(() => {
        if (this.currentStatus.state === 'not-available') {
          this.setStatus({ state: 'idle' });
        }
      }, 4000);
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        percent: progress.percent || 0,
        transferred: progress.transferred || 0,
        total: progress.total || 0,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({ state: 'ready', version: info.version });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[updater] error:', err?.message ?? err);
      this.setStatus({
        state: 'error',
        message: err?.message ?? 'Update error',
      });
      // Auto-reset to idle after a delay
      setTimeout(() => {
        if (this.currentStatus.state === 'error') {
          this.setStatus({ state: 'idle' });
        }
      }, 8000);
    });
  }

  private setStatus(status: UpdateStatus) {
    this.currentStatus = status;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(UPDATE_CHANNEL, status);
    }
  }
}

export const updater = new Updater();
export const UPDATER_STATUS_CHANNEL = UPDATE_CHANNEL;
