import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const TextInputModal: React.FC<Props> = ({
  title,
  initialValue = '',
  placeholder = '',
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onBackdropClick}>
      <div className="modal text-input-modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onCancel} title="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <input
            ref={inputRef}
            type="text"
            className="text-input modal-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn" onClick={submit} disabled={!value.trim()}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
