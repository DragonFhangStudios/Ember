// Pattern Challenge: watch a short pattern of symbols light up, then repeat
// it. Three rounds, and the pattern grows by one each round (two, three, then
// four symbols). Just for fun: no timer, no penalty, unlimited replays, and
// nothing is saved. A game lives in memory for the page session.

export type PadId = 'flower' | 'raindrop' | 'snowflake' | 'paw';

/** Four symbols that differ in shape, colour, name and place. */
export const PADS: readonly { id: PadId; name: string }[] = [
  { id: 'flower', name: 'Flower' },
  { id: 'raindrop', name: 'Raindrop' },
  { id: 'snowflake', name: 'Snowflake' },
  { id: 'paw', name: 'Paw print' },
];

/** How many symbols each round asks for. */
export const ROUND_LENGTHS = [2, 3, 4] as const;
export const ROUNDS = ROUND_LENGTHS.length;

/** While showing: how long each symbol stays lit, and the pause after it. */
export const STEP_MS = 800;
export const GAP_MS = 350;

export interface PatternGame {
  /** The whole pattern; round n asks for its first ROUND_LENGTHS[n] symbols. */
  pattern: readonly PadId[];
  /** 0, 1 or 2. */
  round: number;
  /**
   * 'ready': waiting for the player to ask to see the pattern.
   * 'showing': the pattern is lighting up; presses are ignored.
   * 'repeat': the player's turn.
   * 'roundDone': this round's pattern was repeated; the next round waits for the player.
   * 'won': all three rounds done.
   */
  phase: 'ready' | 'showing' | 'repeat' | 'roundDone' | 'won';
  /** While showing: the step that's lit, or null between steps. */
  lit: number | null;
  /** While showing: how many steps have lit up so far (so a caption can stay on the last one between steps). */
  shown: number;
  /** What the player has pressed so far this attempt. */
  entered: readonly PadId[];
  /** The last attempt didn't match (cleared by the next press or replay). */
  missed: boolean;
}

const padName = (id: PadId) => PADS.find(p => p.id === id)!.name;

/** A full-length pattern that never repeats a symbol back to back (so each step is easy to see). */
export function newPattern(random: () => number = Math.random): PadId[] {
  const pattern: PadId[] = [];
  while (pattern.length < ROUND_LENGTHS[ROUNDS - 1]) {
    const choices = PADS.filter(p => p.id !== pattern[pattern.length - 1]);
    pattern.push(choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))].id);
  }
  return pattern;
}

export function newGame(random: () => number = Math.random): PatternGame {
  return { pattern: newPattern(random), round: 0, phase: 'ready', lit: null, shown: 0, entered: [], missed: false };
}

/** This round's pattern. */
export const roundPattern = (game: PatternGame) => game.pattern.slice(0, ROUND_LENGTHS[game.round]);

/** This round's pattern in words, for anyone who'd rather read or hear it than watch it. */
export const patternInWords = (game: PatternGame) => roundPattern(game).map(padName).join(', then ');

/** Starts showing the pattern: from the start of a round, or again (any number of times) on the player's turn. */
export function startShowing(game: PatternGame): PatternGame {
  if (game.phase !== 'ready' && game.phase !== 'repeat') return game;
  return { ...game, phase: 'showing', lit: null, shown: 0, entered: [], missed: false };
}

/** Lights one step of the pattern (or none, between steps) while showing. */
export function light(game: PatternGame, step: number | null): PatternGame {
  return game.phase === 'showing' ? { ...game, lit: step, shown: step === null ? game.shown : Math.max(game.shown, step + 1) } : game;
}

/** The pattern has been shown: the player's turn. */
export function finishShowing(game: PatternGame): PatternGame {
  return game.phase === 'showing' ? { ...game, phase: 'repeat', lit: null } : game;
}

/**
 * The player presses a symbol. Ignored unless it's their turn, and ignored
 * for an immediate second press of the same symbol (a double tap: patterns
 * never repeat a symbol back to back, so it can't be meant). A wrong symbol
 * simply starts the attempt over, with no penalty.
 */
export function press(game: PatternGame, pad: PadId): PatternGame {
  if (game.phase !== 'repeat' || !PADS.some(p => p.id === pad) || game.entered[game.entered.length - 1] === pad) return game;
  const target = roundPattern(game);
  const entered = [...game.entered, pad];
  if (target[entered.length - 1] !== pad) return { ...game, entered: [], missed: true };
  if (entered.length < target.length) return { ...game, entered, missed: false };
  return { ...game, entered, missed: false, phase: game.round === ROUNDS - 1 ? 'won' : 'roundDone' };
}

/** On to the next round, once this one is done. */
export function nextRound(game: PatternGame): PatternGame {
  return game.phase === 'roundDone' ? { ...game, round: game.round + 1, phase: 'ready', entered: [], missed: false } : game;
}

/** The dialog closed: stop any showing (it can be watched again later). Everything else is kept. */
export function stopShowing(game: PatternGame): PatternGame {
  return game.phase === 'showing' ? { ...game, phase: 'ready', lit: null } : game;
}

export interface PatternChallenge {
  game(): PatternGame;
  show(): void;
  press(pad: PadId): void;
  nextRound(): void;
  /** A fresh game with a new pattern. */
  playAgain(): void;
  /** The dialog closed: any showing stops, and no timer is left behind. */
  pause(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * The game for this page session, kept outside the dialog so closing and
 * reopening it carries on. Owns the showing timer, so a showing can never
 * run on into a closed dialog or a newer game.
 */
export function createPatternChallenge({ random = Math.random, stepMs = STEP_MS, gapMs = GAP_MS }: { random?: () => number; stepMs?: number; gapMs?: number } = {}): PatternChallenge {
  let game = newGame(random);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: PatternGame) => {
    if (next === game) return;
    game = next;
    listeners.forEach(listener => listener());
  };
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const after = (ms: number, then: () => void) => {
    timer = setTimeout(() => {
      timer = null;
      then();
    }, ms);
  };
  // Each step lights for stepMs, then rests for gapMs; then it's the player's turn.
  const showStep = (step: number) => {
    if (step >= roundPattern(game).length) {
      set(finishShowing(game));
      return;
    }
    set(light(game, step));
    after(stepMs, () => {
      set(light(game, null));
      after(gapMs, () => showStep(step + 1));
    });
  };

  return {
    game: () => game,
    show() {
      const next = startShowing(game);
      if (next === game) return;
      clearTimer();
      set(next);
      after(gapMs, () => showStep(0));
    },
    press(pad) {
      set(press(game, pad));
    },
    nextRound() {
      set(nextRound(game));
    },
    playAgain() {
      clearTimer();
      set(newGame(random));
    },
    pause() {
      clearTimer();
      set(stopShowing(game));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
