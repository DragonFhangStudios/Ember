import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import {
  DAILY_LIMITS,
  REWARDS,
  advanceQuest,
  completeFocusSession,
  createInitialState,
  customQuestAllowanceLeft,
  dayKey,
  daysBetween,
  evaluateBadges,
  feedDragon,
  logCheckIn,
  migrateState,
  petDragon,
  rollOverDay,
} from './progression';
import { bondTotal } from './evolution';

const day = (d: number, hour = 10, minute = 0) => new Date(2026, 9, d, hour, minute);

function hatched(growth = 30, now = day(20), stage = DragonStage.HATCHLING): UserState {
  return { ...createInitialState(now), bond: { local: growth }, stage };
}

const completeAllQuests = (state: UserState): UserState => ({
  ...state,
  quests: state.quests.map(q => ({ ...q, progress: q.target, completed: true })),
});

describe('rewards and Bond', () => {
  it('growth rewards add to Bond without a cap and never change the stage', () => {
    let state: UserState = { ...createInitialState(day(20)), bond: { local: 19 } };
    state = petDragon(state, day(20)).state;
    expect(bondTotal(state.bond)).toBe(21);
    expect(state.stage).toBe(DragonStage.EGG);

    state = petDragon({ ...state, bond: { local: 99.5 } }, day(21)).state;
    expect(bondTotal(state.bond)).toBe(101.5);
    expect(state.stage).toBe(DragonStage.EGG);
  });
});

describe('missed days never take Bond or stage away', () => {
  it.each([1, 2, 7, 60])('keeps Bond and stage after %i day(s) away', daysAway => {
    const before = hatched(70, day(20), DragonStage.DRAKE);
    const after = rollOverDay(before, day(20 + daysAway));
    expect(bondTotal(after.bond)).toBe(70);
    expect(after.stage).toBe(DragonStage.DRAKE);
  });

  it('keeps Bond and stage even when yesterday’s rituals and quests were skipped', () => {
    const after = rollOverDay(hatched(45, day(20), DragonStage.FLEDGLING), day(21));
    expect(bondTotal(after.bond)).toBe(45);
    expect(after.stage).toBe(DragonStage.FLEDGLING);
  });

  it('keeps scales, inventory, badges and best streak', () => {
    const before: UserState = {
      ...hatched(50),
      goldenScales: 120,
      inventory: ['hat_wizard'],
      bestStreak: 9,
      currentStreak: 4,
      badges: createInitialState(day(20)).badges.map(b => ({ ...b, unlockedAt: '2026-10-01T00:00:00.000Z' })),
    };
    const after = rollOverDay(before, day(25));
    expect(after.goldenScales).toBe(120);
    expect(after.inventory).toEqual(['hat_wizard']);
    expect(after.bestStreak).toBe(9);
    expect(after.badges.every(b => b.unlockedAt)).toBe(true);
  });
});

