import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import { bondTotal } from './evolution';
import { MIN_RECOGNIZED_FIELDS, UnrecognizedLegacySaveError, checkLegacySave, parseLegacySave } from './legacySave';
import { SAVE_VERSION, createInitialState, migrateState } from './progression';
import { LegacySaveUnreadableError, openStore } from './store';

const NOW = new Date(2026, 9, 20, 10);

// The original AI Studio save shape (no version field), as older players have it.
const originalSave = {
  dragonName: 'Ember', stage: 'Fledgling', energy: 140, goldenScales: 61, growthProgress: 48,
  lastLogin: 'Mon Oct 19 2026', isNapping: false, quests: [], symptomLogs: [], inventory: ['scarf_red'],
  equipped: { scarf: 'scarf_red' }, badges: [], petCount: 4,
};

describe('recognizing a genuine Ember save', () => {
  it.each([
    ['an empty object', {}],
    ['an unrelated object', { unrelated: true }],
    ['a version with no Ember data', { version: 6 }],
    ['only one Ember field', { energy: 50 }],
    ['Ember field names with the wrong types', { stage: 'Unicorn', energy: 'lots', quests: 'none', lastLogin: 7 }],
    ['an array', [1, 2, 3]],
    ['a string', 'hello'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(checkLegacySave(value).recognized).toBe(false);
  });

  it.each([
    ['a version from the future', { ...originalSave, version: SAVE_VERSION + 1 }, /newer version/],
    ['a negative version', { ...originalSave, version: -2 }, /invalid save version/],
    ['a non-integer version', { ...originalSave, version: 2.5 }, /invalid save version/],
    ['a text version', { ...originalSave, version: '6' }, /invalid save version/],
  ])('rejects %s even with real data', (_label, value, reason) => {
    const check = checkLegacySave(value);
    expect(check.recognized).toBe(false);
    if (check.recognized === false) expect(check.reason).toMatch(reason);
  });

  it.each([
    ['the original save (no version)', originalSave],
    ['a v3 save', { ...originalSave, version: 3, daily: { date: 'Mon Oct 19 2026' } }],
    ['a v5 save', { ...originalSave, version: 5, lastActiveDay: 'Mon Oct 19 2026' }],
    ['a v6 save (Bond and active days)', { ...createInitialState(NOW), version: 6, focus: undefined, completedFocusSessions: undefined }],
    ['a current save', createInitialState(NOW)],
    ['a partially damaged save', { stage: 'Drake', energy: 80, quests: 'garbage', badges: null }],
    ['a save with extra unknown fields', { ...originalSave, futureFeature: { x: 1 } }],
  ])('recognizes %s', (_label, value) => {
    expect(checkLegacySave(value)).toEqual({ recognized: true });
  });

  it(`needs at least ${MIN_RECOGNIZED_FIELDS} correctly typed Ember fields`, () => {
    expect(checkLegacySave({ stage: 'Egg' }).recognized).toBe(false);
    expect(checkLegacySave({ stage: 'Egg', lastLogin: 'Tue Oct 20 2026' }).recognized).toBe(true);
  });
});

describe('parsing the legacy localStorage value', () => {
  it('no stored value means no legacy save', () => {
    expect(parseLegacySave(null)).toBeNull();
  });

  it('corrupt JSON throws', () => {
    expect(() => parseLegacySave('{"stage":"Egg"')).toThrow(SyntaxError);
  });

  it.each(['{}', '{"unrelated":true}', '[]', '"text"', '42', 'null'])('unrecognizable data %s throws instead of becoming a new save', text => {
    expect(() => parseLegacySave(text)).toThrow(UnrecognizedLegacySaveError);
  });

  it('a legitimate legacy save is returned unchanged for migration', () => {
    expect(parseLegacySave(JSON.stringify(originalSave))).toEqual(originalSave);
  });
});

describe('end to end: opening the store with the legacy slot', () => {
  let n = 0;
  const open = (stored: string | null) =>
    openStore<UserState>({
      indexedDB: new IDBFactory(),
      dbName: `legacy-${++n}`,
      readLegacy: () => parseLegacySave(stored),
      migrate: raw => migrateState(raw, NOW),
    });

  it.each(['{}', '{"unrelated":true}', '{"version":6}'])('%s enters recovery instead of creating a fresh profile', async text => {
    const error = await open(text).catch(e => e);
    expect(error).toBeInstanceOf(LegacySaveUnreadableError);
    expect(error.cause).toBeInstanceOf(UnrecognizedLegacySaveError);
  });

  it('a legitimate original save migrates with its progress intact', async () => {
    const { store, initial } = await open(JSON.stringify(originalSave));
    expect(initial.state.stage).toBe(DragonStage.FLEDGLING);
    expect(initial.state.goldenScales).toBe(61);
    expect(initial.state.inventory).toEqual(['scarf_red']);
    expect(bondTotal(initial.state.bond)).toBe(48);
    store.close();
  });

  it('a partially damaged save is still recovered rather than refused', async () => {
    const { store, initial } = await open(JSON.stringify({ stage: 'Drake', energy: 80, quests: 'garbage' }));
    expect(initial.state.stage).toBe(DragonStage.DRAKE);
    expect(initial.state.energy).toBe(80);
    store.close();
  });

  it('no legacy save at all starts a new player normally', async () => {
    const { store, initial } = await open(null);
    expect(initial.changed).toBe(true);
    expect(initial.state.stage).toBe(DragonStage.EGG);
    store.close();
  });
});
