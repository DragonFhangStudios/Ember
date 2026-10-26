import { afterEach, describe, expect, it } from 'vitest';
import { migrateState } from './progression';

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

  // Known finding (Phase B audit, low severity): the per-quest reward ledger is
  // rebuilt by assigning keys one at a time, so a crafted "__proto__" key
  // replaces that one object's prototype. The worst effect is that a player
  // who imports a crafted file has that day's quest rewards suppressed (the
  // ledger looks "already paid"); it's gone after the next save. Nothing
  // global is affected. The fix (skip "__proto__", or build the map with
  // Object.create(null) / Object.fromEntries) awaits Council approval, so this
  // test is expected to fail until then. Don't remove `.fails` without fixing it.
  it.fails('rebuilds the per-quest reward ledger as plain data, ignoring "__proto__"', () => {
    const state = migrateState(hostile(), now);
    expect(isPlain(state.daily.questRewards)).toBe(true);
    expect(state.daily.questRewards.q1).toBeUndefined();
  });
});