describe('daily rollover', () => {
  it('is a no-op on the same day', () => {
    const state = hatched(30);
    expect(rollOverDay(state, day(20, 23, 59))).toBe(state);
  });

  it('resets daily quests and reward limits on a new day', () => {
    let state = completeAllQuests(hatched(30));
    state = feedDragon(state, day(20)).state;
    state = rollOverDay(state, day(21));
    expect(state.quests.every(q => !q.completed && q.progress === 0)).toBe(true);
    expect(state.daily).toEqual({
      date: dayKey(day(21)),
      feeds: 0,
      focusRewards: 0,
      checkInRewarded: false,
      meaningfulActivity: false,
      customQuestGrowth: 0,
      customQuestEnergy: 0,
      questRewards: {},
      autoCompletedQuests: [],
    });
  });

  it('keeps the streak alive over a rollover when yesterday counted', () => {
    const state = rollOverDay({ ...hatched(), currentStreak: 2, bestStreak: 2, lastActiveDay: dayKey(day(20)) }, day(21));
    expect(state.currentStreak).toBe(2);
    expect(state.bestStreak).toBe(2);
  });

  it('resets only the current streak after a missed day', () => {
    const state = rollOverDay(
      { ...completeAllQuests(hatched()), currentStreak: 5, bestStreak: 5, lastActiveDay: dayKey(day(20)) },
      day(22),
    );
    expect(state.currentStreak).toBe(0);
    expect(state.bestStreak).toBe(5);
  });

  it('lets Ember nap after inactivity, and wakes on the next interaction', () => {
    expect(rollOverDay(hatched(), day(21)).isNapping).toBe(false);
    const napping = rollOverDay(hatched(), day(23));
    expect(napping.isNapping).toBe(true);
    expect(petDragon(napping, day(23)).state.isNapping).toBe(false);
  });

  it('rolls over just past midnight while the app stays open', () => {
    let state = feedDragon(hatched(30, day(20, 23, 50)), day(20, 23, 50)).state;
    state = feedDragon(state, day(21, 0, 1)).state;
    expect(state.lastLogin).toBe(dayKey(day(21)));
    expect(state.daily.feeds).toBe(1);
  });

  it('ignores a clock that moved backwards', () => {
    const state = hatched(30, day(20));
    expect(rollOverDay(state, day(19))).toBe(state);
  });

  it('counts calendar days across a DST change', () => {
    expect(daysBetween(dayKey(new Date(2026, 2, 7)), new Date(2026, 2, 9, 1))).toBe(2);
    expect(daysBetween(dayKey(new Date(2026, 10, 1)), new Date(2026, 10, 2, 23))).toBe(1);
  });
});

