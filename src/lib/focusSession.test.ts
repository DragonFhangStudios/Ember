import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import { bondTotal } from './evolution';
import { FOCUS_DURATION_MS, sanitizeFocusSession } from './focusTimer';
import { focusView, pauseFocus, resetFocus, settle, startFocus } from './focusSession';
import {
  COMPLETED_FOCUS_SESSIONS_KEPT,
  DAILY_LIMITS,
  REWARDS,
  activeDaysOf,
  createInitialState,
  dayKey,
  migrateState,
  rollOverDay,
} from './progression';

const MIN = 60_000;
const DUR = FOCUS_DURATION_MS;
const at = (d: number, h = 10, m = 0, s = 0) => new Date(2026, 9, d, h, m, s);
const after = (date: Date, ms: number) => new Date(date.getTime() + ms);
/** Simulates saving and reloading (JSON round trip through migration). */
const reload = (state: UserState, now: Date) => migrateState(JSON.parse(JSON.stringify(state)), now);
const run = (state: UserState, now: Date) => settle(state, now);

function player(now = at(20), overrides: Partial<UserState> = {}): UserState {
  return { ...createInitialState(now), stage: DragonStage.HATCHLING, ...overrides };
}

/** Starts a session at `start` and settles at `processAt`. */
function startAndSettle(state: UserState, id: string, start: Date, processAt: Date) {
  return settle(startFocus(rollOverDay(state, start), id, start), processAt);
}

describe('focus session transitions', () => {
  it('starts a running session with its own id and end time', () => {
    const s = startFocus(player(), 'a', at(20));
    expect(s.focus).toEqual({ id: 'a', status: 'running', durationMs: DUR, remainingMs: DUR, endsAt: at(20).getTime() + DUR });
  });

  it('pausing keeps the remaining time; resuming keeps the id', () => {
    let s = startFocus(player(), 'a', at(20));
    s = pauseFocus(s, 'a', after(at(20), 4 * MIN));
    expect(s.focus).toMatchObject({ id: 'a', status: 'paused', remainingMs: 6 * MIN, endsAt: null });
    s = startFocus(s, 'ignored-new-id', at(20, 11));
    expect(s.focus).toMatchObject({ id: 'a', status: 'running', endsAt: at(20, 11).getTime() + 6 * MIN });
  });

  it('starting while running does nothing', () => {
    const s = startFocus(player(), 'a', at(20));
    expect(startFocus(s, 'b', at(20, 10, 1))).toBe(s);
  });

  it('a stale tab acting on an old session id changes nothing', () => {
    let s = startFocus(player(), 'a', at(20));
    s = resetFocus(s, 'a');
    s = startFocus(s, 'b', at(20, 10, 5));
    expect(pauseFocus(s, 'a', at(20, 10, 6))).toBe(s);
    expect(resetFocus(s, 'a')).toBe(s);
  });

  it('pausing after the end time does not stop completion', () => {
    const s = startFocus(player(), 'a', at(20));
    expect(pauseFocus(s, 'a', after(at(20), DUR + 1))).toBe(s);
  });

  it('never reuses an id that was already completed', () => {
    const done = startAndSettle(player(), 'a', at(20), after(at(20), DUR)).state;
    const cleared = resetFocus(done, 'a');
    expect(startFocus(cleared, 'a', at(20, 12))).toBe(cleared);
  });

  it('the live view counts down from the saved end time', () => {
    const s = startFocus(player(), 'a', at(20));
    expect(focusView(s.focus, after(at(20), 90_000).getTime()).remainingMs).toBe(DUR - 90_000);
    expect(focusView(null, 0).status).toBe('idle');
  });
});

