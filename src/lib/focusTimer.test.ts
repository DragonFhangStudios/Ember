import { describe, expect, it } from 'vitest';
import {
  FOCUS_DURATION_MS,
  createFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from './focusTimer';

const T0 = 1_000_000;

describe('focus timer', () => {
  it('counts down from wall-clock time', () => {
    const running = startFocusTimer(createFocusTimer(), T0);
    const { timer, completed } = tickFocusTimer(running, T0 + 90_000);
    expect(timer.remainingMs).toBe(FOCUS_DURATION_MS - 90_000);
    expect(completed).toBe(false);
  });

  it('pauses and resumes without losing or gaining time', () => {
    let timer = startFocusTimer(createFocusTimer(), T0);
    timer = pauseFocusTimer(timer, T0 + 60_000);
    expect(timer.status).toBe('paused');
    // Time spent paused doesn't count.
    expect(tickFocusTimer(timer, T0 + 500_000).timer.remainingMs).toBe(FOCUS_DURATION_MS - 60_000);
    timer = startFocusTimer(timer, T0 + 500_000);
    expect(timer.endsAt).toBe(T0 + 500_000 + FOCUS_DURATION_MS - 60_000);
    expect(tickFocusTimer(timer, T0 + 500_000 + FOCUS_DURATION_MS - 60_000).completed).toBe(true);
  });

  it('reports completion exactly once', () => {
    let timer = startFocusTimer(createFocusTimer(), T0);
    const done = tickFocusTimer(timer, T0 + FOCUS_DURATION_MS + 5_000);
    expect(done.completed).toBe(true);
    expect(done.timer.status).toBe('finished');
    timer = done.timer;
    for (let i = 1; i <= 5; i++) {
      const again = tickFocusTimer(timer, T0 + FOCUS_DURATION_MS + i * 1_000);
      expect(again.completed).toBe(false);
      timer = again.timer;
    }
    // Start is ignored once finished; only reset begins a new session.
    expect(startFocusTimer(timer, T0)).toBe(timer);
  });

  it('reset returns to a full idle timer from any state', () => {
    const running = startFocusTimer(createFocusTimer(), T0);
    for (const t of [running, pauseFocusTimer(running, T0 + 1_000), tickFocusTimer(running, T0 + FOCUS_DURATION_MS).timer]) {
      expect(resetFocusTimer(t)).toEqual(createFocusTimer());
    }
  });

  it('supports multiple legitimate sessions back to back', () => {
    let timer = createFocusTimer();
    let completions = 0;
    let now = T0;
    for (let session = 0; session < 3; session++) {
      timer = startFocusTimer(timer, now);
      for (let s = 0; s <= FOCUS_DURATION_MS / 1000; s += 30) {
        const result = tickFocusTimer(timer, now + s * 1000);
        timer = result.timer;
        if (result.completed) completions++;
      }
      now += FOCUS_DURATION_MS + 60_000;
      timer = resetFocusTimer(timer);
    }
    expect(completions).toBe(3);
  });

  it('ignores pause and tick when not running', () => {
    const idle = createFocusTimer();
    expect(pauseFocusTimer(idle, T0)).toBe(idle);
    expect(tickFocusTimer(idle, T0 + FOCUS_DURATION_MS).completed).toBe(false);
  });
});
