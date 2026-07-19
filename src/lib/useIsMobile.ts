import { useEffect, useState } from 'react';

/** Tracks whether the viewport is at or below `maxWidth` (default: tablet/phone breakpoint). */
export function useIsMobile(maxWidth = 860): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [maxWidth]);

  return isMobile;
}
