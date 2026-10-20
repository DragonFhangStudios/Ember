import { describe, expect, it } from 'vitest';
import { DragonStage, Quest, UserState } from '../types';
import {
  DAILY_LIMITS,
  SAVE_VERSION,
  advanceQuest,
  completeFocusSession,
  createInitialState,
  creditMeaningfulActivity,
  dayKey,
  evaluateBadges,
  feedDragon,
  logCheckIn,
  migrateState,
  petDragon,
  rollOverDay,
} from './progression';
import { bondTotal } from './evolution';

const day = (d: number, hour = 10, minute = 0) => new Date(2026, 9, d, hour, minute);

function hatched(now = day(20)): UserState {
  return { ...createInitialState(now), bond: { local: 30 }, stage: DragonStage.HATCHLING };
}

/** One meaningful activity: completing the single-step Morning Routine quest. */
const completeQuest = (state: UserState, now: Date) => advanceQuest(state, 'q1', now);

/** Simulates a save + page refresh. */
const reload = (state: UserState, now: Date) => rollOverDay(migrateState(JSON.parse(JSON.stringify(state)), now), now);

describe('what counts as a meaningful activity', () => {
  it('completing any quest starts a streak', () => {
    const { state, message } = completeQuest(hatched(), day(20));
    expect(state.currentStreak).toBe(1);
    expect(state.bestStreak).toBe(1);
    expect(state.lastActiveDay).toBe(dayKey(day(20)));
    expect(message).toMatch(/Today counts/);
  });

  it('completing a custom quest counts', () => {
    const custom: Quest = {
      id: 'custom_1', title: 'Put one dish away', description: '', type: 'custom',
      completed: false, points: 10, isDaily: true, isCustom: true, progress: 0, target: 1,
    };
    const state = advanceQuest({ ...hatched(), quests: [...hatched().quests, custom] }, 'custom_1', day(20)).state;
    expect(state.currentStreak).toBe(1);
  });

  it('partial progress on a multi-step quest does not count until it is completed', () => {
    let state = hatched();
    for (let i = 0; i < 3; i++) state = advanceQuest(state, 'q5', day(20, 10 + i)).state;
    expect(state.currentStreak).toBe(0);
    expect(state.daily.meaningfulActivity).toBe(false);
    state = advanceQuest(state, 'q5', day(20, 14)).state;
    expect(state.currentStreak).toBe(1);
  });

  it('finishing a focus session counts', () => {
    expect(completeFocusSession(hatched(), day(20)).state.currentStreak).toBe(1);
  });

  it('a focus session past the daily reward cap still counts', () => {
    const capped = { ...hatched(), daily: { ...hatched().daily, focusRewards: DAILY_LIMITS.focusRewards } };
    const { state, message } = completeFocusSession(capped, day(20));
    expect(state.currentStreak).toBe(1);
    expect(message).toMatch(/Today counts/);
    expect(message).toMatch(/focus growth/);
  });

  it('logging a check-in counts', () => {
    expect(logCheckIn(hatched(), 3, 3, day(20)).state.currentStreak).toBe(1);
  });

  it('petting, feeding, and incubating are rewarding but do not count', () => {
    let state = hatched();
    state = petDragon(state, day(20)).state;
    state = feedDragon(state, day(20)).state;
    expect(bondTotal(state.bond)).toBeGreaterThan(30);
    expect(state.currentStreak).toBe(0);
    expect(state.daily.meaningfulActivity).toBe(false);

    let egg = createInitialState(day(20));
    egg = feedDragon(egg, day(20)).state; // incubate
    egg = petDragon(egg, day(20)).state;
    expect(egg.currentStreak).toBe(0);
  });
});

