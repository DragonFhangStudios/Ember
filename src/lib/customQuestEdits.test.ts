import { afterEach, describe, expect, it } from 'vitest';
import { DragonStage, Quest, UserState } from '../types';
import { bondTotal } from './evolution';
import {
  CUSTOM_QUEST_TARGET_MAX,
  DAILY_LIMITS,
  advanceQuest,
  correctQuest,
  createInitialState,
  dayKey,
  deleteCustomQuest,
  editCustomQuest,
  migrateState,
  rollOverDay,
} from './progression';

// Custom quests (#19): a shared daily energy allowance, editing, and deleting.

const day = (d: number, hour = 10, minute = 0) => new Date(2026, 9, d, hour, minute);
const NOW = day(20);
const ENERGY_CAP = DAILY_LIMITS.customQuestEnergy;
const GROWTH_CAP = DAILY_LIMITS.customQuestGrowth;

const custom = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, title: id, description: '', type: 'custom', completed: false,
  points: 10, isDaily: true, isCustom: true, progress: 0, target: 1, ...overrides,
});
const steps = (id: string, target: number) => custom(id, { target, points: 10 * target });

/** A hatched dragon whose day already counted, so results carry only reward messages. */
function player(quests: Quest[], now = NOW): UserState {
  const base = createInitialState(now);
  return {
    ...base,
    stage: DragonStage.HATCHLING,
    bond: { local: 30 },
    quests: [...base.quests, ...quests],
    lastActiveDay: dayKey(now),
    currentStreak: 1,
    daily: { ...base.daily, meaningfulActivity: true },
  };
}

const tap = (s: UserState, id: string, now = NOW) => advanceQuest(s, id, now);
const tapAll = (s: UserState, id: string, now = NOW) => {
  for (let i = s.quests.find(q => q.id === id)!.target; i > 0; i--) s = tap(s, id, now).state;
  return s;
};
const quest = (s: UserState, id: string) => s.quests.find(q => q.id === id)!;
const details = (q: Quest, changes: Partial<{ title: string; description: string; type: string; target: number }>) => ({
  title: q.title, description: q.description, type: q.type, target: q.target, ...changes,
});
const reload = (s: UserState, now: Date) => rollOverDay(migrateState(JSON.parse(JSON.stringify(s)), now), now);

afterEach(() => {
  DAILY_LIMITS.customQuestEnergy = ENERGY_CAP;
  DAILY_LIMITS.customQuestGrowth = GROWTH_CAP;
});

