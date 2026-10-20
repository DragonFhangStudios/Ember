// Focus timer as a pure state machine driven by wall-clock timestamps, so it
// stays accurate in throttled background tabs and reports completion once.

export const FOCUS_DURATION_MS = 10 * 60 * 1000;

export type FocusStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface FocusTimerState {
  status: FocusStatus;
  durationMs: number;
  remainingMs: number;
  endsAt: number | null; // epoch ms, only while running
}

export function createFocusTimer(durationMs = FOCUS_DURATION_MS): FocusTimerState {
  return { status: 'idle', durationMs, remainingMs: durationMs, endsAt: null };
}

/** Starts from idle or resumes from paused. */
export function startFocusTimer(timer: FocusTimerState, now: number): FocusTimerState {
  if (timer.status !== 'idle' && timer.status !== 'paused') return timer;
  return { ...timer, status: 'running', endsAt: now + timer.remainingMs };
}

export function pauseFocusTimer(timer: FocusTimerState, now: number): FocusTimerState {
  if (timer.status !== 'running' || timer.endsAt === null) return timer;
  return { ...timer, status: 'paused', remainingMs: Math.max(0, timer.endsAt - now), endsAt: null };
}

export function resetFocusTimer(timer: FocusTimerState): FocusTimerState {
  return createFocusTimer(timer.durationMs);
}

/** Advances a running timer. `completed` is true only on the tick that finishes it. */
export function tickFocusTimer(
  timer: FocusTimerState,
  now: number,
): { timer: FocusTimerState; completed: boolean } {
  if (timer.status !== 'running' || timer.endsAt === null) return { timer, completed: false };
  const remainingMs = Math.max(0, timer.endsAt - now);
  if (remainingMs === 0) {
    return { timer: { ...timer, status: 'finished', remainingMs: 0, endsAt: null }, completed: true };
  }
  return { timer: { ...timer, remainingMs }, completed: false };
}
