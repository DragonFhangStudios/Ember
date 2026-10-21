import { describe, expect, it } from 'vitest';
import { DragonStage, Quest, UserState } from '../types';
import { bondTotal } from './evolution';
import { FOCUS_DURATION_MS } from './focusTimer';
import { settle, startFocus } from './focusSession';
import {
  CHECK_IN_NOTE_MAX,
  COMPLETED_FOCUS_SESSIONS_KEPT,
  SAVE_VERSION,
  ZEN_MASTER_SESSIONS,
  advanceQuest,
  canCorrectQuest,
  correctQuest,
  createInitialState,
  dayKey,
  evaluateBadges,
  logCheckIn,
  migrateState,
  rollOverDay,
} from './progression';

// Save version 9 (#19): the reward ledger, custom-quest energy cap, lifetime
// focus count (Zen Master), and check-in notes. Upgrades keep everything.

const day = (d: number, hour = 10, minute = 0) => new Date(2026, 9, d, hour, minute);
const NOW = day(20);

const custom = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, title: id, description: '', type: 'custom', completed: false,
  points: 10, isDaily: true, isCustom: true, progress: 0, target: 1, ...overrides,
});

/** A save as version 8 wrote it: no ledger, no energy cap counter, no lifetime focus count. */
function v8Save(overrides: Partial<UserState> = {}, now = NOW): Record<string, unknown> {
  const s: UserState = { ...createInitialState(now), stage: DragonStage.DRAKE, ...overrides };
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 8;
  delete raw.focusSessionsCompleted;
  delete raw.daily.customQuestEnergy;
  delete raw.daily.questRewards;
  delete raw.daily.autoCompletedQuests;
  return raw;
}

const quest = (s: UserState, id: string) => s.quests.find(q => q.id === id)!;