describe('daily reward limits', () => {
  it('allows petting once per day', () => {
    const first = petDragon(hatched(30), day(20)).state;
    const second = petDragon(first, day(20, 18));
    expect(second.state.petCount).toBe(1);
    expect(bondTotal(second.state.bond)).toBe(30 + REWARDS.pet.growth);
    expect(second.message).toBeDefined();
    expect(petDragon(second.state, day(21)).state.petCount).toBe(2);
  });

  it('allows incubating the egg once per day', () => {
    let state = createInitialState(day(20));
    state = feedDragon(state, day(20)).state;
    state = feedDragon(state, day(20, 12)).state;
    expect(bondTotal(state.bond)).toBe(REWARDS.incubate.growth);
    expect(bondTotal(feedDragon(state, day(21)).state.bond)).toBe(2 * REWARDS.incubate.growth);
  });

  it(`caps feeding a hatched dragon at ${DAILY_LIMITS.feeds} per day`, () => {
    let state = hatched(30);
    for (let i = 0; i < 10; i++) state = feedDragon(state, day(20, 12, i)).state;
    expect(state.daily.feeds).toBe(DAILY_LIMITS.feeds);
    expect(state.energy).toBe(50 + DAILY_LIMITS.feeds * REWARDS.feed.energy);
    expect(bondTotal(state.bond)).toBe(30 + DAILY_LIMITS.feeds * REWARDS.feed.growth);
  });

  it(`keeps focus repeatable but caps its rewards at ${DAILY_LIMITS.focusRewards} per day`, () => {
    let state = hatched(30);
    let lastMessage: string | undefined;
    for (let i = 0; i < 6; i++) {
      const result = completeFocusSession(state, day(20, 12, i));
      state = result.state;
      lastMessage = result.message;
    }
    expect(state.daily.focusRewards).toBe(DAILY_LIMITS.focusRewards);
    expect(bondTotal(state.bond)).toBe(30 + DAILY_LIMITS.focusRewards * REWARDS.focus.growth);
    expect(state.energy).toBe(50 + DAILY_LIMITS.focusRewards * REWARDS.focus.energy);
    expect(state.quests.find(q => q.type === 'focus')?.completed).toBe(true);
    expect(lastMessage).toMatch(/focus Bond/);

    state = completeFocusSession(state, day(21)).state;
    expect(state.daily.focusRewards).toBe(1);
  });

  it('rewards one check-in per day and updates the log on repeats', () => {
    let state = logCheckIn(hatched(30), 2, 2, day(20, 9)).state;
    const repeat = logCheckIn(state, 4, 5, day(20, 20));
    state = repeat.state;
    expect(state.symptomLogs).toHaveLength(1);
    expect(state.symptomLogs[0]).toMatchObject({ energy: 4, mood: 5 });
    expect(bondTotal(state.bond)).toBe(30 + REWARDS.checkIn.growth);
    expect(repeat.message).toMatch(/Updated/);

    state = logCheckIn(state, 3, 3, day(21)).state;
    expect(state.symptomLogs).toHaveLength(2);
    expect(bondTotal(state.bond)).toBe(30 + 2 * REWARDS.checkIn.growth);
  });

  it("a clock that moves backwards across midnight (and forward again) never refills today's allowances", () => {
    // Alpha feedback: flying west, or setting the clock back, made the counters look like a new day.
    const late = day(21, 0, 30);
    const earlier = day(20, 23, 30); // the previous calendar day, an hour earlier
    let state = hatched(30, late);
    let n = 0;
    const completeNewCustomQuest = (at: Date) => {
      const id = `custom_clock_${++n}`;
      state = { ...state, quests: [...state.quests, { id, title: id, description: '', type: 'custom', completed: false, points: 10, isDaily: true, isCustom: true, progress: 0, target: 1 }] };
      state = advanceQuest(state, id, at).state;
    };
    const everyLimit = (at: Date) => {
      for (let i = 0; i < 6; i++) completeNewCustomQuest(at);
      for (let i = 0; i < 5; i++) state = feedDragon(state, at).state;
      for (let i = 0; i < 5; i++) state = completeFocusSession(state, at).state;
      state = logCheckIn(state, 3, 3, at).state;
    };
    everyLimit(late);
    const used = { energy: state.energy, bond: bondTotal(state.bond) };
    expect(state.daily).toMatchObject({ customQuestEnergy: DAILY_LIMITS.customQuestEnergy, customQuestGrowth: DAILY_LIMITS.customQuestGrowth, feeds: DAILY_LIMITS.feeds, focusRewards: DAILY_LIMITS.focusRewards, checkInRewarded: true });

    everyLimit(earlier); // clock moved back to the previous day
    everyLimit(day(21, 1)); // and forward again, still the same real day
    expect({ energy: state.energy, bond: bondTotal(state.bond) }, 'nothing more was earned').toEqual(used);
    expect(state.lastLogin).toBe(dayKey(late));
    expect(state.daily.date).toBe(dayKey(late));

    // The real next day still brings fresh allowances.
    completeNewCustomQuest(day(22));
    expect(state.daily).toMatchObject({ date: dayKey(day(22)), customQuestEnergy: 10 });
  });

  it('reports what custom quests can still earn today, never below zero, fresh each new day', () => {
    let state = hatched(30, day(20));
    expect(customQuestAllowanceLeft(state, day(20))).toEqual({ energy: DAILY_LIMITS.customQuestEnergy, bond: DAILY_LIMITS.customQuestGrowth });
    state = { ...state, quests: [...state.quests, { id: 'c1', title: 'c1', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress: 0, target: 3 }] };
    state = advanceQuest(state, 'c1', day(20)).state;
    expect(customQuestAllowanceLeft(state, day(20)).energy).toBe(30);
    expect(customQuestAllowanceLeft(state, day(20)).bond).toBeCloseTo(4 - 2 / 3, 5);
    state = advanceQuest(state, 'c1', day(20), 2).state;
    expect(customQuestAllowanceLeft(state, day(20)).energy).toBe(10);
    state = { ...state, daily: { ...state.daily, customQuestEnergy: 55, customQuestGrowth: 9 } }; // over the limit (an older save)
    expect(customQuestAllowanceLeft(state, day(20))).toEqual({ energy: 0, bond: 0 });
    expect(customQuestAllowanceLeft(state, day(21))).toEqual({ energy: DAILY_LIMITS.customQuestEnergy, bond: DAILY_LIMITS.customQuestGrowth });
  });

  it('limits survive a save/load round-trip (refresh)', () => {
    let state = hatched(30);
    for (let i = 0; i < DAILY_LIMITS.feeds; i++) state = feedDragon(state, day(20, 12, i)).state;
    state = logCheckIn(state, 3, 3, day(20)).state;
    const reloaded = migrateState(JSON.parse(JSON.stringify(state)), day(20, 13));
    const fed = feedDragon(reloaded, day(20, 13)).state;
    expect(bondTotal(fed.bond)).toBe(bondTotal(reloaded.bond));
    expect(bondTotal(logCheckIn(reloaded, 1, 1, day(20, 13)).state.bond)).toBe(bondTotal(reloaded.bond));
  });
});

