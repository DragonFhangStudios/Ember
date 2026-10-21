import { describe, expect, it } from 'vitest';
import { DragonFact, FACTS, LORE_FACTS, REAL_FACTS } from './facts';
import { factForDay, localDayNumber } from './daily';

const day = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m, d, h, min, s);

describe('Daily Dragon Fact', () => {
  it('is the same all day and changes at local midnight', () => {
    for (let d = 1; d <= 60; d++) {
      const morning = factForDay(day(2026, 0, d, 0, 0, 0));
      expect(factForDay(day(2026, 0, d, 12)).id).toBe(morning.id);
      expect(factForDay(day(2026, 0, d, 23, 59, 59)).id).toBe(morning.id);
      expect(factForDay(day(2026, 0, d + 1, 0, 0, 0)).id, `day ${d} → ${d + 1}`).not.toBe(morning.id);
    }
  });

  it('never repeats until every fact has been shown', () => {
    const n = FACTS.length;
    // Find the start of a cycle, then check several whole cycles.
    let start = day(2026, 0, 1);
    while (localDayNumber(start) % n !== 0) start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 12);
    for (let cycle = 0; cycle < 6; cycle++) {
      const ids = new Set<string>();
      for (let i = 0; i < n; i++) {
        ids.add(factForDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + cycle * n + i, 12)).id);
      }
      expect(ids.size, `cycle ${cycle} shows every fact once`).toBe(n);
    }
  });

  it('never shows the same fact two days in a row, even across cycles', () => {
    let previous = '';
    for (let i = 0; i < 1000; i++) {
      const id = factForDay(new Date(2026, 0, 1 + i, 12)).id;
      expect(id, `day ${i}`).not.toBe(previous);
      previous = id;
    }
  });

  it('counts local calendar days across daylight-saving changes', () => {
    // Consecutive local dates are always one day apart, whatever the time zone.
    for (let i = 0; i < 400; i++) {
      expect(localDayNumber(new Date(2026, 0, 2 + i, 0, 30)) - localDayNumber(new Date(2026, 0, 1 + i, 23, 30))).toBe(1);
    }
  });

  it('never repeats on consecutive days, and shows everything each cycle, for libraries of 2 to 25 facts', () => {
    for (let n = 2; n <= 25; n++) {
      const facts: DragonFact[] = Array.from({ length: n }, (_, i) => ({ id: `f${String(i).padStart(2, '0')}`, kind: 'lore', text: `Fact ${i}.` }));
      let previous = '';
      const start = new Date(2026, 0, 1, 12);
      const firstDay = localDayNumber(start);
      let cycleSeen = new Set<string>();
      for (let i = 0; i < 3000; i++) {
        const date = new Date(2026, 0, 1 + i, 12);
        const day = localDayNumber(date);
        const id = factForDay(date, facts).id;
        expect(id, `n=${n}, day ${i}`).not.toBe(previous);
        previous = id;
        if (day % n === 0) cycleSeen = new Set();
        cycleSeen.add(id);
        if (day % n === n - 1 && day - firstDay >= n - 1) expect(cycleSeen.size, `n=${n}, cycle ending day ${i}`).toBe(n);
      }
    }
  });

  it('works with a library of any size', () => {
    const facts: DragonFact[] = [{ id: 'only', kind: 'lore', text: 'One.' }];
    expect(factForDay(day(2026, 5, 1), facts).id).toBe('only');
    const two = [...facts, { id: 'two', kind: 'lore' as const, text: 'Two.' }];
    expect(factForDay(day(2026, 5, 1), two).id).not.toBe(factForDay(day(2026, 5, 2), two).id);
  });
});

describe('fact library', () => {
  it('has unique ids', () => {
    expect(new Set(FACTS.map(f => f.id)).size).toBe(FACTS.length);
  });

  it('cites a full source for every real-world fact', () => {
    for (const fact of REAL_FACTS) {
      expect(fact.kind).toBe('real');
      if (fact.kind !== 'real') continue;
      expect(fact.source.title.trim(), fact.id).not.toBe('');
      expect(fact.source.publisher.trim(), fact.id).not.toBe('');
      expect(fact.source.url, fact.id).toMatch(/^https:\/\/[^/\s]+\.[a-z]{2,}\//);
      expect(fact.source.checked, fact.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fact.source.checkedBy.trim(), fact.id).not.toBe('');
    }
  });

  it('includes the 16 source-checked real-world facts', () => {
    expect(REAL_FACTS).toHaveLength(16);
    expect(new Set(REAL_FACTS.map(f => f.kind === 'real' && f.source.url)).size, 'six source pages').toBe(6);
  });

  it('keeps lore and real facts apart', () => {
    expect(LORE_FACTS.every(f => f.kind === 'lore')).toBe(true);
    expect(REAL_FACTS.every(f => f.kind === 'real')).toBe(true);
  });

  it('keeps facts short, kind, and free of medical claims', () => {
    for (const fact of FACTS) {
      expect(fact.text.length, fact.id).toBeLessThanOrEqual(140);
      expect(fact.text, fact.id).not.toMatch(/\bcure|heal|diagnos|therap|treatment|medicine|prescri|you (should|must|need to)\b/i);
    }
  });
});
