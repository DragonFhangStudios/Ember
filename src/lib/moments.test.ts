import { describe, expect, it } from 'vitest';
import { DragonStage } from '../types';
import { candidates } from './dialogue/select';
import { LIBRARY } from './dialogue/library';
import { MOMENT_KINDS, SNEEZE_WINDOW_MS, SURPRISE_CHANCE, createMoments } from './moments';

const STAGES = Object.values(DragonStage);
const as = (stage: DragonStage, soft = false) => ({ stage, dragonName: 'Ember', soft });
const NOT_SURPRISING = 0.99;

describe('Dragon Moments', () => {
  it('Boop, Play and Rest each have a few different lines at every stage, including the egg and on a hard day', () => {
    for (const stage of STAGES) {
      for (const context of ['moment.boop', 'moment.play', 'moment.rest'] as const) {
        expect(candidates(context, as(stage)).length, `${context} @ ${stage}`).toBeGreaterThanOrEqual(2);
        expect(candidates(context, as(stage, true)).every(line => line.gentle), `${context} @ ${stage}, hard day`).toBe(true);
      }
      for (const context of ['moment.sneeze', 'moment.surprise'] as const) {
        expect(candidates(context, as(stage)).length, `${context} @ ${stage}`).toBeGreaterThan(0);
      }
    }
  });

  it('the egg answers differently from a hatched dragon', () => {
    for (const context of ['moment.boop', 'moment.play', 'moment.rest', 'moment.sneeze', 'moment.surprise'] as const) {
      const egg = candidates(context, as(DragonStage.EGG)).map(l => l.id);
      const hatchling = candidates(context, as(DragonStage.HATCHLING)).map(l => l.id);
      expect(egg.filter(id => hatchling.includes(id)), context).toEqual([]);
    }
  });

  it('Play suits each hatched stage', () => {
    const ids = (stage: DragonStage) => candidates('moment.play', as(stage)).map(l => l.id);
    expect(ids(DragonStage.HATCHLING)).toContain('play-sunbeam');
    expect(ids(DragonStage.FLEDGLING)).toContain('play-hop');
    expect(ids(DragonStage.DRAKE)).toContain('play-glide');
    expect(ids(DragonStage.ANCIENT)).toContain('play-heart-flame');
    expect(ids(DragonStage.HATCHLING)).not.toContain('play-zoom');
  });

  it('each action gets its own kind of line', () => {
    const moments = createMoments();
    expect(moments.contextFor('boop', 0, NOT_SURPRISING)).toBe('moment.boop');
    expect(moments.contextFor('play', 10_000, NOT_SURPRISING)).toBe('moment.play');
    expect(moments.contextFor('rest', 20_000, NOT_SURPRISING)).toBe('moment.rest');
  });

  it('three quick boops find the hidden sparkle sneeze, then it starts counting again', () => {
    const moments = createMoments();
    const boops = [0, 1000, 2000, 3000, 4000, 5000].map(t => moments.contextFor('boop', t, NOT_SURPRISING));
    expect(boops).toEqual(['moment.boop', 'moment.boop', 'moment.sneeze', 'moment.boop', 'moment.boop', 'moment.sneeze']);
  });

  it('boops spread out never sneeze, and Play or Rest in between does not count as a boop', () => {
    const moments = createMoments();
    const slow = [0, SNEEZE_WINDOW_MS, 2 * SNEEZE_WINDOW_MS, 3 * SNEEZE_WINDOW_MS].map(t => moments.contextFor('boop', t, NOT_SURPRISING));
    expect(slow).not.toContain('moment.sneeze');
    const mixed = createMoments();
    expect([mixed.contextFor('boop', 0, 0.9), mixed.contextFor('play', 100, 0.9), mixed.contextFor('rest', 200, 0.9), mixed.contextFor('boop', 300, 0.9)]).not.toContain('moment.sneeze');
  });

  it('now and then a Boop or Play is a surprise; Rest Together stays calm', () => {
    const moments = createMoments();
    expect(moments.contextFor('play', 0, SURPRISE_CHANCE / 2)).toBe('moment.surprise');
    expect(moments.contextFor('boop', 10_000, SURPRISE_CHANCE / 2)).toBe('moment.surprise');
    expect(moments.contextFor('rest', 20_000, 0)).toBe('moment.rest');
  });

  it('only covers the three moments', () => {
    expect(MOMENT_KINDS).toEqual(['boop', 'play', 'rest']);
    for (const context of ['moment.boop', 'moment.play', 'moment.rest', 'moment.sneeze', 'moment.surprise'] as const) expect(LIBRARY[context].length).toBeGreaterThan(0);
  });
});
