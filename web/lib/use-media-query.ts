'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const syncMatches = (event?: MediaQueryListEvent) => {
      setMatches(event?.matches ?? mediaQuery.matches);
    };

    syncMatches();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMatches);
      return () => mediaQuery.removeEventListener('change', syncMatches);
    }

    mediaQuery.addListener(syncMatches);
    return () => mediaQuery.removeListener(syncMatches);
  }, [query]);

  return matches;
}
