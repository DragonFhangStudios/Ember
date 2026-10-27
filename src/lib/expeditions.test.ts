import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import { createInitialState, migrateState } from './progression';
import {
  AGAIN_REACTIONS, DISCOVERIES, DiscoveryId, EXCITED, EXPEDITIONS, TREASURE_REACTIONS,
  discoveryCount, expeditionsOpen, fillName, foundInOrder, recordDiscovery, setOff, visit,
} from './expeditions';

const now = new Date(2026, 9, 27, 10);
const hatched = (): UserState => ({ ...createInitialState(now), stage: DragonStage.HATCHLING, stageSeen: DragonStage.HATCHLING });
const reload = (state: UserState, at = now) => migrateState(JSON.parse(JSON.stringify(state)), at);

/** Plays one expedition choice the way the app does: visit, then keep anything new. */
function play(state: UserState, location: number, choice: number, random = 0.3) {
  const found = visit(state, EXPEDITIONS[location].choices[choice], random);
  return { state: found.kind === 'new' ? recordDiscovery(state, found.discovery, now) : state, found };
}

describe('Little Expeditions content', () => {
  it('has three places, two choices each, and exactly six keepsakes, one per path', () => {
    expect(EXPEDITIONS.map(e => e.name)).toEqual(['Glowcap Grove', 'Pebblebrook Crossing', 'Starfall Clearing']);
    const found = EXPEDITIONS.flatMap(e => e.choices.map(c => c.find.discovery));
    expect(found).toHaveLength(6);
    expect(Object.keys(DISCOVERIES)).toHaveLength(6);
    expect(new Set(found), 'every path keeps something different').toEqual(new Set(Object.keys(DISCOVERIES)));
    for (const e of EXPEDITIONS) for (const c of e.choices) expect(c.alternate.story, `${e.id}/${c.id} has its own alternate`).not.toBe(c.find.story);
    for (const e of EXPEDITIONS) expect(new Set(e.choices.map(c => c.label)).size).toBe(2);
  });

  it('includes the keepsakes the Council asked for', () => {
    const names = Object.values(DISCOVERIES).map(d => d.name.toLowerCase());
    for (const wanted of ['river pebble', 'star fragment', 'mushroom-shaped crystal', 'tiny bell', 'shimmering feather', 'very important stone']) {
      expect(names.some(n => n.includes(wanted)), wanted).toBe(true);
    }
  });

  it('is gentle: no failure, danger, guilt or pressure anywhere, and short enough to enjoy in a minute or so', () => {
    const BANNED = [
      /\b(fail|failed|lost|hurt|injur|danger|scary|afraid|dead|die|died|death|blood|abandon|alone|lonely|sad|cry|cried|punish|wrong|bad)\b/i,
      /\bmiss(ed)? you\b/i, /\byou (should|must|need to|have to)\b/i, /\bhurry\b/i, /\blast chance\b/i, /\bstreak\b/i,
      /\bcure|heal|diagnos|therap|treatment|symptom|exercise|workout|calorie/i,
    ];
    const texts = [
      ...EXPEDITIONS.flatMap(e => [e.name, e.blurb, e.scene, ...e.choices.flatMap(c => [c.label, c.find.story, c.alternate.story])]),
      ...Object.values(DISCOVERIES).flatMap(d => [d.name, d.description]),
      ...EXCITED, ...TREASURE_REACTIONS, ...AGAIN_REACTIONS,
      ...Object.values(DragonStage).map(s => setOff(s, 'Ember')),
    ];
    for (const text of texts) for (const pattern of BANNED) expect(text, `${text} matches ${pattern}`).not.toMatch(pattern);
    for (const e of EXPEDITIONS) {
      for (const c of e.choices) {
        for (const story of [c.find.story, c.alternate.story]) {
          const words = `${e.scene} ${story}`.split(/\s+/).length;
          expect(words, `${e.id}/${c.id}`).toBeLessThan(70);
        }
      }
    }
  });

  it('fills in the dragon name everywhere and leaves no placeholders', () => {
    for (const e of EXPEDITIONS) {
      for (const c of e.choices) for (const story of [c.find.story, c.alternate.story]) expect(fillName(story, 'Ember')).not.toMatch(/[{}]/);
    }
    expect(fillName('{dragonName} and {dragonName}', 'Ember')).toBe('Ember and Ember');
  });

  it('opens once Ember hatches; each hatched stage sets off its own way', () => {
    expect(expeditionsOpen(DragonStage.EGG)).toBe(false);
    for (const s of [DragonStage.HATCHLING, DragonStage.FLEDGLING, DragonStage.DRAKE, DragonStage.ANCIENT]) expect(expeditionsOpen(s)).toBe(true);
    expect(setOff(DragonStage.HATCHLING, 'Ember')).toMatch(/toddles/);
    expect(setOff(DragonStage.FLEDGLING, 'Ember')).toMatch(/flutters/);
    expect(setOff(DragonStage.DRAKE, 'Ember')).toMatch(/glides/);
  });
});