describe('custom quest energy cap', () => {
  it('is 40 energy per day from all custom quests combined', () => {
    expect(ENERGY_CAP).toBe(40);
    let s = player(Array.from({ length: 8 }, (_, i) => custom(`c${i}`)));
    for (let i = 0; i < 8; i++) s = tap(s, `c${i}`).state;
    expect(s.energy).toBe(50 + 40);
    expect(s.daily.customQuestEnergy).toBe(40);
    expect(s.quests.filter(q => q.isCustom).every(q => q.completed)).toBe(true);
  });

  it('is shared: one big quest can use the whole allowance', () => {
    let s = tapAll(player([steps('big', 6), custom('small')]), 'big');
    expect(s.energy).toBe(90);
    s = tap(s, 'small').state;
    expect(s.energy).toBe(90);
    expect(quest(s, 'small').completed).toBe(true);
  });

  it('pays only what is left when a step would cross the cap', () => {
    const start = { ...player([custom('a')]), daily: { ...player([]).daily, customQuestEnergy: 35 } };
    const { state, message } = tap(start, 'a');
    expect(state.energy).toBe(55);
    expect(state.daily.customQuestEnergy).toBe(40);
    expect(message).toMatch(/today's energy from custom quests/);
  });

  it('says which allowances are used up', () => {
    // Energy first: one multi-step quest (40 energy, 2 Bond), then a step worth 1 Bond.
    const energyFirst = tapAll(player([steps('a', 4), steps('b', 2)]), 'a');
    expect(tap(energyFirst, 'b').message).toMatch(/today's energy from custom quests\. They still count for Bond/);
    // Bond first: two one-step quests (20 energy, 4 Bond).
    const bondFirst = tap(tap(player([custom('a'), custom('b'), custom('c')]), 'a').state, 'b').state;
    expect(tap(bondFirst, 'c').message).toMatch(/today's Bond from custom quests\. They still count for energy/);
    // Both.
    let both = player([steps('a', 4), custom('b'), custom('c'), custom('d')]);
    both = tapAll(both, 'a');
    both = tap(tap(both, 'b').state, 'c').state;
    expect(tap(both, 'd').message).toMatch(/today's energy and Bond from custom quests/);
  });

  it('never touches built-in quests or other energy sources', () => {
    let s = tapAll(player([steps('big', 4)]), 'big');
    const before = s.energy;
    s = tapAll(s, 'q5'); // Hydration: 4 × 5
    s = tap(s, 'q1').state; // Morning Routine: 10
    expect(s.energy).toBe(before + 30);
    expect(s.daily.customQuestEnergy).toBe(40);
  });

  it('still counts a capped custom quest toward the streak', () => {
    const base = { ...player([custom('a')]), lastActiveDay: dayKey(day(19)), daily: { ...player([]).daily, meaningfulActivity: false, customQuestEnergy: 40 } };
    const s = tap(base, 'a').state;
    expect(s.energy).toBe(base.energy);
    expect(s.currentStreak).toBe(2);
    expect(s.daily.meaningfulActivity).toBe(true);
  });

  it('resets on the next local calendar day', () => {
    const s = tapAll(player([steps('big', 4)]), 'big');
    const next = rollOverDay(s, day(21, 0, 1));
    expect(next.daily.customQuestEnergy).toBe(0);
    expect(tap(next, 'big', day(21, 0, 2)).state.energy).toBe(s.energy + 10);
  });

  it("can't be bypassed by deleting and re-adding quests", () => {
    let s = tapAll(player([steps('a', 4)]), 'a');
    s = deleteCustomQuest(s, 'a', NOW).state;
    s = { ...s, quests: [...s.quests, steps('a2', 4)] };
    const before = s.energy;
    s = tapAll(s, 'a2');
    expect(s.energy).toBe(before);
    expect(s.daily.customQuestEnergy).toBe(40);
  });

  it("can't be bypassed by undoing and redoing", () => {
    let s = tapAll(player([steps('a', 4), custom('b')]), 'a');
    for (let i = 0; i < 10; i++) s = tap(correctQuest(s, 'a', 4, NOW).state, 'a').state;
    expect(s.energy).toBe(90);
    expect(s.daily.customQuestEnergy).toBe(40);
  });

  it('keeps counting after a reload', () => {
    const s = tapAll(player([steps('a', 3), custom('b'), custom('c')]), 'a');
    const reloaded = reload(s, day(20, 18));
    expect(reloaded.daily.customQuestEnergy).toBe(30);
    expect(tap(tap(reloaded, 'b', day(20, 18)).state, 'c', day(20, 18)).state.energy).toBe(s.energy + 10);
  });

  it('uses the configured cap, and lowering it mid-day takes nothing back', () => {
    let s = tapAll(player([steps('a', 3), custom('b')]), 'a');
    DAILY_LIMITS.customQuestEnergy = 20;
    const before = s.energy;
    s = tap(s, 'b').state;
    expect(s.energy).toBe(before);
    expect(s.daily.customQuestEnergy).toBe(30);
  });
});

describe('editing a custom quest', () => {
  it('changes title, description, category and target, keeping its id and everything earned', () => {
    let s = tap(player([steps('a', 4)]), 'a').state;
    const before = { energy: s.energy, bond: bondTotal(s.bond), scales: s.goldenScales, streak: s.currentStreak };
    s = editCustomQuest(s, 'a', { title: '  Stretch  ', description: ' gently ', type: 'type_1', target: 6 }, NOW).state;
    expect(quest(s, 'a')).toMatchObject({ id: 'a', title: 'Stretch', description: 'gently', type: 'type_1', target: 6, points: 60, progress: 1, completed: false, isCustom: true });
    expect({ energy: s.energy, bond: bondTotal(s.bond), scales: s.goldenScales, streak: s.currentStreak }).toEqual(before);
  });

  it('raising the target reopens a completed quest; new steps pay only the difference', () => {
    let s = tap(player([custom('a')]), 'a').state; // 10 energy, 2 Bond
    s = editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 3 }), NOW).state;
    expect(quest(s, 'a')).toMatchObject({ progress: 1, completed: false });
    const bond = bondTotal(s.bond);
    s = tapAll(s, 'a'); // steps 2 and 3
    expect(s.energy).toBe(50 + 30); // what a fresh 3-step quest is worth
    expect(bondTotal(s.bond)).toBe(bond); // its Bond (2) was already earned
  });

  it('lowering the target below progress shows it complete without paying anything', () => {
    let s = player([steps('a', 6)]);
    for (let i = 0; i < 4; i++) s = tap(s, 'a').state;
    const before = { energy: s.energy, bond: bondTotal(s.bond), streak: s.currentStreak };
    s = editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 2 }), NOW).state;
    expect(quest(s, 'a')).toMatchObject({ progress: 2, target: 2, completed: true });
    expect({ energy: s.energy, bond: bondTotal(s.bond), streak: s.currentStreak }).toEqual(before);
    // …and correcting then redoing still pays nothing.
    for (let i = 0; i < 3; i++) s = tap(correctQuest(s, 'a', 2, NOW).state, 'a').state;
    expect({ energy: s.energy, bond: bondTotal(s.bond), streak: s.currentStreak }).toEqual(before);
  });

  it('edit loops (down, then back up) never pay more than the quest is worth', () => {
    let s = player([steps('a', 4)]);
    s = tapAll(s, 'a');
    const full = { energy: s.energy, bond: bondTotal(s.bond) };
    for (let i = 0; i < 5; i++) {
      s = editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 1 }), NOW).state;
      s = editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 4 }), NOW).state;
      s = tapAll({ ...s, quests: s.quests.map(q => (q.id === 'a' ? { ...q, progress: 1 } : q)) }, 'a');
    }
    expect({ energy: s.energy, bond: bondTotal(s.bond) }).toEqual(full);
  });

  it('keeps the target between 1 and 100 and requires a title', () => {
    const s = player([custom('a')]);
    expect(quest(editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 0 }), NOW).state, 'a').target).toBe(1);
    expect(quest(editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 500 }), NOW).state, 'a').target).toBe(CUSTOM_QUEST_TARGET_MAX);
    expect(quest(editCustomQuest(s, 'a', details(quest(s, 'a'), { target: 2.6 }), NOW).state, 'a').target).toBe(3);
    expect(quest(editCustomQuest(s, 'a', details(quest(s, 'a'), { title: '   ' }), NOW).state, 'a').title).toBe('a');
  });

  it("can't edit built-in quests or quests that are gone", () => {
    const s = player([]);
    expect(editCustomQuest(s, 'q1', { title: 'x', description: '', type: 'custom', target: 9 }, NOW).state.quests).toEqual(s.quests);
    const gone = editCustomQuest(s, 'nope', { title: 'x', description: '', type: 'custom', target: 1 }, NOW);
    expect(gone.state.quests).toEqual(s.quests);
    expect(gone.message).toMatch(/isn't here anymore/);
  });
});

