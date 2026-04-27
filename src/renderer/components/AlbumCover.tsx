import { useEffect, useState } from 'react';

interface Props {
  trackPath: string;
  alt: string;
  className?: string;
}

// Simple in-memory cache so we don't re-read art each time a card scrolls into view
const cache = new Map<string, string | null>();

export function AlbumCover({ trackPath, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(() => cache.get(trackPath) ?? null);
  const [loaded, setLoaded] = useState(cache.has(trackPath));

  useEffect(() => {
    if (cache.has(trackPath)) {
      setSrc(cache.get(trackPath) ?? null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    window.api.getAlbumArt(trackPath).then((art) => {
      if (cancelled) return;
      cache.set(trackPath, art);
      setSrc(art);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [trackPath]);

  if (!loaded || !src) {
    return (
      <div className={className}>
        <div className="album-cover-placeholder">{alt[0]?.toUpperCase() || '♪'}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <img src={src} alt={alt} />
    </div>
  );
}
