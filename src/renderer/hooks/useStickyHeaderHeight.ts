import { useEffect } from 'react';

/**
 * Measures the height of the first .content-header element on screen and
 * exposes it as the --sticky-header-height CSS custom property on the
 * scroll container (.content). The .track-list-header uses this value to
 * pin exactly below the main header, regardless of the header's varying
 * content (title length, subtitle presence, button size etc.).
 *
 * Re-measures when the window resizes and via a ResizeObserver on the
 * header itself, so layout changes are caught.
 */
export function useStickyHeaderHeight() {
  useEffect(() => {
    const update = () => {
      const header = document.querySelector('.content-header') as HTMLElement | null;
      const container = document.querySelector('.content') as HTMLElement | null;
      if (!header || !container) return;
      const h = header.offsetHeight;
      container.style.setProperty('--sticky-header-height', `${h}px`);
    };

    update();

    // Re-measure on window resize
    window.addEventListener('resize', update);

    // Re-measure when the header's own size changes (e.g. switched view,
    // title got longer, search icon appeared)
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
    // catch async layout changes (fonts loading, async content like search
    // box rendering, etc.). Cheap and avoids fighting with React batching.
    const intervalId = window.setInterval(update, 100);
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 1500);

    // MutationObserver to re-attach the ResizeObserver when the user
    // navigates between views (the header element gets replaced)
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