describe('deleting a custom quest', () => {
  it('removes it and keeps everything it earned', () => {
    let s = tapAll(player([steps('a', 2), custom('b')]), 'a');
    const before = { energy: s.energy, bond: bondTotal(s.bond), scales: s.goldenScales, streak: s.currentStreak, activity: s.activity, meaningful: s.daily.meaningfulActivity };
    const { state, message } = deleteCustomQuest(s, 'a', NOW);
    s = state;
    expect(s.quests.some(q => q.id === 'a')).toBe(false);
    expect({ energy: s.energy, bond: bondTotal(s.bond), scales: s.goldenScales, streak: s.currentStreak, activity: s.activity, meaningful: s.daily.meaningfulActivity }).toEqual(before);
    expect(s.daily.questRewards.a).toBeDefined(); // kept until the day rolls over
    expect(message).toMatch(/stays yours/);
  });

  it('keeps the daily Bond allowance used, so re-adding earns no extra Bond today', () => {
    let s = tap(tap(player([custom('a'), custom('b')]), 'a').state, 'b').state;
    expect(s.daily.customQuestGrowth).toBe(GROWTH_CAP);
    s = deleteCustomQuest(deleteCustomQuest(s, 'a', NOW).state, 'b', NOW).state;
    const bond = bondTotal(s.bond);
    s = tap({ ...s, quests: [...s.quests, custom('a3')] }, 'a3').state;
    expect(bondTotal(s.bond)).toBe(bond);
  });

  it("can't delete built-in quests", () => {
    const s = player([]);
    expect(deleteCustomQuest(s, 'q1', NOW).state.quests).toEqual(s.quests);
  });
});
