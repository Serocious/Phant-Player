import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: false;
}

export interface ContextMenuDivider {
  divider: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to keep menu inside viewport
  const adjusted = useRef({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 8;
    if (nx !== adjusted.current.x || ny !== adjusted.current.y) {
      ref.current.style.left = `${nx}px`;
      ref.current.style.top = `${ny}px`;
      adjusted.current = { x: nx, y: ny };
    }
  }, [x, y]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {items.map((item, i) => {
        if ('divider' in item && item.divider) {
          return <div key={i} className="context-menu-divider" />;
        }
        const it = item as ContextMenuItem;
        return (
          <div
            key={i}
            className={`context-menu-item ${it.disabled ? 'disabled' : ''} ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              if (!it.disabled) {
                it.onClick();
                onClose();
              }
            }}
          >
            {it.label}
          </div>
        );
      })}
    </div>
  );
};
