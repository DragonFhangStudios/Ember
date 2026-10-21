import { describe, expect, it } from 'vitest';
import { DragonStage, Quest, UserState } from '../types';
import { bondTotal } from './evolution';
import {
  advanceQuest,
  canCorrectQuest,
  completeFocusSession,
  correctQuest,
  createInitialState,
  dayKey,
  evaluateBadges,
  logCheckIn,
  rollOverDay,
} from './progression';

// Correcting a mistaken quest tap (#19): only the displayed progress changes.
// Nothing earned is ever taken back, and a corrected step pays nothing when
// it's done again the same day.

const day = (d: number, hour = 10, minute = 0, second = 0) => new Date(2026, 9, d, hour, minute, second);
const NOW = day(20);

const custom = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, title: id, description: '', type: 'custom', completed: false,
  points: 10, isDaily: true, isCustom: true, progress: 0, target: 1, ...overrides,
});

function player(quests: Quest[] = [], now = NOW): UserState {
  const base = createInitialState(now);
  return { ...base, stage: DragonStage.HATCHLING, bond: { local: 30 }, quests: [...base.quests, ...quests] };
}

/** Everything a player has earned (what a correction must never change). */
const earned = (s: UserState) => ({
  energy: s.energy,
  scales: s.goldenScales,
  bond: bondTotal(s.bond),
  stage: s.stage,
  currentStreak: s.currentStreak,
  bestStreak: s.bestStreak,
  lastActiveDay: s.lastActiveDay,
  activity: s.activity,
  badges: s.badges.filter(b => b.unlockedAt).map(b => b.id),
  meaningfulActivity: s.daily.meaningfulActivity,
  customQuestEnergy: s.daily.customQuestEnergy,
  customQuestGrowth: s.daily.customQuestGrowth,
  inventory: s.inventory,
});

const tap = (s: UserState, id: string, now = NOW) => advanceQuest(s, id, now);
const quest = (s: UserState, id: string) => s.quests.find(q => q.id === id)!;
const correct = (s: UserState, id: string, now = NOW) => correctQuest(s, id, quest(s, id).progress, now);

describe('correcting a quest tap', () => {
  it('marks a one-step quest as not done, keeping everything earned', () => {
    const done = tap(player(), 'q1').state;
    expect(quest(done, 'q1').completed).toBe(true);
    const { state, message } = correct(done, 'q1');
    expect(quest(state, 'q1')).toMatchObject({ completed: false, progress: 0 });
    expect(earned(state)).toEqual(earned(done));
    expect(message).toMatch(/not done.*stays yours/);
  });

  it('redoing a corrected step completes it again but pays nothing', () => {
    const done = tap(player(), 'q1').state;
    const redone = tap(correct(done, 'q1').state, 'q1');
    expect(quest(redone.state, 'q1').completed).toBe(true);
    expect(earned(redone.state)).toEqual(earned(done));
    expect(redone.message).toMatch(/already earned/);
  });

  it('takes one step off a multi-step quest; redoing it pays nothing, and new steps still pay', () => {
    let s = player();
    for (let i = 0; i < 3; i++) s = tap(s, 'q5').state; // Hydration: 3/4
    const before = earned(s);
    s = correct(s, 'q5').state;
    expect(quest(s, 'q5')).toMatchObject({ progress: 2, completed: false });
    expect(earned(s)).toEqual(before);
    s = tap(s, 'q5').state; // 3/4 again: already earned
    expect(earned(s)).toEqual(before);
    s = tap(s, 'q5').state; // 4/4: a new step
    expect(s.energy).toBe(before.energy + 5);
    expect(quest(s, 'q5').completed).toBe(true);
  });

  it('corrects a completed multi-step quest one step at a time', () => {
    let s = player();
    for (let i = 0; i < 4; i++) s = tap(s, 'q5').state;
    s = correct(s, 'q5').state;
    expect(quest(s, 'q5')).toMatchObject({ progress: 3, completed: false });
    s = correct(s, 'q5').state;
    expect(quest(s, 'q5').progress).toBe(2);
  });

  it('undo-redo loops never earn anything (every quest, many times)', () => {
    let s = player([custom('c1'), custom('c3', { target: 3, points: 30 })]);
    for (const q of s.quests) for (let i = 0; i < q.target; i++) s = tap(s, q.id).state;
    const before = earned(s);
    for (let round = 0; round < 25; round++) {
      for (const q of s.quests.filter(q => canCorrectQuest(s, q, NOW))) {
        s = correct(s, q.id).state;
        s = tap(s, q.id).state;
      }
    }
    expect(earned(s)).toEqual(before);
    expect(s.quests.filter(q => q.id !== 'q3' && q.id !== 'q4').every(q => q.completed)).toBe(true);
  });

  it('never pays the Daily Vitality bonus (Golden Scales) twice', () => {
    const done = tap(player(), 'q2').state;
    expect(done.goldenScales).toBe(10);
    let s = done;
    for (let i = 0; i < 5; i++) s = tap(correct(s, 'q2').state, 'q2').state;
    expect(s.goldenScales).toBe(10);
    expect(earned(s)).toEqual(earned(done));
  });

  it('keeps streak and active-day credit even when the only completed quest is corrected', () => {
    const done = tap(player(), 'q1').state;
    expect(done.daily.meaningfulActivity).toBe(true);
    const s = correct(done, 'q1').state;
    expect(s.daily.meaningfulActivity).toBe(true);
    expect(s.currentStreak).toBe(done.currentStreak);
    expect(s.activity).toEqual(done.activity);
  });

  it('never takes back a badge or a stage', () => {
    let s = { ...player(), petCount: 10 };
    s = evaluateBadges(tap(s, 'q1').state, NOW);
    const badges = s.badges.filter(b => b.unlockedAt).map(b => b.id);
    s = evaluateBadges(correct(s, 'q1').state, NOW);
    expect(s.badges.filter(b => b.unlockedAt).map(b => b.id)).toEqual(badges);
    expect(s.stage).toBe(DragonStage.HATCHLING);
  });

  it('does nothing if the quest changed since the player saw it (another tab already corrected it)', () => {
    let s = player();
    for (let i = 0; i < 3; i++) s = tap(s, 'q5').state;
    const first = correctQuest(s, 'q5', 3, NOW).state;
    const second = correctQuest(first, 'q5', 3, NOW);
    expect(quest(second.state, 'q5').progress).toBe(2);
    expect(second.state.quests).toEqual(first.quests);
    expect(second.message).toMatch(/already changed/);
  });

  it('only corrects quests with progress', () => {
    const s = player();
    expect(canCorrectQuest(s, quest(s, 'q1'), NOW)).toBe(false);
    const r = correctQuest(s, 'q1', 0, NOW);
    expect(r.state.quests).toEqual(s.quests);
  });
});

