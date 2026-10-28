// Predictable randomness for browser tests. Players always get Math.random;
// a test can set a numeric seed on `window` (before the app starts) to know
// in advance what a game will deal.

/** A small seeded random source (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Math.random, unless a browser test set a numeric seed under `key`. */
export function randomFor(key: string): () => number {
  const seed = (globalThis as Record<string, unknown>)[key];
  return typeof seed === 'number' && Number.isFinite(seed) ? seededRandom(seed) : Math.random;
}
