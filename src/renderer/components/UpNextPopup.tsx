import React, { useEffect, useRef } from 'react';
import type { Track } from '../../shared/types';
import { AlbumCover } from './AlbumCover';
import { CloseIcon } from './Icons';

interface Props {
  queue: Track[];
  queueIndex: number;
  onClose: () => void;
  onJump: (idx: number) => void;
  onRemove: (idx: number) => void;
}

export const UpNextPopup: React.FC<Props> = ({ queue, queueIndex, onClose, onJump, onRemove }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer attachment so the click that opened the popup doesn't immediately close it
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

  // The "upcoming" portion of the queue (after the current track)
  const upcoming = queue.slice(queueIndex + 1);
  const current = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;

  return (
    <div ref={ref} className="up-next-popup">
      <div className="up-next-header">
        <div className="up-next-title">Up Next</div>
        <button className="up-next-close" onClick={onClose} title="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="up-next-body">
        {current && (
          <>
            <div className="up-next-section-label">Now playing</div>
            <div className="up-next-row playing">
              <div className="up-next-cover">
                <AlbumCover trackPath={current.filePath} alt={current.album} className="up-next-cover-img" />
              </div>
              <div className="up-next-info">
                <div className="up-next-track-title">{current.title}</div>
                <div className="up-next-track-artist">{current.artist}</div>
              </div>
            </div>
          </>
        )}

        {upcoming.length === 0 ? (
          <div className="up-next-empty">Nothing coming up.</div>
        ) : (
          <>
            <div className="up-next-section-label">Up next ({upcoming.length})</div>
            {upcoming.map((t, i) => {
              const realIdx = queueIndex + 1 + i;
              return (
                <div
                  key={`${t.filePath}:${realIdx}`}
                  className="up-next-row"
                  onDoubleClick={() => onJump(realIdx)}
                >
                  <div className="up-next-cover">
                    <AlbumCover trackPath={t.filePath} alt={t.album} className="up-next-cover-img" />
                  </div>
                  <div className="up-next-info">
                    <div className="up-next-track-title">{t.title}</div>
                    <div className="up-next-track-artist">{t.artist}</div>
                  </div>
                  <button
                    className="up-next-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(realIdx);
                    }}
                    title="Remove from queue"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