describe('the daily reward ledger', () => {
  it('records what each quest step was worth', () => {
    let s = tap(player(), 'q5').state;
    expect(s.daily.questRewards.q5).toEqual({ energy: 5, growth: 0.5, scales: 0 });
    s = tap(tap(tap(s, 'q5').state, 'q5').state, 'q5').state;
    expect(s.daily.questRewards.q5).toEqual({ energy: 20, growth: 2, scales: 0 });
    s = tap(s, 'q2').state;
    expect(s.daily.questRewards.q2).toEqual({ energy: 25, growth: 5, scales: 10 });
  });

  it('a correction keeps the ledger at what the quest was worth', () => {
    let s = player();
    for (let i = 0; i < 3; i++) s = tap(s, 'q5').state;
    s = correct(s, 'q5').state;
    expect(s.daily.questRewards.q5).toEqual({ energy: 15, growth: 1.5, scales: 0 });
  });

  it('progress a quest shows is never paid again, even without a ledger entry (a repaired save)', () => {
    const base = player();
    let s: UserState = { ...base, quests: base.quests.map(q => (q.id === 'q5' ? { ...q, progress: 3 } : q)) };
    expect(s.daily.questRewards.q5).toBeUndefined();
    s = tap(s, 'q5').state; // 4/4: only the new glass pays
    expect(s.energy).toBe(base.energy + 5);
  });
});

describe('corrections are same-day only', () => {
  it('a quest from yesterday can no longer be corrected: the new day resets it', () => {
    const done = tap(player(), 'q1', day(20, 23, 59)).state;
    expect(canCorrectQuest(done, quest(done, 'q1'), day(20, 23, 59, 59))).toBe(true);
    const nextDay = day(21, 0, 0, 1);
    expect(canCorrectQuest(done, quest(done, 'q1'), nextDay)).toBe(false);
    const r = correctQuest(done, 'q1', 1, nextDay);
    expect(quest(r.state, 'q1')).toMatchObject({ progress: 0, completed: false });
    expect(r.state.energy).toBe(done.energy);
    expect(r.state.daily.date).toBe(dayKey(nextDay));
  });

  it('a correction confirmed just after midnight does nothing (the dialog was opened yesterday)', () => {
    let s = player([], day(20, 23));
    for (let i = 0; i < 2; i++) s = tap(s, 'q5', day(20, 23, 58)).state;
    const r = correctQuest(s, 'q5', 2, day(21, 0, 0, 30));
    expect(quest(r.state, 'q5').progress).toBe(0);
    expect(r.state.energy).toBe(s.energy);
  });

  it('the ledger starts fresh each day: tomorrow the quest pays again', () => {
    const done = tap(player(), 'q1').state;
    const corrected = correct(done, 'q1').state;
    const tomorrow = tap(rollOverDay(corrected, day(21)), 'q1', day(21)).state;
    expect(tomorrow.energy).toBe(done.energy + 10);
  });
});

describe('quests completed by a focus session or check-in', () => {
  it("can't be corrected", () => {
    let s = completeFocusSession(player(), NOW).state;
    s = logCheckIn(s, 3, 3, NOW).state;
    for (const id of ['q3', 'q4']) {
      expect(quest(s, id).completed).toBe(true);
      expect(canCorrectQuest(s, quest(s, id), NOW)).toBe(false);
      expect(quest(correctQuest(s, id, 1, NOW).state, id).completed).toBe(true);
    }
  });

  it('a focus quest tapped by hand can be corrected until a focus session completes it', () => {
    let s = tap(player(), 'q3').state;
    expect(canCorrectQuest(s, quest(s, 'q3'), NOW)).toBe(true);
    s = completeFocusSession(s, NOW).state;
    expect(canCorrectQuest(s, quest(s, 'q3'), NOW)).toBe(false);
  });

  it('a custom quest in the Focus category that a session completed is not correctable either', () => {
    const s = completeFocusSession(player([custom('cf', { type: 'focus' })]), NOW).state;
    expect(quest(s, 'cf').completed).toBe(true);
    expect(canCorrectQuest(s, quest(s, 'cf'), NOW)).toBe(false);
  });
});
