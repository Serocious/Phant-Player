import React from 'react';
import type { UpdateStatus } from '../../shared/types';
import { CloseIcon } from './Icons';

interface Props {
  status: UpdateStatus;
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * Floating toast in the bottom-right corner. Visible only when there's an
 * actionable update state — silently downloading updates show nothing.
 *
 * States we render:
 * - downloading: subtle progress (so the user knows something's happening if
 *   they're paying attention)
 * - ready: "Update ready, restart to install" with a button
 * - error: brief warning
 *
 * Hidden states: idle, checking, available (we let it download silently),
 * not-available (no need to surface unless the user manually checked, which
 * is handled in Settings)
 */
export const UpdateToast: React.FC<Props> = ({ status, onInstall, onDismiss }) => {
  if (status.state === 'ready') {
    return (
      <div className="update-toast update-toast-ready">
        <div className="update-toast-content">
          <div className="update-toast-title">Update ready</div>
          <div className="update-toast-message">
            Phant {status.version} is ready to install.
          </div>
        </div>
        <div className="update-toast-actions">
          <button className="btn btn-secondary update-toast-dismiss" onClick={onDismiss}>
            Later
          </button>
          <button className="btn" onClick={onInstall}>
            Restart now
          </button>
        </div>
      </div>
    );
  }

  if (status.state === 'downloading' && status.percent > 0) {
    return (
      <div className="update-toast update-toast-downloading">
        <div className="update-toast-content">
          <div className="update-toast-title">Downloading update…</div>
          <div className="update-toast-progress">
            <div
              className="update-toast-progress-fill"
              style={{ width: `${Math.min(100, status.percent)}%` }}
            />
          </div>
        </div>
        <button
          className="update-toast-close"
          onClick={onDismiss}
          title="Hide"
          aria-label="Hide"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div className="update-toast update-toast-error">
        <div className="update-toast-content">
          <div className="update-toast-title">Update error</div>
          <div className="update-toast-message">{status.message}</div>
        </div>
        <button
          className="update-toast-close"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    );
  }

  return null;
};
