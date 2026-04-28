import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** If present, this item opens a submenu with these children instead of firing onClick */
  submenu?: ContextMenuEntry[];
  divider?: false;
}

export interface ContextMenuDivider {
  divider: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface MenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

/**
 * Context menu with nested submenu support. Submenus open to the right on
 * hover, fall back to the left if there's no room.
 */
export const ContextMenu: React.FC<MenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click or escape (top-level menu only — submenus close
  // when their parent does)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer attachment so the click that opened the menu doesn't immediately close it
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to keep menu inside viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 8;
    if (nx !== x || ny !== y) {
      ref.current.style.left = `${nx}px`;
      ref.current.style.top = `${ny}px`;
    }
  }, [x, y]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      <MenuItems items={items} onClose={onClose} />
    </div>
  );
};

/**
 * Renders a list of menu entries. Used for both the top-level menu and any
 * submenus.
 */
const MenuItems: React.FC<{ items: ContextMenuEntry[]; onClose: () => void }> = ({ items, onClose }) => {
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);

  return (
    <>
      {items.map((item, i) => {
        if ('divider' in item && item.divider) {
          return <div key={i} className="context-menu-divider" />;
        }
        const it = item as ContextMenuItem;
        const hasSubmenu = !!it.submenu && it.submenu.length > 0;
        const isOpen = openSubmenuIndex === i;

        return (
          <SubmenuItem
            key={i}
            item={it}
            hasSubmenu={hasSubmenu}
            isOpen={isOpen}
            onMouseEnter={() => setOpenSubmenuIndex(hasSubmenu ? i : null)}
            onClick={() => {
              if (it.disabled) return;
              if (hasSubmenu) {
                // Toggle submenu on click
                setOpenSubmenuIndex(isOpen ? null : i);
                return;
              }
              if (it.onClick) {
                it.onClick();
                onClose();
              }
            }}
            onClose={onClose}
          />
        );
      })}
    </>
  );
};

interface SubmenuItemProps {
  item: ContextMenuItem;
  hasSubmenu: boolean;
  isOpen: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  onClose: () => void;
}

const SubmenuItem: React.FC<SubmenuItemProps> = ({ item, hasSubmenu, isOpen, onMouseEnter, onClick, onClose }) => {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ left: number; top: number } | null>(null);

  // Position the submenu relative to its parent item
  useEffect(() => {
    if (!isOpen || !itemRef.current || !submenuRef.current) return;
    const itemRect = itemRef.current.getBoundingClientRect();
    const submenuRect = submenuRef.current.getBoundingClientRect();
    let left = itemRect.right - 2;
    let top = itemRect.top - 4;
    // Flip to left if no room on right
    if (left + submenuRect.width > window.innerWidth) {
      left = itemRect.left - submenuRect.width + 2;
    }
    // Push up if no room below
    if (top + submenuRect.height > window.innerHeight) {
      top = window.innerHeight - submenuRect.height - 8;
    }
    setSubmenuPos({ left, top });
  }, [isOpen]);

  return (
    <>
      <div
        ref={itemRef}
        className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${hasSubmenu ? 'has-submenu' : ''}`}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
      >
        <span>{item.label}</span>
        {hasSubmenu && (
          <span className="context-menu-arrow" aria-hidden="true">›</span>
        )}
      </div>
      {hasSubmenu && isOpen && (
        <div
          ref={submenuRef}
          className="context-menu context-submenu"
          style={submenuPos ? { left: submenuPos.left, top: submenuPos.top } : { visibility: 'hidden' }}
        >
          <MenuItems items={item.submenu!} onClose={onClose} />
        </div>
      )}
    </>
  );
};
