import { afterEach, describe, expect, it } from 'vitest';
import { DragonStage, Quest, UserState } from '../types';
import {
  DAILY_LIMITS,
  REWARDS,
  advanceQuest,
  createInitialState,
  dayKey,
  migrateState,
  rollOverDay,
} from './progression';
import { bondTotal } from './evolution';

const day = (d: number, hour = 10, minute = 0) => new Date(2026, 9, d, hour, minute);
const CAP = DAILY_LIMITS.customQuestGrowth;

const custom = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, title: id, description: '', type: 'custom', completed: false,
  points: 10, isDaily: true, isCustom: true, progress: 0, target: 1, ...overrides,
});

/** A hatched dragon whose streak already counted today, so results carry only cap messages. */
function withCustomQuests(quests: Quest[], now = day(20)): UserState {
  const base = createInitialState(now);
  return {
    ...base,
    bond: { local: 30 },
    stage: DragonStage.HATCHLING,
    quests: [...base.quests, ...quests],
    lastActiveDay: dayKey(now),
    currentStreak: 1,
    daily: { ...base.daily, meaningfulActivity: true },
  };
}

const complete = (state: UserState, id: string, now = day(20)) => advanceQuest(state, id, now);
const reload = (state: UserState, now: Date) => rollOverDay(migrateState(JSON.parse(JSON.stringify(state)), now), now);
const many = (n: number, overrides: Partial<Quest> = {}) => Array.from({ length: n }, (_, i) => custom(`c${i}`, overrides));

afterEach(() => {
  DAILY_LIMITS.customQuestGrowth = CAP;
});

