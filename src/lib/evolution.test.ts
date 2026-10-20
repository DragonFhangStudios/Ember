import { afterEach, describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import {
  BOND_LEVELS,
  EVOLUTION_THRESHOLDS,
  LEGACY_BOND_KEY,
  addActiveDay,
  bondLevel,
  bondTotal,
  emptyActivity,
  isoDay,
  lifetimeActiveDays,
  mergeActivity,
  mergeBond,
  stageForActiveDays,
} from './evolution';
import {
  activeDaysOf,
  advanceQuest,
  completeFocusSession,
  createInitialState,
  dayKey,
  evaluateBadges,
  feedDragon,
  logCheckIn,
  migrateState,
  petDragon,
  rollOverDay,
} from './progression';

// Day n of a long run starting Oct 1 2026, at the given local hour.
const at = (n: number, hour = 10, minute = 0) => new Date(2026, 9, n, hour, minute);
const reload = (state: UserState, now: Date) => rollOverDay(migrateState(JSON.parse(JSON.stringify(state)), now), now);

/** One meaningful activity on the given date. */
const checkIn = (state: UserState, now: Date) => logCheckIn(rollOverDay(state, now), 3, 3, now).state;

/** Everything a very dedicated player could do in a day. */
function maxDay(state: UserState, now: Date): UserState {
  let s = rollOverDay(state, now);
  for (const q of s.quests) s = advanceQuest(s, q.id, now, q.target).state;
  for (let i = 0; i < 5; i++) s = completeFocusSession(s, now).state;
  s = logCheckIn(s, 4, 4, now).state;
  s = petDragon(s, now).state;
  for (let i = 0; i < 5; i++) s = feedDragon(s, now).state;
  return s;
}

/** Simulates n active days in a row, returning the active-day count at which each stage was reached. */
function stageDays(play: (s: UserState, now: Date) => UserState, n: number) {
  let state = createInitialState(at(1));
  const reached: Partial<Record<DragonStage, number>> = {};
  for (let d = 1; d <= n; d++) {
    state = play(state, new Date(2026, 9, d, 10));
    reached[state.stage] ??= activeDaysOf(state);
  }
  return { reached, state };
}

/** A pre-v6 save as older versions stored it. */
function legacySave(overrides: Record<string, unknown> = {}) {
  const { bond: _b, activity: _a, ...rest } = createInitialState(at(20));
  return { ...rest, version: 5, growthProgress: 0, ...overrides } as unknown as UserState;
}

afterEach(() => {
  BOND_LEVELS.firstLevel = 20;
  BOND_LEVELS.increase = 5;
});

describe('evolution thresholds', () => {
  it('uses 2 / 8 / 24 / 50 cumulative active days', () => {
    expect(EVOLUTION_THRESHOLDS.map(([s, d]) => [s, d])).toEqual([
      [DragonStage.ANCIENT, 50], [DragonStage.DRAKE, 24], [DragonStage.FLEDGLING, 8], [DragonStage.HATCHLING, 2], [DragonStage.EGG, 0],
    ]);
    expect([0, 1, 2, 7, 8, 23, 24, 49, 50, 500].map(stageForActiveDays)).toEqual([
      'Egg', 'Egg', 'Hatchling', 'Hatchling', 'Fledgling', 'Fledgling', 'Drake', 'Drake', 'Ancient', 'Ancient',
    ]);
  });

  it('a max-activity and a minimum-activity player evolve on exactly the same active day', () => {
    const max = stageDays(maxDay, 52);
    const min = stageDays(checkIn, 52);
    const expected = { Egg: 1, Hatchling: 2, Fledgling: 8, Drake: 24, Ancient: 50 };
    expect(max.reached).toEqual(expected);
    expect(min.reached).toEqual(expected);
    // Extra care still matters: it builds far more Bond.
    expect(bondTotal(max.state.bond)).toBeGreaterThan(5 * bondTotal(min.state.bond));
  });
});

describe('counting active days', () => {
  it('many activities on one day count once', () => {
    const state = maxDay(createInitialState(at(1)), at(1));
    expect(activeDaysOf(state)).toBe(1);
    expect(state.activity.days).toEqual([isoDay(at(1))]);
  });

  it('petting and feeding alone are not active days', () => {
    let state = createInitialState(at(1));
    for (let d = 1; d <= 5; d++) state = feedDragon(petDragon(rollOverDay(state, at(d)), at(d)).state, at(d)).state;
    expect(activeDaysOf(state)).toBe(0);
    expect(state.stage).toBe(DragonStage.EGG);
  });

  it('missed days pause progress and never reverse it (days need not be consecutive)', () => {
    let state = createInitialState(at(1));
    for (const d of [1, 4, 9, 20, 21, 30, 60, 61]) state = checkIn(state, at(d));
    expect(activeDaysOf(state)).toBe(8);
    expect(state.stage).toBe(DragonStage.FLEDGLING);
    state = rollOverDay(state, at(90));
    expect(activeDaysOf(state)).toBe(8);
    expect(state.stage).toBe(DragonStage.FLEDGLING);
  });

  it('shows an evolution message on the day Ember grows', () => {
    let state = checkIn(createInitialState(at(1)), at(1));
    const result = logCheckIn(rollOverDay(state, at(2)), 3, 3, at(2));
    state = result.state;
    expect(state.stage).toBe(DragonStage.HATCHLING);
    expect(result.message).toMatch(/grew into a Hatchling/);
  });

  it('a refresh does not count today again', () => {
    let state = checkIn(createInitialState(at(1)), at(1, 9));
    state = reload(state, at(1, 15));
    state = advanceQuest(state, 'q1', at(1, 15)).state;
    expect(activeDaysOf(state)).toBe(1);
  });
});

describe('date and time edge cases', () => {
  it('records the local calendar date, even late at night', () => {
    const state = checkIn(createInitialState(at(1, 23, 59)), at(1, 23, 59));
    expect(state.activity.days).toEqual(['2026-10-01']);
  });

  it('counts two days across midnight while the app stays open', () => {
    let state = checkIn(createInitialState(at(1, 23, 50)), at(1, 23, 55));
    state = advanceQuest(state, 'q1', at(2, 0, 5)).state;
    expect(state.activity.days).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('counts consecutive days across DST changes (US and EU)', () => {
    for (const [m, d] of [[2, 7], [9, 31], [2, 28], [9, 24]]) {
      let state = checkIn(createInitialState(new Date(2026, m, d, 23)), new Date(2026, m, d, 23, 30));
      state = checkIn(state, new Date(2026, m, d + 1, 0, 30));
      expect(activeDaysOf(state)).toBe(2);
    }
  });

  it('the same calendar date reached twice (travel) counts once', () => {
    const state = checkIn(createInitialState(at(1)), at(1, 9));
    const replay = { ...state, daily: { ...state.daily, date: 'elsewhere', meaningfulActivity: false } };
    expect(activeDaysOf(logCheckIn(replay, 3, 3, at(1, 22)).state)).toBe(1);
  });

  it('a clock moved backwards does not add days', () => {
    const state = checkIn(checkIn(createInitialState(at(1)), at(1)), at(2));
    const back = { ...state, daily: { ...state.daily, date: 'past', meaningfulActivity: false } };
    expect(activeDaysOf(logCheckIn(back, 3, 3, new Date(2026, 8, 20)).state)).toBe(2);
  });

  it('crosses year boundaries in chronological order', () => {
    let log = addActiveDay(emptyActivity(), '2026-12-31');
    log = addActiveDay(log, '2027-01-01');
    log = addActiveDay(log, '2026-02-01');
    expect(log.days).toEqual(['2026-02-01', '2026-12-31', '2027-01-01']);
  });
});

describe('Bond', () => {
  it('is uncapped and never accelerates evolution', () => {
    const state = { ...createInitialState(at(1)), bond: { local: 5000 } };
    const after = checkIn(state, at(1));
    expect(bondTotal(after.bond)).toBeGreaterThan(5000);
    expect(after.stage).toBe(DragonStage.EGG);
  });

  it('levels continue beyond Ancient', () => {
    const { state } = stageDays(maxDay, 50);
    expect(state.stage).toBe(DragonStage.ANCIENT);
    const before = bondLevel(bondTotal(state.bond)).level;
    let later = state;
    for (let d = 51; d <= 70; d++) later = maxDay(later, new Date(2026, 9, d, 10));
    expect(bondLevel(bondTotal(later.bond)).level).toBeGreaterThan(before);
  });

  it('uses configurable level requirements', () => {
    expect(bondLevel(0)).toEqual({ level: 1, intoLevel: 0, toNext: 20 });
    expect(bondLevel(20)).toEqual({ level: 2, intoLevel: 0, toNext: 25 });
    expect(bondLevel(50)).toEqual({ level: 3, intoLevel: 5, toNext: 30 });
    BOND_LEVELS.firstLevel = 10;
    BOND_LEVELS.increase = 0;
    expect(bondLevel(55).level).toBe(6);
  });

  it('a zero or negative cost configuration cannot loop forever', () => {
    BOND_LEVELS.firstLevel = 0;
    BOND_LEVELS.increase = -5;
    expect(bondLevel(10).level).toBe(11);
  });

  it('leveling up grants no currency', () => {
    const { state } = stageDays(maxDay, 30);
    const scalesFromQuests = 30 * 10; // built-in Daily Vitality, once per day
    expect(state.goldenScales).toBe(scalesFromQuests);
  });

  it('existing daily reward-source limits still bound Bond gained per day', () => {
    const one = maxDay(createInitialState(at(1)), at(1));
    let twice = maxDay(one, at(1, 12));
    twice = maxDay(twice, at(1, 18));
    expect(bondTotal(twice.bond)).toBe(bondTotal(one.bond));
  });
});

describe('lifetime milestone badges', () => {
  it.each([[100, 'badge_days_100'], [200, 'badge_days_200'], [365, 'badge_days_365']])('unlocks at %i active days', (n, id) => {
    const days = Array.from({ length: n }, (_, i) => isoDay(new Date(2025, 0, 1 + i)));
    const below = evaluateBadges({ ...createInitialState(at(1)), activity: { days: days.slice(1), legacy: [] } }, at(1));
    const reached = evaluateBadges({ ...createInitialState(at(1)), activity: { days, legacy: [] } }, at(1));
    expect(below.badges.find(b => b.id === id)?.unlockedAt).toBeUndefined();
    expect(reached.badges.find(b => b.id === id)?.unlockedAt).toBeDefined();
  });
});

describe('migrating saves from before active days (v5 → v6)', () => {
  it.each([
    ['Egg', 5, DragonStage.EGG],
    ['Hatchling', 30, DragonStage.HATCHLING],
    ['Fledgling', 50, DragonStage.FLEDGLING],
    ['Drake', 80, DragonStage.DRAKE],
    ['Ancient', 100, DragonStage.ANCIENT],
  ] as const)('keeps a %s at its stage, and its growth as Bond', (stage, growth, expected) => {
    const state = reload(legacySave({ stage, growthProgress: growth }), at(20, 12));
    expect(state.stage).toBe(expected);
    expect(state.bond).toEqual({ [LEGACY_BOND_KEY]: growth });
    expect(activeDaysOf(state)).toBeGreaterThanOrEqual(EVOLUTION_THRESHOLDS.find(([s]) => s === expected)![1]);
  });

  it('keeps the old softlock repair: a reset-to-Egg save keeps the stage its growth earned', () => {
    const state = reload(legacySave({ stage: 'Egg', growthProgress: 70 }), at(20));
    expect(state.stage).toBe(DragonStage.DRAKE);
  });

  it('seeds real dates from check-ins and the last active day, with a credit that tops up to the stage', () => {
    const save = legacySave({
      stage: 'Fledgling', growthProgress: 50,
      symptomLogs: [
        { date: at(3, 9).toISOString(), energy: 3, mood: 3 },
        { date: at(3, 20).toISOString(), energy: 3, mood: 3 },
        { date: at(7).toISOString(), energy: 3, mood: 3 },
      ],
      lastActiveDay: dayKey(at(19)),
    });
    const state = reload(save, at(20, 12));
    expect(state.activity.days).toEqual(['2026-10-03', '2026-10-07', '2026-10-19']);
    expect(state.activity.legacy).toEqual([{ floor: 8, before: '2026-10-20' }]);
    expect(activeDaysOf(state)).toBe(8);
  });

  it('never creates a negative or unneeded credit', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ date: at(1 + i).toISOString(), energy: 3, mood: 3 }));
    const state = reload(legacySave({ stage: 'Hatchling', growthProgress: 25, symptomLogs: many }), at(20, 12));
    expect(activeDaysOf(state)).toBe(12);
    expect(state.stage).toBe(DragonStage.FLEDGLING); // real history already earned more
    expect(state.activity.legacy.every(c => c.floor >= 0)).toBe(true);
    expect(reload(legacySave({ stage: 'Egg' }), at(20)).activity.legacy).toEqual([]);
  });

  it('an activity already done on the upgrade day still counts on top of the credit', () => {
    const state = reload(legacySave({ stage: 'Drake', growthProgress: 80, lastActiveDay: dayKey(at(20)) }), at(20, 15));
    expect(activeDaysOf(state)).toBe(25);
  });

  it('progress continues normally after migrating', () => {
    let state = reload(legacySave({ stage: 'Drake', growthProgress: 80 }), at(1, 8));
    for (let d = 1; d <= 26; d++) state = checkIn(state, at(d));
    expect(activeDaysOf(state)).toBe(50);
    expect(state.stage).toBe(DragonStage.ANCIENT);
    expect(bondTotal(state.bond)).toBeGreaterThan(80);
  });

  it('keeps scales, items, badges, and streaks', () => {
    const badges = createInitialState(at(20)).badges.map(b => (b.id === 'badge_hatch' ? { ...b, unlockedAt: '2026-09-01' } : b));
    const state = reload(legacySave({
      stage: 'Hatchling', growthProgress: 30, goldenScales: 77, inventory: ['hat_wizard'],
      badges, currentStreak: 2, bestStreak: 9, lastActiveDay: dayKey(at(19)),
    }), at(20, 12));
    expect(state.goldenScales).toBe(77);
    expect(state.inventory).toEqual(['hat_wizard']);
    expect(state.badges.find(b => b.id === 'badge_hatch')?.unlockedAt).toBe('2026-09-01');
    expect(state.currentStreak).toBe(2);
    expect(state.bestStreak).toBe(9);
  });

  it('round-trips a v6 save and repairs corrupt fields without lowering the stage', () => {
    const state = checkIn(checkIn(createInitialState(at(1)), at(1)), at(2));
    expect(reload(state, at(2, 18)).activity).toEqual(state.activity);
    const broken = { ...state, activity: { days: ['nope', 7, '2026-10-01'], legacy: [{ floor: -3, before: 'x' }] }, bond: { a: 'lots', b: 4 } };
    const repaired = migrateState(JSON.parse(JSON.stringify(broken)), at(2, 18));
    expect(repaired.activity).toEqual({ days: ['2026-10-01'], legacy: [] });
    expect(repaired.bond).toEqual({ b: 4 });
    expect(repaired.stage).toBe(DragonStage.HATCHLING);
  });

  it('never trusts a device id stored in a save', () => {
    const state = { ...createInitialState(at(1)), deviceId: 'phone' };
    expect(migrateState(JSON.parse(JSON.stringify(state)), at(1)).deviceId).toBeUndefined();
  });
});

