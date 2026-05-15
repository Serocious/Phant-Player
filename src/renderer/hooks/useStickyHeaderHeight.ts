import { useEffect } from 'react';

/**
 * Measures the height of the first .content-header element on screen and
 * exposes it as the --sticky-header-height CSS custom property on the
 * scroll container (.content). The .track-list-header uses this value to
 * pin exactly below the main header, regardless of the header's varying
 * content (title length, subtitle presence, button size etc.).
 *
 * If the current view has no .content-header (e.g. album detail), the
 * variable is cleared so sticky elements fall back to top: 0 / unset.
 *
 * Re-measures when the window resizes and via a ResizeObserver on the
 * header itself, so layout changes are caught.
 */
export function useStickyHeaderHeight() {
  useEffect(() => {
    const update = () => {
      const header = document.querySelector('.content-header') as HTMLElement | null;
      const container = document.querySelector('.content') as HTMLElement | null;
      if (!container) return;
      if (!header) {
        // No header on this view (e.g. album detail). Clear the variable so
        // any sticky column headers don't pin to a stale offset from a
        // previous view.
        container.style.removeProperty('--sticky-header-height');
        return;
      }
      const h = header.offsetHeight;
      container.style.setProperty('--sticky-header-height', `${h}px`);
    };

    update();

    window.addEventListener('resize', update);

    let ro: ResizeObserver | null = null;
    const tryObserve = () => {
      const header = document.querySelector('.content-header') as HTMLElement | null;
      if (!header) return;
      ro?.disconnect();
      ro = new ResizeObserver(() => update());
      ro.observe(header);
    };
    tryObserve();

    // Re-measure on a short interval for the first second after mount, to
    // catch async layout changes (fonts loading, etc).
    const intervalId = window.setInterval(update, 100);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 1500);

    // MutationObserver to re-attach the ResizeObserver when the user
    // navigates between views (the header element gets replaced or removed)
    const mo = new MutationObserver(() => {
      tryObserve();
      update();
    });
    const main = document.querySelector('main, .content');
    if (main) mo.observe(main, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
      mo.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(stopId);
    };
  }, []);
}
