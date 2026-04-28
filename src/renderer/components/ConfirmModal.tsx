import React, { useEffect } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onBackdropClick}>
      <div className="modal confirm-modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onCancel} title="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
            <button
              className={`btn ${danger ? 'btn-danger' : ''}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
