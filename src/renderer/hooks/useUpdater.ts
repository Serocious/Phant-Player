import { useEffect, useState, useCallback } from 'react';
import type { UpdateStatus } from '../../shared/types';

/**
 * Subscribes to auto-updater status events from the main process. Also
 * fetches the current status on mount in case events fired before the
 * renderer was ready.
 */
export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    let cancelled = false;
    window.api.updaterGetStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    const off = window.api.onUpdaterStatus((s) => {
      setStatus(s);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    await window.api.updaterCheck();
  }, []);

  const installNow = useCallback(async () => {
    await window.api.updaterQuitAndInstall();
  }, []);

  return { status, checkForUpdates, installNow };
}