describe('discoveries', () => {
  it('every choice keeps its keepsake on the first visit; revisits find it again or an alternate story, never anything new', () => {
    let state = hatched();
    for (let l = 0; l < 3; l++) {
      for (let c = 0; c < 2; c++) {
        const choice = EXPEDITIONS[l].choices[c];
        const first = play(state, l, c);
        expect(first.found, `${choice.id} first`).toEqual({ kind: 'new', discovery: choice.find.discovery, story: { story: choice.find.story, expression: choice.find.expression } });
        state = first.state;
        const alternate = play(state, l, c, 0.2);
        expect(alternate.found).toEqual({ kind: 'alternate', story: choice.alternate });
        expect(alternate.state, 'an alternate keeps nothing').toBe(state);
        const again = play(state, l, c, 0.8);
        expect(again.found.kind).toBe('again');
        expect(again.state, 'found again: no duplicate').toBe(state);
      }
    }
    expect(discoveryCount(state)).toBe(6);
  });

  it('replaying never duplicates a keepsake or changes when it was first found', () => {
    const once = recordDiscovery(hatched(), 'river-pebble', now);
    const again = recordDiscovery(once, 'river-pebble', new Date(2026, 10, 3));
    expect(again).toBe(once);
    expect(once.discoveries).toEqual({ 'river-pebble': '2026-10-27' });
  });

  it('keeping a keepsake changes nothing else: no Energy, Bond, Golden Scales or active day', () => {
    const before = hatched();
    const after = recordDiscovery(before, 'star-fragment', now);
    const { discoveries: _d, ...rest } = after;
    const { discoveries: _b, ...restBefore } = before;
    expect(rest).toEqual(restBefore);
  });

  it('two tabs adding keepsakes in either order end up with both, once each', () => {
    const base = hatched();
    const ab = recordDiscovery(recordDiscovery(base, 'tiny-bell', now), 'star-fragment', now);
    const ba = recordDiscovery(recordDiscovery(base, 'star-fragment', now), 'tiny-bell', now);
    expect(ab.discoveries).toEqual(ba.discoveries);
    expect(discoveryCount(recordDiscovery(ab, 'tiny-bell', now))).toBe(2);
  });

  it('ignores anything that is not a real keepsake', () => {
    expect(recordDiscovery(hatched(), 'golden-crown' as DiscoveryId, now).discoveries).toEqual({});
  });

  it('survive reloads, export/import and backups (all through migrateState)', () => {
    let state = hatched();
    for (const id of ['mushroom-crystal', 'treasure-stone', 'tiny-bell'] as DiscoveryId[]) state = recordDiscovery(state, id, now);
    const reloaded = reload(reload(state), new Date(2027, 0, 5));
    expect(reloaded.discoveries).toEqual(state.discoveries);
    expect(foundInOrder(reloaded).map(f => [f.discovery.id, f.place])).toEqual([
      ['mushroom-crystal', 'Glowcap Grove'], ['treasure-stone', 'Pebblebrook Crossing'], ['tiny-bell', 'Starfall Clearing'],
    ]);
  });

  it('existing saves load with an empty shelf, and nothing else is lost', () => {
    const { discoveries: _d, ...old } = hatched();
    const loaded = reload(old as UserState);
    expect(loaded.discoveries).toEqual({});
    expect(loaded.stage).toBe(DragonStage.HATCHLING);
  });

  it('cleans what it loads: unknown ids, impossible dates, and hostile keys are dropped', () => {
    const raw = JSON.parse(`{"dragonName":"Ember","stage":"Hatchling","lastLogin":"${now.toDateString()}",
      "discoveries":{"river-pebble":"2026-10-20","star-fragment":"2026-02-30","golden-crown":"2026-10-01","tiny-bell":42,"__proto__":{"polluted":1},"treasure-stone":"<img src=x>"}}`);
    const loaded = migrateState(raw, now);
    expect(loaded.discoveries).toEqual({ 'river-pebble': '2026-10-20' });
    expect(Object.getPrototypeOf(loaded.discoveries)).toBe(Object.prototype);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
