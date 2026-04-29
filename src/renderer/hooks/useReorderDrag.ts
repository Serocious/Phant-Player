import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Drag-to-reorder behaviour for a vertical list of rows.
 *
 * Drag is intentionally slow to engage so accidental clicks don't trigger it:
 * we wait for EITHER 300ms of mouse-down OR 5px of cursor movement before
 * actually starting a drag. This means quick clicks (and brief mouse twitches
 * during a click) leave the row un-disturbed.
 *
 * Once a drag is engaged, mouse moves update the drop position (which row
 * the cursor is over) and mouse-up commits via the onCommit callback.
 */

const HOLD_DELAY_MS = 300;
const MOVE_THRESHOLD_PX = 5;

interface UseReorderDragOptions {
  /** Total number of rows. Used to clamp drop targets. */
  rowCount: number;
  /**
   * Called when the user drops. From and to are indices into the un-filtered
   * array. If from === to or the gesture didn't move anything, this is not
   * called.
   */
  onCommit: (from: number, to: number) => void;
}

export function useReorderDrag({ rowCount, onCommit }: UseReorderDragOptions) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Pending state: user has mouse-down on a row but hasn't moved or held long
  // enough to actually start a drag. We stash the info here and only promote
  // to active drag when one of the thresholds is hit.
  const pendingRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    timerId: number | null;
  } | null>(null);

  // Keep latest onCommit in a ref to avoid stale closures
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setRowRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(idx, el);
    else rowRefs.current.delete(idx);
  }, []);

  /**
   * Begin tracking a potential drag. Doesn't start the drag visually yet —
   * we wait for the user to either hold or move past the threshold.
   */
  const startTracking = useCallback((e: React.MouseEvent, idx: number) => {
    if (e.button !== 0) return;
    // Skip if click was on an interactive control inside the row
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    pendingRef.current = {
      index: idx,
      startX: e.clientX,
      startY: e.clientY,
      timerId: window.setTimeout(() => {
        // Held long enough — promote to active drag
        const pending = pendingRef.current;
        if (!pending) return;
        setDragIndex(pending.index);
        setDropIndex(pending.index);
        setGhostPos({ x: pending.startX, y: pending.startY });
      }, HOLD_DELAY_MS),
    };
  }, []);

  // Document-wide listeners for the pending-and-active phases
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Pending phase: check the movement threshold
      const pending = pendingRef.current;
      if (pending && dragIndex === null) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (dx * dx + dy * dy >= MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
          // Moved past threshold — promote to active drag
          if (pending.timerId !== null) {
            window.clearTimeout(pending.timerId);
          }
          setDragIndex(pending.index);
          setDropIndex(pending.index);
          setGhostPos({ x: e.clientX, y: e.clientY });
        }
        return;
      }

      // Active drag phase: update ghost position and drop target
      if (dragIndex === null) return;
      setGhostPos({ x: e.clientX, y: e.clientY });

      let newDropIndex: number | null = null;
      for (const [idx, el] of rowRefs.current) {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const halfway = rect.top + rect.height / 2;
          newDropIndex = e.clientY < halfway ? idx : idx + 1;
          break;
        }
      }
      if (newDropIndex === null && rowRefs.current.size > 0) {
        const sorted = [...rowRefs.current.entries()].sort((a, b) =>
          a[1].getBoundingClientRect().top - b[1].getBoundingClientRect().top
        );
        const firstRect = sorted[0][1].getBoundingClientRect();
        const lastRect = sorted[sorted.length - 1][1].getBoundingClientRect();
        if (e.clientY < firstRect.top) newDropIndex = 0;
        else if (e.clientY > lastRect.bottom) newDropIndex = rowCount;
      }
      if (newDropIndex !== null) setDropIndex(newDropIndex);
    };

    const onUp = () => {
      // Cancel pending if it never engaged
      const pending = pendingRef.current;
      if (pending) {
        if (pending.timerId !== null) {
          window.clearTimeout(pending.timerId);
        }
        pendingRef.current = null;
      }
      // If we're not actually dragging, we're done — the click happens
      // naturally because we never preventDefault'd it.
      if (dragIndex === null) return;

      // Commit the drop
      const from = dragIndex;
      const to = dropIndex;
      setDragIndex(null);
      setDropIndex(null);
      setGhostPos(null);
      if (from === null || to === null) return;
      const finalTo = to > from ? to - 1 : to;
      if (finalTo === from) return;
      commitRef.current(from, finalTo);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragIndex, dropIndex, rowCount]);

  return {
    dragIndex,
    dropIndex,
    ghostPos,
    isDragging: dragIndex !== null,
    setRowRef,
    startTracking,
  };
}