describe('one credit per day', () => {
  it('many activities on the same day increment the streak once', () => {
    let state: UserState = { ...hatched(), currentStreak: 4, bestStreak: 4, lastActiveDay: dayKey(day(19)) };
    state = completeQuest(state, day(20, 8)).state;
    state = completeFocusSession(state, day(20, 9)).state;
    state = completeFocusSession(state, day(20, 10)).state;
    state = logCheckIn(state, 3, 3, day(20, 11)).state;
    state = logCheckIn(state, 4, 4, day(20, 12)).state; // update
    for (const q of state.quests) state = advanceQuest(state, q.id, day(20, 13), q.target).state;
    expect(state.currentStreak).toBe(5);
    expect(state.bestStreak).toBe(5);
  });

  it('only the first activity of the day shows a streak message', () => {
    const first = completeQuest(hatched(), day(20, 8));
    const second = advanceQuest(first.state, 'q2', day(20, 9));
    expect(first.message).toBeDefined();
    expect(second.message).toBeUndefined();
  });

  it('a refresh after counting today does not count it again', () => {
    let state = completeQuest({ ...hatched(), currentStreak: 2, lastActiveDay: dayKey(day(19)) }, day(20, 9)).state;
    state = reload(state, day(20, 12));
    state = logCheckIn(state, 3, 3, day(20, 12)).state;
    expect(state.currentStreak).toBe(3);
  });

  it('rolling over without any activity never increments', () => {
    const state = rollOverDay({ ...hatched(), currentStreak: 2, lastActiveDay: dayKey(day(20)) }, day(21));
    expect(state.currentStreak).toBe(2);
  });
});

describe('consecutive days, missed days, and returning', () => {
  it('builds a streak over consecutive days and celebrates it', () => {
    let state = hatched();
    let message: string | undefined;
    for (const d of [20, 21, 22]) ({ state, message } = completeQuest(rollOverDay(state, day(d)), day(d)));
    expect(state.currentStreak).toBe(3);
    expect(message).toMatch(/3-day streak/);
  });

  it('keeps the streak visible on a day that has not counted yet', () => {
    let state = completeQuest(hatched(), day(20)).state;
    state = rollOverDay(state, day(21, 18));
    expect(state.currentStreak).toBe(1);
  });

  it('a missed day resets only the current streak, and welcomes the player back', () => {
    let state: UserState = { ...hatched(), currentStreak: 6, bestStreak: 9, lastActiveDay: dayKey(day(20)) };
    state = rollOverDay(state, day(22));
    expect(state.currentStreak).toBe(0);
    expect(state.bestStreak).toBe(9);

    const back = completeQuest(state, day(22));
    expect(back.state.currentStreak).toBe(1);
    expect(back.state.bestStreak).toBe(9);
    expect(back.message).toMatch(/Welcome back/);
  });

  it('starts fresh even if no rollover ran in between (e.g. the tab stayed open for days)', () => {
    const state = completeQuest({ ...hatched(), currentStreak: 6, lastActiveDay: dayKey(day(17)) }, day(20)).state;
    expect(state.currentStreak).toBe(1);
  });

  it('continues across midnight while the app stays open', () => {
    let state = completeQuest(hatched(day(20, 23, 50)), day(20, 23, 55)).state;
    state = logCheckIn(state, 3, 3, day(21, 0, 5)).state;
    expect(state.currentStreak).toBe(2);
  });

  it('keeps streak badges after the streak resets', () => {
    let state = hatched();
    for (const d of [20, 21, 22]) state = evaluateBadges(completeQuest(rollOverDay(state, day(d)), day(d)).state, day(d));
    expect(state.badges.find(b => b.id === 'badge_streak_3')?.unlockedAt).toBe(day(22).toISOString());
    state = evaluateBadges(rollOverDay(state, day(25)), day(25));
    expect(state.currentStreak).toBe(0);
    expect(state.badges.find(b => b.id === 'badge_streak_3')?.unlockedAt).toBe(day(22).toISOString());
  });
});