describe('persistence across reloads', () => {
  it('a running session resumes with the correct remaining time', () => {
    const s = reload(startFocus(player(), 'a', at(20)), after(at(20), 3 * MIN));
    expect(focusView(s.focus, after(at(20), 3 * MIN).getTime())).toMatchObject({ id: 'a', status: 'running', remainingMs: 7 * MIN });
  });

  it('a paused session stays paused', () => {
    const paused = pauseFocus(startFocus(player(), 'a', at(20)), 'a', after(at(20), 2 * MIN));
    const s = reload(paused, at(21));
    expect(s.focus).toMatchObject({ id: 'a', status: 'paused', remainingMs: 8 * MIN, endsAt: null });
    expect(settle(s, at(21)).state.focus?.status).toBe('paused');
  });

  it('repairs corrupt or impossible saved sessions safely', () => {
    const now = at(20).getTime();
    expect(sanitizeFocusSession('junk', now)).toBeNull();
    expect(sanitizeFocusSession({ id: '', status: 'running', durationMs: DUR, endsAt: now }, now)).toBeNull();
    expect(sanitizeFocusSession({ id: 'a', status: 'sleeping', durationMs: DUR }, now)).toBeNull();
    expect(sanitizeFocusSession({ id: 'a', status: 'running', durationMs: -5, endsAt: now }, now)).toBeNull();
    expect(sanitizeFocusSession({ id: 'a', status: 'running', durationMs: DUR }, now)).toBeNull();
    expect(sanitizeFocusSession({ id: 'a', status: 'paused', durationMs: DUR, remainingMs: 9e9 }, now)?.remainingMs).toBe(DUR);
    // Clock moved backwards: an end time beyond a full duration is clamped.
    expect(sanitizeFocusSession({ id: 'a', status: 'running', durationMs: DUR, endsAt: now + 50 * DUR }, now)?.endsAt).toBe(now + DUR);
    const migrated = migrateState({ ...player(), focus: { bad: true }, completedFocusSessions: ['x', 3, 'x', null] }, at(20));
    expect(migrated.focus).toBeNull();
    expect(migrated.completedFocusSessions).toEqual(['x']);
  });
});

describe('completion is rewarded exactly once', () => {
  it('settling completes the session and records its id with the reward', () => {
    const r = startAndSettle(player(), 'a', at(20), after(at(20), DUR));
    expect(r.state.focus).toMatchObject({ id: 'a', status: 'finished', completedAt: at(20).getTime() + DUR });
    expect(r.state.completedFocusSessions).toEqual(['a']);
    expect(bondTotal(r.state.bond)).toBe(REWARDS.focus.growth);
    expect(r.state.daily.focusRewards).toBe(1);
    expect(r.state.quests.find(q => q.type === 'focus')?.completed).toBe(true);
  });

  it('settling again (another tab, a reload, a later check) never rewards again', () => {
    let s = startAndSettle(player(), 'a', at(20), after(at(20), DUR)).state;
    const once = bondTotal(s.bond);
    for (const t of [after(at(20), DUR + 1), at(20, 15), at(21)]) s = settle(reload(s, t), t).state;
    expect(bondTotal(s.bond)).toBe(once);
  });

  it('a running copy of an already-recorded session completes without a reward', () => {
    const done = startAndSettle(player(), 'a', at(20), after(at(20), DUR)).state;
    const replay = { ...done, focus: { id: 'a', status: 'running' as const, durationMs: DUR, remainingMs: 0, endsAt: at(20).getTime() + DUR } };
    const r = settle(replay, at(20, 12));
    expect(bondTotal(r.state.bond)).toBe(bondTotal(done.bond));
    expect(r.state.focus?.status).toBe('finished');
  });

  it('nothing happens before the end time', () => {
    const s = startFocus(player(), 'a', at(20));
    const r = settle(s, after(at(20), DUR - 1));
    expect(r.state.focus?.status).toBe('running');
    expect(r.state).toBe(s);
  });

  it(`keeps at most ${COMPLETED_FOCUS_SESSIONS_KEPT} ids; pruned ids can't be replayed through any transition`, () => {
    let s = player();
    let t = at(1, 0, 0).getTime();
    for (let i = 0; i < COMPLETED_FOCUS_SESSIONS_KEPT + 5; i++) {
      s = settle(startFocus(s, `s${i}`, new Date(t)), new Date(t + DUR)).state;
      s = resetFocus(s, `s${i}`);
      t += DUR + MIN;
    }
    expect(s.completedFocusSessions).toHaveLength(COMPLETED_FOCUS_SESSIONS_KEPT);
    expect(s.completedFocusSessions).not.toContain('s0');
    const bond = bondTotal(s.bond);
    // A stale tab can only send transitions, never write an old session back.
    for (const act of [(x: UserState) => pauseFocus(x, 's0', new Date(t)), (x: UserState) => resetFocus(x, 's0')]) {
      expect(settle(act(s), new Date(t)).state.focus).toBeNull();
    }
    expect(bondTotal(s.bond)).toBe(bond);
  });
});