describe('upgrading a version 8 save', () => {
  const base = createInitialState(NOW);
  const today: Partial<UserState> = {
    energy: 345,
    goldenScales: 77,
    bond: { local: 120, legacy: 40 },
    inventory: ['hat_wizard', 'nest_moss'],
    equipped: { hat: 'hat_wizard' },
    currentStreak: 6,
    bestStreak: 12,
    lastActiveDay: dayKey(NOW),
    petCount: 31,
    badges: base.badges.map(b => (b.id === 'badge_hatch' || b.id === 'badge_streak_7' ? { ...b, unlockedAt: '2026-10-01T10:00:00.000Z' } : b)),
    quests: [
      ...base.quests.map(q =>
        q.id === 'q1' ? { ...q, progress: 1, completed: true }
        : q.id === 'q2' ? { ...q, progress: 1, completed: true }
        : q.id === 'q5' ? { ...q, progress: 2 }
        : q.id === 'q3' ? { ...q, progress: 1, completed: true }
        : q,
      ),
      custom('c4', { target: 4, points: 40, progress: 4, completed: true }),
      custom('c3', { target: 3, points: 30, progress: 2 }),
    ],
    daily: { ...base.daily, meaningfulActivity: true, focusRewards: 1, customQuestGrowth: 3.333333 },
  };

  it('keeps every reward, item, badge, streak, Bond value and stage', () => {
    const raw = v8Save(today);
    const s = migrateState(raw, NOW);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.energy).toBe(345);
    expect(s.goldenScales).toBe(77);
    expect(bondTotal(s.bond)).toBe(160);
    expect(s.inventory).toEqual(['hat_wizard', 'nest_moss']);
    expect(s.equipped).toEqual({ hat: 'hat_wizard' });
    expect([s.currentStreak, s.bestStreak, s.lastActiveDay]).toEqual([6, 12, dayKey(NOW)]);
    expect(s.stage).toBe(DragonStage.DRAKE);
    expect(s.badges.filter(b => b.unlockedAt).map(b => b.id)).toEqual(['badge_hatch', 'badge_streak_7']);
    expect(s.quests.map(q => [q.id, q.progress, q.completed])).toEqual((raw.quests as Quest[]).map(q => [q.id, q.progress, q.completed]));
  });

  it("records today's progress in the ledger", () => {
    const s = migrateState(v8Save(today), NOW);
    expect(s.daily.questRewards).toEqual({
      q1: { energy: 10, growth: 2, scales: 0 },
      q2: { energy: 25, growth: 5, scales: 10 },
      q3: { energy: 15, growth: 2, scales: 0 },
      q5: { energy: 10, growth: 1, scales: 0 },
      c4: { energy: 40, growth: 2, scales: 0 },
      c3: { energy: 20, growth: 1.333333, scales: 0 },
    });
  });

  it("counts today's progress as already rewarded: finishing pays only new steps, redoing pays nothing", () => {
    let s = migrateState(v8Save(today), NOW);
    // Hydration 2/4: the next step pays one step (5 energy), not three.
    s = advanceQuest(s, 'q5', NOW).state;
    expect(s.energy).toBe(345 + 5);
    // Completed quests can't pay again after a correction.
    const vitality = correctQuest(s, 'q2', 1, NOW).state;
    const redone = advanceQuest(vitality, 'q2', NOW).state;
    expect([redone.energy, redone.goldenScales, bondTotal(redone.bond)]).toEqual([s.energy, s.goldenScales, bondTotal(s.bond)]);
  });

  it("counts today's custom-quest energy toward the new cap, keeping energy earned over it", () => {
    const s = migrateState(v8Save(today), NOW);
    expect(s.daily.customQuestEnergy).toBe(60); // 40 + 20: over the cap, and kept
    expect(s.energy).toBe(345);
    const next = advanceQuest(s, 'c3', NOW).state; // 3/3
    expect(next.energy).toBe(345);
    expect(quest(next, 'c3').completed).toBe(true);
  });

  it('treats completed focus and check-in quests as completed by the session or check-in (not correctable)', () => {
    const s = migrateState(v8Save(today), NOW);
    expect(s.daily.autoCompletedQuests).toEqual(['q3']);
    expect(canCorrectQuest(s, quest(s, 'q3'), NOW)).toBe(false);
    expect(canCorrectQuest(s, quest(s, 'q1'), NOW)).toBe(true);
  });

  it('a save from an earlier day starts today fresh', () => {
    const s = rollOverDay(migrateState(v8Save(today, day(18)), NOW), NOW);
    expect(s.daily).toMatchObject({ date: dayKey(NOW), customQuestEnergy: 0, questRewards: {}, autoCompletedQuests: [] });
    expect(s.quests.every(q => q.progress === 0)).toBe(true);
    expect(advanceQuest(s, 'c4', NOW).state.energy).toBe(345 + 10);
  });

  it('is idempotent: migrating again changes nothing', () => {
    const once = migrateState(v8Save(today), NOW);
    const twice = migrateState(JSON.parse(JSON.stringify(once)), NOW);
    expect(twice).toEqual(once);
    // …including after progress made under version 9.
    const played = advanceQuest(once, 'q5', NOW).state;
    expect(migrateState(JSON.parse(JSON.stringify(played)), NOW)).toEqual(played);
  });

  it('repairs a corrupt ledger, counter, or note', () => {
    const raw = { ...v8Save(), version: 9 } as Record<string, any>;
    raw.daily.questRewards = { q1: { energy: 'lots', growth: -3 }, q2: null, q5: { energy: 10, growth: 1, scales: 0 } };
    raw.daily.autoCompletedQuests = ['q3', 4, null];
    raw.daily.customQuestEnergy = 'many';
    raw.focusSessionsCompleted = 'five';
    raw.symptomLogs = [{ date: NOW.toISOString(), energy: 3, mood: 3, notes: { evil: true } }, { date: NOW.toISOString(), energy: 4, mood: 4, notes: 'ok' }];
    const s = migrateState(raw, NOW);
    expect(s.daily.questRewards).toEqual({ q1: { energy: 0, growth: 0, scales: 0 }, q5: { energy: 10, growth: 1, scales: 0 } });
    expect(s.daily.autoCompletedQuests).toEqual(['q3']);
    expect(s.daily.customQuestEnergy).toBe(0);
    expect(s.focusSessionsCompleted).toBe(0);
    expect(s.symptomLogs[0]).not.toHaveProperty('notes');
    expect(s.symptomLogs[1].notes).toBe('ok');
  });
});

