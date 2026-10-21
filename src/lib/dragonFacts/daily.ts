// Choosing the Daily Dragon Fact (#18): one per local calendar day, the same
// all day, and no repeats until every fact has been shown. Works offline.

import { DragonFact, FACTS } from './facts';

/** Days since 1970-01-01 for the local calendar date (unaffected by daylight saving). */
export function localDayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** A small seeded generator, so every device picks the same order. */
function seeded(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    s ^= s >>> 12;
    return (s >>> 0) / 4294967296;
  };
}

/** The order facts are shown in during one cycle through the library. */
function cycleOrder(ids: string[], cycle: number): string[] {
  const random = seeded(cycle);
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The fact for a date. Each run through the library is a shuffled cycle, so
 * nothing repeats until every fact has appeared, and a new cycle never starts
 * with the fact that ended the previous one.
 */
export function factForDay(date: Date, facts: DragonFact[] = FACTS): DragonFact {
  const ids = facts.map(f => f.id).sort();
  const day = localDayNumber(date);
  const n = ids.length;
  const byId = (id: string) => facts.find(f => f.id === id)!;
  // Two facts simply alternate. (The boundary swap below would also move the
  // last fact of a two-fact cycle, so it can't guarantee no repeats there.)
  if (n === 2) return byId(ids[((day % 2) + 2) % 2]);
  const cycle = Math.floor(day / n);
  const order = cycleOrder(ids, cycle);
  // Swapping the first two never moves the last one when n >= 3, so the
  // previous cycle's raw order ends with the same fact as its corrected order.
  if (n > 2 && order[0] === cycleOrder(ids, cycle - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return byId(order[((day % n) + n) % n]);
}