describe('multi-device merge (future sync)', () => {
  it('merging active days is a union: overlapping days count once', () => {
    let phone = emptyActivity();
    let desktop = emptyActivity();
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) phone = addActiveDay(phone, d);
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) desktop = addActiveDay(desktop, d);
    const merged = mergeActivity(phone, desktop);
    expect(lifetimeActiveDays(merged)).toBe(4);
    expect(mergeActivity(merged, merged)).toEqual(merged);
    expect(mergeActivity(desktop, phone)).toEqual(merged);
  });

  it('two copies of an older save, migrated at different times with overlapping dates and different credits, do not inflate', () => {
    const old = legacySave({
      stage: 'Drake', growthProgress: 80,
      symptomLogs: [{ date: at(3).toISOString(), energy: 3, mood: 3 }, { date: at(9).toISOString(), energy: 3, mood: 3 }],
    });
    // Copy A migrates on Oct 20. Copy B keeps an extra check-in (Oct 15) and migrates on Oct 22.
    const a = reload(old, at(20));
    const bSave = { ...old, symptomLogs: [...(old.symptomLogs ?? []), { date: at(15).toISOString(), energy: 3, mood: 3 }] };
    const b = reload(bSave, at(22));
    expect(a.activity.legacy).toEqual([{ floor: 24, before: '2026-10-20' }]);
    expect(b.activity.legacy).toEqual([{ floor: 24, before: '2026-10-22' }]);
    expect(activeDaysOf(a)).toBe(24);
    expect(activeDaysOf(b)).toBe(24);

    const merged = mergeActivity(a.activity, b.activity);
    expect(lifetimeActiveDays(merged)).toBe(24);
    // A naive top-up credit (24 minus each copy's seeded days: A=22, B=21)
    // merged as "union + largest credit" would give 3 days + 22 = 25.
    const naive = merged.days.length + Math.max(24 - a.activity.days.length, 24 - b.activity.days.length);
    expect(naive).toBe(25);
  });

  it('days played on each copy after migrating add up without double counting', () => {
    const old = legacySave({ stage: 'Fledgling', growthProgress: 50 });
    let a = reload(old, at(20));
    let b = reload(old, at(21));
    for (const d of [20, 21, 22]) a = checkIn(a, at(d)); // phone
    for (const d of [22, 23]) b = checkIn(b, at(d)); // desktop (overlaps on the 22nd)
    expect(lifetimeActiveDays(mergeActivity(a.activity, b.activity))).toBe(8 + 4);
  });

  it('Bond earned independently on two offline devices is all kept', () => {
    const old = legacySave({ stage: 'Hatchling', growthProgress: 30 });
    let phone: UserState = { ...reload(old, at(20)), deviceId: 'phone' };
    let desktop: UserState = { ...reload(old, at(20)), deviceId: 'desktop' };
    phone = petDragon(phone, at(20)).state; // +2
    desktop = logCheckIn(desktop, 3, 3, at(20)).state; // +1
    desktop = advanceQuest(desktop, 'q1', at(20)).state; // +2
    const merged = mergeBond(phone.bond, desktop.bond);
    expect(merged).toEqual({ [LEGACY_BOND_KEY]: 30, phone: 2, desktop: 3 });
    expect(bondTotal(merged)).toBe(35); // max() of totals would have lost 2
  });

  it('merging a stale copy of the same device never double counts', () => {
    const early = { legacy: 30, phone: 4 };
    const later = { legacy: 30, phone: 9 };
    expect(mergeBond(early, later)).toEqual(later);
    expect(mergeBond(later, later)).toEqual(later);
    expect(mergeBond(later, early)).toEqual(later);
  });
});