describe('quests', () => {
  it('rewards multi-step quests per step and cannot be over-completed', () => {
    let state = hatched(30);
    for (let i = 0; i < 6; i++) state = advanceQuest(state, 'q5', day(20)).state;
    const quest = state.quests.find(q => q.id === 'q5')!;
    expect(quest.progress).toBe(4);
    expect(quest.completed).toBe(true);
    expect(bondTotal(state.bond)).toBeCloseTo(30 + REWARDS.questGrowth);
    expect(state.energy).toBe(50 + quest.points);
  });

  it('pays golden scales for the medication quest once', () => {
    let state = advanceQuest(hatched(30), 'q2', day(20)).state;
    state = advanceQuest(state, 'q2', day(20)).state;
    expect(state.goldenScales).toBe(REWARDS.medication.scales);
  });
});

describe('migration from older saves', () => {
  it('starts fresh on missing or corrupt data', () => {
    expect(migrateState(null, day(20)).stage).toBe(DragonStage.EGG);
    expect(bondTotal(migrateState('garbage', day(20)).bond)).toBe(0);
  });

  it('upgrades a v2 save, preserving progress and filling new fields', () => {
    const v2 = {
      dragonName: 'Ember',
      stage: 'Fledgling',
      energy: 210,
      goldenScales: 40,
      growthProgress: 12, // stage was higher than growth suggested
      lastLogin: dayKey(day(20)),
      isNapping: false,
      quests: [{ id: 'q4', title: 'Check-in', description: '', type: 'symptom', completed: true, points: 5, isDaily: true }],
      symptomLogs: [{ date: day(20).toISOString(), energy: 3, mood: 4 }],
      inventory: ['scarf_red'],
      equipped: { scarf: 'scarf_red' },
      badges: [{ id: 'badge_hatch', name: 'First Hatch', description: '', icon: '', unlockedAt: '2026-10-01' }],
      petCount: 7,
    };
    const state = migrateState(v2, day(20, 15));
    expect(bondTotal(state.bond)).toBe(41);
    expect(state.stage).toBe(DragonStage.FLEDGLING);
    expect(state.goldenScales).toBe(40);
    expect(state.inventory).toEqual(['scarf_red']);
    expect(state.customQuestTypes).toEqual([]);
    // The save's last day included a check-in, which now counts toward a streak.
    expect(state.currentStreak).toBe(1);
    expect(state.lastActiveDay).toBe(dayKey(day(20)));
    expect(state.quests[0]).toMatchObject({ target: 1, progress: 1 });
    expect(state.badges.find(b => b.id === 'badge_hatch')?.unlockedAt).toBe('2026-10-01');
    expect(state.badges.length).toBeGreaterThan(1);
    // Today's check-in was already done before the upgrade, so no second reward.
    expect(bondTotal(logCheckIn(state, 5, 5, day(20, 16)).state.bond)).toBe(41);
  });

  it('keeps growth on a save whose stage was reset to Egg by the old daily softlock', () => {
    const old = { ...createInitialState(day(20)), version: 3, growthProgress: 55, stage: 'Egg', daily: undefined };
    const state = migrateState(old, day(20));
    expect(state.stage).toBe(DragonStage.FLEDGLING);
  });
});

describe('badges', () => {
  it('unlocks once and keeps the original unlock time', () => {
    const first = evaluateBadges(hatched(30), day(20));
    const hatchBadge = first.badges.find(b => b.id === 'badge_hatch')!;
    expect(hatchBadge.unlockedAt).toBe(day(20).toISOString());
    const later = evaluateBadges(first, day(25));
    expect(later).toBe(first);
  });

  it('keeps streak badges after the streak resets', () => {
    const state = evaluateBadges(rollOverDay({ ...hatched(), currentStreak: 3, bestStreak: 3 }, day(23)), day(23));
    expect(state.currentStreak).toBe(0);
    expect(state.badges.find(b => b.id === 'badge_streak_3')?.unlockedAt).toBeDefined();
  });
});
