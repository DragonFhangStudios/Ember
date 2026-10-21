import { useEffect, useState } from 'react';

/** Whether a CSS media query matches, kept current as device settings change. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The device's dark appearance setting. */
export const useSystemDark = () => useMediaQuery('(prefers-color-scheme: dark)');

/**
 * The device's reduced-motion setting. (Motion's own useReducedMotion reads it
 * only once, when a component mounts.)
 */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