describe('custom quest growth cap', () => {
  it(`is ${CAP} growth per day by default`, () => {
    expect(CAP).toBe(4);
  });

  it('stops growth at the cap but keeps every quest completable', () => {
    let state = withCustomQuests(many(20));
    for (let i = 0; i < 20; i++) state = complete(state, `c${i}`).state;
    expect(bondTotal(state.bond)).toBe(30 + CAP);
    expect(state.daily.customQuestGrowth).toBe(CAP);
    expect(state.quests.filter(q => q.isCustom).every(q => q.completed)).toBe(true);
  });

  it('never reduces energy (energy has its own cap, #19)', () => {
    let state = withCustomQuests(many(10));
    for (let i = 0; i < 10; i++) state = complete(state, `c${i}`).state;
    expect(state.energy).toBe(50 + DAILY_LIMITS.customQuestEnergy);
  });

  it('grants a partial reward when a quest would exceed the remaining allowance', () => {
    const start = { ...withCustomQuests([custom('a')]), daily: { ...withCustomQuests([]).daily, customQuestGrowth: CAP - 1 } };
    const { state, message } = complete(start, 'a');
    expect(bondTotal(state.bond)).toBe(30 + 1);
    expect(state.daily.customQuestGrowth).toBe(CAP);
    expect(state.energy).toBe(60);
    expect(message).toMatch(/today's Bond from custom quests/);
  });

  it('shows no cap message while under the cap', () => {
    expect(complete(withCustomQuests([custom('a')]), 'a').message).toBeUndefined();
  });

  it('caps multi-step quests per step without floating-point drift', () => {
    // 2/3 growth per step: six steps reach exactly 4, the seventh gets nothing.
    let state = withCustomQuests([custom('a', { target: 3 }), custom('b', { target: 3 }), custom('c', { target: 3 })]);
    for (const id of ['a', 'b']) for (let i = 0; i < 3; i++) state = complete(state, id).state;
    expect(state.daily.customQuestGrowth).toBe(4);
    const before = bondTotal(state.bond);
    const step = complete(state, 'c');
    expect(bondTotal(step.state.bond)).toBe(before);
    expect(step.state.quests.find(q => q.id === 'c')?.progress).toBe(1);
    expect(step.message).toMatch(/custom quests/);
  });

  it('does not affect or consume allowance from built-in quests', () => {
    let state = withCustomQuests(many(3));
    for (let i = 0; i < 3; i++) state = complete(state, `c${i}`).state;
    const before = bondTotal(state.bond);
    state = complete(state, 'q1').state; // built-in Morning Routine
    expect(bondTotal(state.bond)).toBe(before + REWARDS.questGrowth);
    expect(state.daily.customQuestGrowth).toBe(CAP);
  });

  it('custom quests in the Vitality category earn standard rewards that count toward the cap (#10)', () => {
    let state = withCustomQuests([custom('v1', { type: 'medication' }), custom('v2', { type: 'medication' }), custom('v3', { type: 'medication' })]);
    for (const id of ['v1', 'v2', 'v3']) state = complete(state, id).state;
    expect(bondTotal(state.bond)).toBe(30 + CAP);
    expect(state.goldenScales).toBe(0);
  });

  it('still counts a custom quest toward the streak after the cap is reached', () => {
    const capped = withCustomQuests([custom('a')]);
    const state: UserState = {
      ...capped,
      lastActiveDay: dayKey(day(19)),
      daily: { ...capped.daily, meaningfulActivity: false, customQuestGrowth: CAP },
    };
    const result = complete(state, 'a');
    expect(bondTotal(result.state.bond)).toBe(30);
    expect(result.state.currentStreak).toBe(2);
    expect(result.message).toMatch(/2-day streak/);
    expect(result.message).toMatch(/custom quests/);
  });
});

describe('cap persistence and daily reset', () => {
  it('persists across a refresh', () => {
    let state = withCustomQuests(many(4));
    for (let i = 0; i < 2; i++) state = complete(state, `c${i}`).state;
    state = reload(state, day(20, 15));
    expect(state.daily.customQuestGrowth).toBe(CAP);
    expect(bondTotal(complete(state, 'c2', day(20, 15)).state.bond)).toBe(bondTotal(state.bond));
  });

  it('resets on the next calendar day', () => {
    let state = withCustomQuests(many(3));
    for (let i = 0; i < 3; i++) state = complete(state, `c${i}`).state;
    const before = bondTotal(state.bond);
    state = rollOverDay(state, day(21));
    expect(state.daily.customQuestGrowth).toBe(0);
    expect(bondTotal(complete(state, 'c0', day(21)).state.bond)).toBe(before + REWARDS.questGrowth);
  });

  it('resets just past midnight while the app stays open', () => {
    let state = withCustomQuests(many(3), day(20, 23, 50));
    for (let i = 0; i < 3; i++) state = complete(state, `c${i}`, day(20, 23, 55)).state;
    const before = bondTotal(state.bond);
    state = complete(state, 'c0', day(21, 0, 5)).state;
    expect(bondTotal(state.bond)).toBe(before + REWARDS.questGrowth);
  });
});

describe('configurable limit', () => {
  it('uses the configured cap', () => {
    DAILY_LIMITS.customQuestGrowth = 10;
    let state = withCustomQuests(many(8));
    for (let i = 0; i < 8; i++) state = complete(state, `c${i}`).state;
    expect(bondTotal(state.bond)).toBe(40);
  });

  it('a cap of 0 disables custom quest growth but keeps energy', () => {
    DAILY_LIMITS.customQuestGrowth = 0;
    const { state } = complete(withCustomQuests([custom('a')]), 'a');
    expect(bondTotal(state.bond)).toBe(30);
    expect(state.energy).toBe(60);
  });

  it('lowering the cap mid-day never takes growth away', () => {
    let state = withCustomQuests(many(3));
    for (let i = 0; i < 2; i++) state = complete(state, `c${i}`).state;
    DAILY_LIMITS.customQuestGrowth = 2;
    const after = complete(state, 'c2').state;
    expect(bondTotal(after.bond)).toBe(bondTotal(state.bond));
  });
});

describe('migrating saves from before the cap', () => {
  const v4Save = (quests: Quest[], dailyDate = dayKey(day(20))) => {
    const state = withCustomQuests(quests);
    const { customQuestGrowth: _, ...daily } = state.daily;
    return { ...state, version: 4, lastLogin: dailyDate, daily: { ...daily, date: dailyDate } };
  };

  it('counts custom quest growth already earned today, clamped to the cap', () => {
    const done = many(3).map(q => ({ ...q, progress: 1, completed: true }));
    const state = reload(v4Save([...done, custom('more')]) as UserState, day(20, 15));
    expect(state.daily.customQuestGrowth).toBe(CAP);
    expect(bondTotal(complete(state, 'more', day(20, 15)).state.bond)).toBe(bondTotal(state.bond));
  });

  it('counts partial multi-step progress and medication bonuses', () => {
    const quests = [
      custom('steps', { target: 3, progress: 1 }), // 2/3
      custom('vit', { type: 'medication', target: 2, progress: 2, completed: true }), // 1 + 5, clamped
    ];
    expect(reload(v4Save([quests[0]]) as UserState, day(20, 15)).daily.customQuestGrowth).toBeCloseTo(2 / 3, 6);
    expect(reload(v4Save(quests) as UserState, day(20, 15)).daily.customQuestGrowth).toBe(CAP);
  });

  it('ignores built-in and non-daily quests', () => {
    const quests = [custom('once', { isDaily: false, progress: 1, completed: true })];
    const save = v4Save(quests);
    save.quests = save.quests.map(q => (q.isCustom ? q : { ...q, progress: q.target, completed: true }));
    expect(reload(save as UserState, day(20, 15)).daily.customQuestGrowth).toBe(0);
  });

  it('starts a fresh allowance when the save is from an earlier day', () => {
    const done = many(3).map(q => ({ ...q, progress: 1, completed: true }));
    const state = reload(v4Save(done, dayKey(day(19))) as UserState, day(20, 9));
    expect(state.daily.customQuestGrowth).toBe(0);
  });

  it('keeps growth, stage, and streak unchanged on upgrade', () => {
    const save = { ...v4Save([]), growthProgress: 55, stage: DragonStage.FLEDGLING, currentStreak: 3, bestStreak: 5 };
    const state = reload(save as unknown as UserState, day(20, 15));
    expect(bondTotal(state.bond)).toBe(55);
    expect(state.stage).toBe(DragonStage.FLEDGLING);
    expect(state.currentStreak).toBe(3);
    expect(state.bestStreak).toBe(5);
  });

  it('repairs a corrupt counter', () => {
    const save = withCustomQuests([]);
    const broken = { ...save, daily: { ...save.daily, customQuestGrowth: 'lots' } };
    expect(migrateState(JSON.parse(JSON.stringify(broken)), day(20)).daily.customQuestGrowth).toBe(0);
  });

  it('round-trips the counter through a v5 save', () => {
    const state = complete(withCustomQuests([custom('a')]), 'a').state;
    expect(migrateState(JSON.parse(JSON.stringify(state)), day(20, 12)).daily.customQuestGrowth).toBe(REWARDS.questGrowth);
  });
});
