import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Generic drag-to-seek behaviour for a horizontal slider bar.
 *
 * - On mousedown: commits the value at click position and starts tracking
 * - On mousemove (document-wide): commits the value at cursor position, clamped
 * - On mouseup: stops tracking
 *
 * Returns a ref to attach to the bar and a `dragging` flag (useful for visual
 * feedback like keeping the bar slightly enlarged while dragging).
 */
export function useDragSeek(onCommit: (ratio: number) => void) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep onCommit fresh without re-binding listeners on every render
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Compute the ratio (0..1) based on a clientX coordinate relative to the bar
  const ratioFromClientX = useCallback((clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const r = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, r));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    setDragging(true);
    commitRef.current(ratioFromClientX(e.clientX));
  }, [ratioFromClientX]);

  // While dragging, listen to document-wide move/up events so users can drag
  // outside the bar and still control the slider.
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      commitRef.current(ratioFromClientX(e.clientX));
    };
    const onUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, ratioFromClientX]);

  return { barRef, dragging, onMouseDown };
}
