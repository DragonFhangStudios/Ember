import { FocusSession, UserState } from '../types';
import { ActionResult, COMPLETED_FOCUS_SESSIONS_KEPT, completeFocusSessionLate, rollOverDay } from './progression';
import {
  FOCUS_DURATION_MS,
  FocusTimerState,
  createFocusTimer,
  pauseFocusTimer,
  startFocusTimer,
} from './focusTimer';

// The shared, persisted focus session. Every function here is a pure state
// transition applied inside a store transaction to the latest saved state, so
// all tabs see one session and a stale tab can't act on an outdated copy.
//
// Exactly-once completion: a session is rewarded only by `settle`, only while
// it is the saved session, only while it is still `running`, and its id is
// recorded in `completedFocusSessions` in the same state (one transaction) as
// the reward. Pruning that ledger is safe because ids are fresh random ids
// that are only ever created by `startFocus`; transitions never write an old
// session object back, so a pruned id can't become the running session again.

/** The live view of a session at `now` (running sessions count down from endsAt). */
export function focusView(focus: FocusSession | null, now: number): FocusTimerState & { id?: string } {
  if (!focus) return createFocusTimer();
  if (focus.status === 'running' && focus.endsAt !== null) {
    return { id: focus.id, status: 'running', durationMs: focus.durationMs, remainingMs: Math.max(0, focus.endsAt - now), endsAt: focus.endsAt };
  }
  return { id: focus.id, status: focus.status, durationMs: focus.durationMs, remainingMs: focus.remainingMs, endsAt: null };
}

/** Starts a new session (with a fresh id), or resumes the saved paused one. */
export function startFocus(state: UserState, newId: string, now: Date, durationMs = FOCUS_DURATION_MS): UserState {
  const focus = state.focus;
  if (focus?.status === 'running') return state;
  if (focus?.status === 'paused') {
    const t = startFocusTimer({ status: 'paused', durationMs: focus.durationMs, remainingMs: focus.remainingMs, endsAt: null }, now.getTime());
    return { ...state, focus: { ...focus, status: 'running', remainingMs: t.remainingMs, endsAt: t.endsAt } };
  }
  if (state.completedFocusSessions.includes(newId)) return state; // never reuse an id
  const t = startFocusTimer(createFocusTimer(durationMs), now.getTime());
  return { ...state, focus: { id: newId, status: 'running', durationMs, remainingMs: t.remainingMs, endsAt: t.endsAt } };
}

/** Pauses the saved session, if it is still the one the caller saw and it hasn't ended. */
export function pauseFocus(state: UserState, sessionId: string, now: Date): UserState {
  const focus = state.focus;
  if (!focus || focus.id !== sessionId || focus.status !== 'running' || focus.endsAt === null) return state;
  if (focus.endsAt <= now.getTime()) return state; // already ended: settle completes it instead
  const t = pauseFocusTimer({ status: 'running', durationMs: focus.durationMs, remainingMs: focus.remainingMs, endsAt: focus.endsAt }, now.getTime());
  return { ...state, focus: { ...focus, status: 'paused', remainingMs: t.remainingMs, endsAt: null } };
}

/** Clears the saved session, if it is still the one the caller saw. */
export function resetFocus(state: UserState, sessionId: string): UserState {
  if (!state.focus || state.focus.id !== sessionId) return state;
  return { ...state, focus: null };
}

/**
 * Brings saved state up to `now`, in a fixed order: first complete a focus
 * session that ended (possibly while Ember was closed), then start the new
 * day. Every load, action and day check runs this first, so a delayed
 * completion is always judged against the streak as it was before the
 * missed-day reset. Returns the same object when nothing changes.
 */
export function settle(state: UserState, now: Date): ActionResult {
  const focus = state.focus;
  const due = focus?.status === 'running' && focus.endsAt !== null && focus.endsAt <= now.getTime();
  if (!focus || !due) return { state: rollOverDay(state, now) };

  const completedAt = focus.endsAt!;
  const finished: FocusSession = { ...focus, status: 'finished', remainingMs: 0, endsAt: null, completedAt };
  if (state.completedFocusSessions.includes(focus.id)) {
    return { state: rollOverDay({ ...state, focus: finished }, now) };
  }
  const recorded: UserState = {
    ...state,
    focus: finished,
    completedFocusSessions: [...state.completedFocusSessions, focus.id].slice(-COMPLETED_FOCUS_SESSIONS_KEPT),
    // Counted with the id, in the same transaction: exactly once per session.
    focusSessionsCompleted: state.focusSessionsCompleted + 1,
  };
  return completeFocusSessionLate(recorded, new Date(completedAt), now);
}
