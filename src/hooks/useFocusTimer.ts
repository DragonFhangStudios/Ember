import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FocusTimerState,
  createFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from '../lib/focusTimer';

const TICK_MS = 250;

/**
 * Owns the focus timer above the tab views so switching tabs doesn't lose it.
 * `onComplete` fires exactly once per finished session.
 */
export function useFocusTimer(onComplete: () => void) {
  const [timer, setTimer] = useState<FocusTimerState>(() => createFocusTimer());
  const timerRef = useRef(timer);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const commit = useCallback((next: FocusTimerState) => {
    timerRef.current = next;
    setTimer(next);
  }, []);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const id = setInterval(() => {
      const { timer: next, completed } = tickFocusTimer(timerRef.current, Date.now());
      commit(next);
      if (completed) onCompleteRef.current();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [timer.status, commit]);

  return {
    timer,
    start: () => commit(startFocusTimer(timerRef.current, Date.now())),
    pause: () => commit(pauseFocusTimer(timerRef.current, Date.now())),
    reset: () => commit(resetFocusTimer(timerRef.current)),
  };
}