describe('clock and timezone edge cases', () => {
  it('counts consecutive calendar days across DST changes', () => {
    // US DST starts Mar 8 2026 and ends Nov 1 2026; EU on Mar 29 and Oct 25.
    for (const [y, m, d] of [[2026, 2, 7], [2026, 9, 31], [2026, 2, 28], [2026, 9, 24]]) {
      let state = completeQuest(hatched(new Date(y, m, d, 23)), new Date(y, m, d, 23, 30)).state;
      const next = new Date(y, m, d + 1, 0, 30);
      state = completeQuest(rollOverDay(state, next), next).state;
      expect(state.currentStreak).toBe(2);
    }
  });

  it('does not double count when the same calendar day comes around again (travel west)', () => {
    const state = completeQuest(hatched(), day(20, 22)).state;
    // Daily counters look like a different day, but the calendar day already counted.
    const replay = { ...state, daily: { ...state.daily, date: 'travel', meaningfulActivity: false } };
    expect(creditMeaningfulActivity(replay, day(20, 23)).state.currentStreak).toBe(1);
  });

  it('ignores activity when the clock moved back before the last active day', () => {
    const state = { ...hatched(), currentStreak: 3, lastActiveDay: dayKey(day(22)) };
    const result = creditMeaningfulActivity(state, day(20));
    expect(result.state.currentStreak).toBe(3);
    expect(result.state.lastActiveDay).toBe(dayKey(day(22)));
  });
});

describe('migrating saves from before meaningful-activity streaks', () => {
  const v3Save = (overrides: Partial<UserState>) => {
    const { lastActiveDay: _, ...save } = {
      ...hatched(),
      version: 3,
      currentStreak: 4,
      bestStreak: 6,
      ...overrides,
    } as UserState;
    const { meaningfulActivity: __, ...daily } = save.daily;
    return { ...save, daily };
  };

  it('preserves a live streak when nothing has happened yet on the last visit day', () => {
    let state = reload(v3Save({}) as UserState, day(20, 12));
    expect(state.currentStreak).toBe(4);
    expect(state.bestStreak).toBe(6);
    expect(state.lastActiveDay).toBe(dayKey(day(19)));
    state = completeQuest(state, day(20, 13)).state;
    expect(state.currentStreak).toBe(5);
  });

  it('credits activity already done on the last visit day exactly once', () => {
    const withQuestDone = v3Save({}).quests.map(q => (q.id === 'q1' ? { ...q, progress: 1, completed: true } : q));
    let state = reload(v3Save({ quests: withQuestDone }) as UserState, day(20, 12));
    expect(state.currentStreak).toBe(5);
    expect(state.daily.meaningfulActivity).toBe(true);
    state = logCheckIn(state, 3, 3, day(20, 13)).state;
    expect(state.currentStreak).toBe(5);
  });

  it('never lowers the streak the old rules would have given (all quests done, loaded next day)', () => {
    const allDone = v3Save({}).quests.map(q => ({ ...q, progress: q.target, completed: true }));
    const state = reload(v3Save({ quests: allDone }) as UserState, day(21));
    expect(state.currentStreak).toBe(5); // old rules: 4 + 1 at rollover
  });

  it('gives credit the old rules did not (one quest done, loaded next day)', () => {
    const oneDone = v3Save({}).quests.map(q => (q.id === 'q1' ? { ...q, progress: 1, completed: true } : q));
    const state = reload(v3Save({ quests: oneDone }) as UserState, day(21));
    expect(state.currentStreak).toBe(5); // old rules: reset to 0
  });

  it('resets an old streak after a missed day, keeping best streak and badges', () => {
    const badges = hatched().badges.map(b => (b.id === 'badge_streak_3' ? { ...b, unlockedAt: '2026-10-01' } : b));
    const state = evaluateBadges(reload(v3Save({ badges }) as UserState, day(23)), day(23));
    expect(state.currentStreak).toBe(0);
    expect(state.bestStreak).toBe(6);
    expect(state.badges.find(b => b.id === 'badge_streak_3')?.unlockedAt).toBe('2026-10-01');
  });

  it('upgrades a save with no streak at all', () => {
    const state = reload(v3Save({ currentStreak: 0, bestStreak: 0 }) as UserState, day(20, 12));
    expect(state.currentStreak).toBe(0);
    expect(state.lastActiveDay).toBeUndefined();
    expect(state.version).toBe(SAVE_VERSION);
  });

  it('round-trips the new fields through a save', () => {
    const state = completeQuest(hatched(), day(20)).state;
    const loaded = migrateState(JSON.parse(JSON.stringify(state)), day(20, 15));
    expect(loaded.lastActiveDay).toBe(dayKey(day(20)));
    expect(loaded.daily.meaningfulActivity).toBe(true);
    expect(loaded.currentStreak).toBe(1);
  });
});
