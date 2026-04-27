import { useEffect, useState, useCallback } from 'react';

/**
 * Manages the user's favourites — a set of file paths. Loaded once on mount,
 * mutations write through to the database via IPC and update local state
 * optimistically.
 *
 * Used at App level and passed down. Components consume via:
 *   const isFav = favourites.has(track.filePath);
 *   <button onClick={() => toggle(track.filePath)} />
 */
export function useFavourites() {
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.api.favouritesGetAll().then((list) => {
      setFavourites(new Set(list));
      setLoaded(true);
    });
  }, []);

  const toggle = useCallback(async (filePath: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
        window.api.favouritesRemove(filePath).catch(() => {
          // revert on error
          setFavourites((p) => new Set(p).add(filePath));
        });
      } else {
        next.add(filePath);
        window.api.favouritesAdd(filePath).catch(() => {
          setFavourites((p) => {
            const r = new Set(p);
            r.delete(filePath);
            return r;
          });
        });
      }
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (filePath: string) => favourites.has(filePath),
    [favourites]
  );

  return { favourites, toggle, isFavourite, loaded };
}
