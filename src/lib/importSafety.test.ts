import { afterEach, describe, expect, it } from 'vitest';
import { Quest } from '../types';
import { advanceQuest, createInitialState, migrateState, nextStepReward, rollOverDay } from './progression';

// A save file is untrusted input: imports, restored backups and old saves all
// go through migrateState. Synthetic, hostile data only.

const now = new Date(2026, 9, 26, 10);
const hostile = () =>
  JSON.parse(`{
    "dragonName": "Ember", "stage": "Hatchling", "lastLogin": "${now.toDateString()}",
    "__proto__": { "polluted": "state" },
    "constructor": { "prototype": { "polluted": "constructor" } },
    "bond": { "__proto__": { "polluted": "bond" }, "local": 5 },
    "stageReachedOn": { "__proto__": "2026-10-01", "Hatchling": "2026-10-25" },
    "activity": { "days": ["2026-10-25"], "legacy": [], "__proto__": { "polluted": "activity" } },
    "daily": { "date": "${now.toDateString()}", "questRewards": { "__proto__": { "q1": { "energy": 999, "growth": 999, "scales": 999 } } } }
  }`);

const isPlain = (value: unknown) => Object.getPrototypeOf(value) === Object.prototype;

afterEach(() => {
  // Undo any pollution so one failure can't leak into other tests.
  for (const proto of [Object.prototype, Array.prototype] as Record<string, unknown>[]) delete proto.polluted;
});

describe('importing a hostile save', () => {
  it('never pollutes global prototypes', () => {
    migrateState(hostile(), now);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(([] as unknown as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('rebuilds the Bond ledger, stage dates and activity as plain data', () => {
    const state = migrateState(hostile(), now);
    expect(isPlain(state)).toBe(true);
    expect(isPlain(state.bond)).toBe(true);
    expect(isPlain(state.stageReachedOn)).toBe(true);
    expect(state.stageReachedOn).toEqual({ Hatchling: '2026-10-25' });
    expect(isPlain(state.activity)).toBe(true);
  });

  // Found by the privacy audit: the per-quest reward ledger was rebuilt by
  // assigning keys one at a time, so a crafted "__proto__" key replaced that
  // object's prototype. Such a key is now kept as an ordinary entry instead.
  it('rebuilds the per-quest reward ledger as plain data, keeping "__proto__" as an ordinary key', () => {
    const state = migrateState(hostile(), now);
    expect(isPlain(state.daily.questRewards)).toBe(true);
    expect(Object.keys(state.daily.questRewards)).toEqual(['__proto__']);
    expect(state.daily.questRewards.q1).toBeUndefined();
  });
});

describe('quest ids that are unsafe property names', () => {
  const hostileQuest = (progress: number): Quest => ({ id: '__proto__', title: 'Stretch', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress, target: 3 });

  it('an old save (before the reward ledger) with a quest called "__proto__" migrates to a plain ledger', () => {
    const old = JSON.parse(JSON.stringify({ ...createInitialState(now), version: 8, quests: [hostileQuest(1)] }));
    const state = migrateState(old, now);
    expect(isPlain(state.daily.questRewards)).toBe(true);
  });

  it('a quest called "__proto__" earns the same as any other custom quest, never NaN', () => {
    const base = migrateState(JSON.parse(JSON.stringify({ ...createInitialState(now), quests: [hostileQuest(0)] })), now);
    const normal = migrateState(JSON.parse(JSON.stringify({ ...createInitialState(now), quests: [{ ...hostileQuest(0), id: 'custom_1' }] })), now);
    expect(nextStepReward(base, base.quests[0], now)).toEqual(nextStepReward(normal, normal.quests[0], now));
    const after = advanceQuest(base, '__proto__', now).state;
    const afterNormal = advanceQuest(normal, 'custom_1', now).state;
    expect(Number.isFinite(after.energy)).toBe(true);
    expect(after.energy).toBe(afterNormal.energy);
    expect(isPlain(after.daily.questRewards)).toBe(true);
  });
});

describe('the reward ledger fix leaves everything legitimate as it was', () => {
  const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const withLedger = (questRewards: Record<string, unknown>) =>
    roundTrip({ ...createInitialState(now), daily: { ...createInitialState(now).daily, questRewards } });

  it('ordinary ledger entries load exactly as saved, negative or junk values cleaned as before', () => {
    const state = migrateState(withLedger({ q1: { energy: 10, growth: 2, scales: 0 }, custom_1: { energy: 3.5, growth: 0.5, scales: 0 }, q2: { energy: -4, growth: 'x', scales: 7 }, q3: 'junk' }), now);
    expect(state.daily.questRewards).toEqual({
      q1: { energy: 10, growth: 2, scales: 0 },
      custom_1: { energy: 3.5, growth: 0.5, scales: 0 },
      q2: { energy: 0, growth: 0, scales: 7 },
    });
  });

  it('an entry keyed "__proto__" stays an ordinary entry through export and import, and the prototype stays plain', () => {
    const loaded = migrateState(withLedger(JSON.parse('{"__proto__":{"energy":5,"growth":1,"scales":0},"q1":{"energy":10,"growth":2,"scales":0}}')), now);
    const again = migrateState(roundTrip(loaded), now);
    for (const state of [loaded, again]) {
      expect(isPlain(state.daily.questRewards)).toBe(true);
      expect(Object.keys(state.daily.questRewards).sort()).toEqual(['__proto__', 'q1']);
      expect(state.daily.questRewards.q1).toEqual({ energy: 10, growth: 2, scales: 0 });
    }
  });

  it('a new day starts with a fresh, plain ledger', () => {
    const hostile = migrateState(withLedger(JSON.parse('{"__proto__":{"q1":{"energy":999,"growth":999,"scales":999}}}')), now);
    const tomorrow = rollOverDay(hostile, new Date(2026, 9, 27, 9));
    expect(tomorrow.daily.questRewards).toEqual({});
    expect(isPlain(tomorrow.daily.questRewards)).toBe(true);
  });

  it('a hostile ledger changes nothing else in the save', () => {
    const clean = createInitialState(now);
    const hostile = roundTrip({ ...clean, daily: { ...clean.daily, questRewards: JSON.parse('{"__proto__":{"q1":{"energy":999,"growth":999,"scales":999}}}') } });
    const loaded = migrateState(hostile, now);
    const loadedClean = migrateState(roundTrip(clean), now);
    const { daily: hostileDaily, ...restHostile } = loaded;
    const { daily: cleanDaily, ...restClean } = loadedClean;
    expect(restHostile).toEqual(restClean);
    const { questRewards: _h, ...dailyHostile } = hostileDaily;
    const { questRewards: _c, ...dailyClean } = cleanDaily;
    expect(dailyHostile).toEqual(dailyClean);
  });

  it('a crafted entry never makes a quest pay less or more than its normal reward', () => {
    const hostile = migrateState(withLedger(JSON.parse('{"__proto__":{"q1":{"energy":999,"growth":999,"scales":999}}}')), now);
    const clean = migrateState(withLedger({}), now);
    const q1 = (s: ReturnType<typeof migrateState>) => s.quests.find(q => q.id === 'q1')!;
    expect(nextStepReward(hostile, q1(hostile), now)).toEqual(nextStepReward(clean, q1(clean), now));
    expect(advanceQuest(hostile, 'q1', now).state.energy).toBe(advanceQuest(clean, 'q1', now).state.energy);
  });
});