describe('Zen Master: lifetime completed focus sessions', () => {
  const player = (overrides: Partial<UserState> = {}) => ({ ...createInitialState(NOW), stage: DragonStage.HATCHLING, ...overrides });
  /** Runs a full session that starts at `start` and is settled at `settleAt` (default: when it ends). */
  const session = (s: UserState, id: string, start: Date, settleAt = new Date(start.getTime() + FOCUS_DURATION_MS)) =>
    settle(startFocus(rollOverDay(s, start), id, start), settleAt).state;
  const zen = (s: UserState) => s.badges.find(b => b.id === 'badge_focus_5')!;

  it('unlocks at 5 completed sessions, not before', () => {
    let s = player();
    for (let i = 0; i < ZEN_MASTER_SESSIONS; i++) {
      expect(zen(evaluateBadges(s, NOW)).unlockedAt, `after ${i}`).toBeUndefined();
      s = session(s, `s${i}`, day(20 + Math.floor(i / 3), 9 + (i % 3)));
    }
    expect(s.focusSessionsCompleted).toBe(5);
    expect(zen(evaluateBadges(s, NOW)).unlockedAt).toBeDefined();
  });

  it('counts each session once, however often it is settled', () => {
    let s = startFocus(player(), 'once', NOW);
    const end = new Date(NOW.getTime() + FOCUS_DURATION_MS);
    for (let i = 0; i < 5; i++) s = settle(s, new Date(end.getTime() + i * 60_000)).state;
    expect(s.focusSessionsCompleted).toBe(1);
  });

  it('counts a session settled later, after reopening the app on another day, once', () => {
    let s = startFocus(player(), 'late', day(20, 23, 55));
    s = settle(migrateState(JSON.parse(JSON.stringify(s)), day(22, 9)), day(22, 9)).state;
    s = settle(s, day(22, 10)).state;
    expect(s.focusSessionsCompleted).toBe(1);
  });

  it('keeps counting past the bounded completed-session ledger', () => {
    let s = player();
    const total = COMPLETED_FOCUS_SESSIONS_KEPT + 50;
    for (let i = 0; i < total; i++) s = session(s, `id${i}`, new Date(NOW.getTime() + i * 2 * FOCUS_DURATION_MS));
    expect(s.completedFocusSessions).toHaveLength(COMPLETED_FOCUS_SESSIONS_KEPT);
    expect(s.focusSessionsCompleted).toBe(total);
    expect(migrateState(JSON.parse(JSON.stringify(s)), NOW).focusSessionsCompleted).toBe(total);
  });

  it('migration counts the sessions a save can prove, and never invents or lowers any', () => {
    const ids = ['a', 'b', 'c'];
    expect(migrateState(v8Save({ completedFocusSessions: ids }), NOW).focusSessionsCompleted).toBe(3);
    expect(migrateState(v8Save({ completedFocusSessions: [] }), NOW).focusSessionsCompleted).toBe(0);
    expect(migrateState({ ...v8Save({ completedFocusSessions: ids }), version: 9, focusSessionsCompleted: 250 }, NOW).focusSessionsCompleted).toBe(250);
  });

  it('never revokes an unlocked Zen Master badge', () => {
    const unlocked = createInitialState(NOW).badges.map(b => (b.id === 'badge_focus_5' ? { ...b, unlockedAt: '2026-10-01T00:00:00.000Z' } : b));
    const s = evaluateBadges(migrateState(v8Save({ badges: unlocked, completedFocusSessions: [] }), NOW), NOW);
    expect(zen(s).unlockedAt).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('check-in notes', () => {
  const log = (s: UserState) => s.symptomLogs[s.symptomLogs.length - 1];

  it('saves an optional note with the check-in, trimmed', () => {
    const s = logCheckIn(createInitialState(NOW), 3, 4, NOW, '  slept well  ').state;
    expect(log(s)).toMatchObject({ energy: 3, mood: 4, notes: 'slept well' });
  });

  it('a blank note is no note', () => {
    for (const note of [undefined, '', '   \n  ']) {
      expect(log(logCheckIn(createInitialState(NOW), 3, 4, NOW, note).state)).not.toHaveProperty('notes');
    }
  });

  it(`keeps at most ${CHECK_IN_NOTE_MAX} characters of plain text`, () => {
    const s = logCheckIn(createInitialState(NOW), 3, 4, NOW, 'a\u0000b\r\nc' + 'x'.repeat(500)).state;
    expect(log(s).notes).toHaveLength(CHECK_IN_NOTE_MAX);
    expect(log(s).notes!.startsWith('ab\nc')).toBe(true);
  });

  it('updating today\'s check-in replaces its note (or clears it), without new rewards', () => {
    let s = logCheckIn(createInitialState(NOW), 3, 4, NOW, 'first').state;
    const energy = s.energy;
    s = logCheckIn(s, 2, 2, day(20, 12), 'second').state;
    expect(s.symptomLogs).toHaveLength(1);
    expect(log(s)).toMatchObject({ energy: 2, mood: 2, notes: 'second' });
    s = logCheckIn(s, 2, 2, day(20, 13), '').state;
    expect(log(s)).not.toHaveProperty('notes');
    expect(s.energy).toBe(energy);
  });

  it('a note never changes rewards', () => {
    const a = logCheckIn(createInitialState(NOW), 3, 4, NOW).state;
    const b = logCheckIn(createInitialState(NOW), 3, 4, NOW, 'note').state;
    expect([b.energy, bondTotal(b.bond), b.currentStreak]).toEqual([a.energy, bondTotal(a.bond), a.currentStreak]);
  });

  it('keeps earlier check-ins and their notes', () => {
    let s = logCheckIn(createInitialState(day(19)), 3, 4, day(19), 'yesterday').state;
    s = logCheckIn(rollOverDay(s, NOW), 4, 4, NOW, 'today').state;
    expect(s.symptomLogs.map(l => l.notes)).toEqual(['yesterday', 'today']);
  });
});