describe('delayed completion: completion date vs reward processing date', () => {
  // Mon Oct 19, Tue Oct 20, Wed Oct 21, Thu Oct 22, Fri Oct 23 (2026).
  const MON = 19, TUE = 20, WED = 21, THU = 22, FRI = 23;
  const activeMonday = (streak = 3) =>
    player(at(MON), { currentStreak: streak, bestStreak: streak, lastActiveDay: dayKey(at(MON)), activity: { days: ['2026-10-19'], legacy: [] } });

  it('a session ending Tue while closed, processed Wed, continues the streak', () => {
    const r = startAndSettle(activeMonday(), 'a', at(MON, 23, 55), at(WED, 9));
    expect(r.state.currentStreak).toBe(4);
    expect(r.state.lastActiveDay).toBe(dayKey(at(TUE)));
    expect(r.state.activity.days).toEqual(['2026-10-19', '2026-10-20']);
    expect(r.message).toMatch(/finished while you were away/);
  });

  it('a session ending on a day already counted does not double count', () => {
    const r = startAndSettle(activeMonday(), 'a', at(MON, 23, 40), at(TUE, 9));
    expect(r.state.currentStreak).toBe(3);
    expect(activeDaysOf(r.state)).toBe(1);
  });

  it('a genuinely missed day still restarts the streak', () => {
    // Tue: only started a session (not meaningful). It ended Wed. Processed Thu.
    const tue = rollOverDay(activeMonday(), at(TUE, 23, 55));
    const r = startAndSettle(tue, 'a', at(TUE, 23, 55), at(THU, 9));
    expect(r.state.currentStreak).toBe(1);
    expect(r.state.bestStreak).toBe(3);
    expect(r.state.lastActiveDay).toBe(dayKey(at(WED)));
  });

  it('returning after several missed days credits the completion day, then resets only the current streak', () => {
    const r = startAndSettle(activeMonday(), 'a', at(MON, 23, 55), at(FRI, 9));
    expect(r.state.activity.days).toContain('2026-10-20');
    expect(r.state.bestStreak).toBe(4); // Tue continued it to 4
    expect(r.state.currentStreak).toBe(0); // Wed and Thu were missed
    expect(bondTotal(r.state.bond)).toBe(REWARDS.focus.growth); // still rewarded once, on Friday
  });

  it('rewards use the processing day: a late completion consumes that day\'s focus allowance', () => {
    let s = startAndSettle(activeMonday(), 'late', at(MON, 23, 55), at(WED, 9)).state;
    expect(s.daily.date).toBe(dayKey(at(WED)));
    expect(s.daily.focusRewards).toBe(1);
    let t = at(WED, 10);
    for (let i = 0; i < 4; i++) {
      s = settle(startFocus(s, `wed${i}`, t), after(t, DUR)).state;
      s = resetFocus(s, `wed${i}`);
      t = after(t, DUR + MIN);
    }
    expect(s.daily.focusRewards).toBe(DAILY_LIMITS.focusRewards);
    expect(bondTotal(s.bond)).toBe(DAILY_LIMITS.focusRewards * REWARDS.focus.growth);
  });

  it('a late completion does not mark the processing day\'s focus quest', () => {
    const r = startAndSettle(activeMonday(), 'a', at(MON, 23, 55), at(WED, 9));
    expect(r.state.quests.find(q => q.type === 'focus')?.completed).toBe(false);
  });

  it('ending just before midnight counts that day; ending just after counts the next', () => {
    const before = startAndSettle(activeMonday(), 'a', after(at(TUE, 23, 59, 59), -DUR), at(TUE, 23, 59, 59));
    expect(before.state.lastActiveDay).toBe(dayKey(at(TUE)));
    expect(before.state.currentStreak).toBe(4);

    const justAfter = startAndSettle(activeMonday(), 'b', after(at(WED, 0, 0, 1), -DUR), at(WED, 0, 0, 1));
    expect(justAfter.state.lastActiveDay).toBe(dayKey(at(WED)));
    expect(justAfter.state.currentStreak).toBe(1); // Tue was missed

    // Ended Tue 23:59:59, but only processed after midnight.
    const lateProcessed = startAndSettle(activeMonday(), 'c', after(at(TUE, 23, 59, 59), -DUR), at(WED, 0, 0, 1));
    expect(lateProcessed.state.lastActiveDay).toBe(dayKey(at(TUE)));
    expect(lateProcessed.state.currentStreak).toBe(4);
    expect(lateProcessed.state.daily.date).toBe(dayKey(at(WED)));
    expect(lateProcessed.state.daily.focusRewards).toBe(1);
  });

  it('a session ending today while the save is from yesterday takes the normal same-day path', () => {
    const r = startAndSettle(activeMonday(), 'a', at(TUE, 8), at(TUE, 9));
    expect(r.state.currentStreak).toBe(4);
    expect(r.state.daily.meaningfulActivity).toBe(true);
    expect(r.state.quests.find(q => q.type === 'focus')?.completed).toBe(true);
  });

  it('a delayed completion counts toward evolution on its real date, and never lowers progress', () => {
    const r = startAndSettle(activeMonday(), 'a', at(MON, 23, 55), at(WED, 9));
    expect(activeDaysOf(r.state)).toBe(2);
    expect(r.state.stage).toBe(DragonStage.HATCHLING);
  });
});
