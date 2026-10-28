// Memory Match: a cozy card-matching game with Ember. Twelve cards, six
// pairs. Just for fun: it never touches the save, keeps no score and has no
// timer. A round lives in memory only, for this page session.

export type SymbolId = 'heart' | 'moon' | 'sun' | 'leaf' | 'cloud' | 'flame';

/**
 * The six symbols: generic and friendly, and none of them an expedition
 * keepsake (no star, feather, crystal, pebble, stone or bell), so the game
 * never gives away something the player hasn't found.
 */
export const SYMBOLS: readonly { id: SymbolId; name: string }[] = [
  { id: 'heart', name: 'Heart' },
  { id: 'moon', name: 'Moon' },
  { id: 'sun', name: 'Sun' },
  { id: 'leaf', name: 'Leaf' },
  { id: 'cloud', name: 'Cloud' },
  { id: 'flame', name: 'Flame' },
];

export const PAIRS = SYMBOLS.length;

/** How long a mismatched pair stays face up before turning back over. */
export const MISMATCH_MS = 1000;

export interface Card {
  symbol: SymbolId;
  matched: boolean;
}

export interface Round {
  cards: readonly Card[];
  /** Positions of the face-up cards that aren't matched yet (none, one or two). */
  faceUp: readonly number[];
  /** 'mismatch': two different cards are showing; nothing can be picked until they turn back. */
  status: 'playing' | 'mismatch' | 'won';
}

/** A freshly shuffled round (Fisher–Yates). */
export function newRound(random: () => number = Math.random): Round {
  const cards: Card[] = SYMBOLS.flatMap(({ id }) => [
    { symbol: id, matched: false },
    { symbol: id, matched: false },
  ]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, faceUp: [], status: 'playing' };
}

/** Whether the card at `index` shows its symbol. */
export const isFaceUp = (round: Round, index: number) => round.cards[index]?.matched || round.faceUp.includes(index);

export const pairsFound = (round: Round) => round.cards.filter(card => card.matched).length / 2;

/**
 * Turns over the card at `index`. Returns the same round, unchanged, when the
 * pick doesn't count: while a mismatch is showing, after the round is won, or
 * for a card that's already face up or matched (so a double tap can never
 * match a card with itself).
 */
export function pick(round: Round, index: number): Round {
  if (round.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= round.cards.length || isFaceUp(round, index)) return round;
  if (round.faceUp.length === 0) return { ...round, faceUp: [index] };
  const [first] = round.faceUp;
  if (round.cards[first].symbol !== round.cards[index].symbol) return { ...round, faceUp: [first, index], status: 'mismatch' };
  const cards = round.cards.map((card, i) => (i === first || i === index ? { ...card, matched: true } : card));
  return { cards, faceUp: [], status: cards.every(card => card.matched) ? 'won' : 'playing' };
}

/** Turns a mismatched pair back over. Anything else is returned unchanged. */
export function turnBack(round: Round): Round {
  return round.status === 'mismatch' ? { ...round, faceUp: [], status: 'playing' } : round;
}

export interface MemoryMatchGame {
  round(): Round;
  pick(index: number): void;
  /** A freshly shuffled round. */
  playAgain(): void;
  /** The dialog closed: a pending mismatch turns back now, so the round is ready to resume. */
  pause(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * The round for this page session, kept outside the dialog so closing and
 * reopening it resumes the same game. Owns the mismatch timer, so a pending
 * turn-back can never fire into a closed dialog or a newer round.
 */
export function createMemoryMatch({ random = Math.random, mismatchMs = MISMATCH_MS }: { random?: () => number; mismatchMs?: number } = {}): MemoryMatchGame {
  let round = newRound(random);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: Round) => {
    if (next === round) return;
    round = next;
    listeners.forEach(listener => listener());
  };
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    round: () => round,
    pick(index) {
      set(pick(round, index));
      if (round.status === 'mismatch' && timer === null) {
        timer = setTimeout(() => {
          timer = null;
          set(turnBack(round));
        }, mismatchMs);
      }
    },
    playAgain() {
      clearTimer();
      set(newRound(random));
    },
    pause() {
      clearTimer();
      set(turnBack(round));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A small seeded random source (mulberry32), so browser tests can know the
 * deal in advance. Only used when a test sets `__emberMemoryMatchSeed`.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Math.random, unless a browser test asked for a known deal. */
export function gameRandom(): () => number {
  const seed = (globalThis as { __emberMemoryMatchSeed?: unknown }).__emberMemoryMatchSeed;
  return typeof seed === 'number' && Number.isFinite(seed) ? seededRandom(seed) : Math.random;
}
