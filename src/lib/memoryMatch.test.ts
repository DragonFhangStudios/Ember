import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MISMATCH_MS, PAIRS, Round, SYMBOLS, SymbolId, createMemoryMatch, gameRandom, isFaceUp, newRound, pairsFound, pick, seededRandom, turnBack,
} from './memoryMatch';
import { DISCOVERIES } from './expeditions';

/** Positions of the two cards showing `symbol`. */
const pairOf = (round: Round, symbol: SymbolId) => round.cards.flatMap((card, i) => (card.symbol === symbol ? [i] : []));
/** Two positions that don't match. */
const mismatchIn = (round: Round): [number, number] => [0, round.cards.findIndex(card => card.symbol !== round.cards[0].symbol)];
const play = (round: Round, ...indexes: number[]) => indexes.reduce(pick, round);

describe('the deck', () => {
  it('has twelve cards: exactly six pairs of six distinct symbols', () => {
    const round = newRound(seededRandom(1));
    expect(round.cards).toHaveLength(12);
    expect(PAIRS).toBe(6);
    expect(new Set(SYMBOLS.map(s => s.id)).size).toBe(6);
    for (const { id } of SYMBOLS) expect(round.cards.filter(card => card.symbol === id)).toHaveLength(2);
    expect(round).toMatchObject({ faceUp: [], status: 'playing' });
    expect(round.cards.every(card => !card.matched)).toBe(true);
  });

  it('shuffling keeps every pair, and different rounds are dealt differently', () => {
    const random = seededRandom(42);
    const deals = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const round = newRound(random);
      for (const { id } of SYMBOLS) expect(pairOf(round, id)).toHaveLength(2);
      deals.add(round.cards.map(card => card.symbol).join());
    }
    expect(deals.size).toBeGreaterThan(190);
  });

  it('copes with a random source that returns its upper edge', () => {
    const round = newRound(() => 0.9999999999999999);
    for (const { id } of SYMBOLS) expect(pairOf(round, id)).toHaveLength(2);
  });

  it("uses no expedition keepsake as a symbol, so nothing undiscovered is given away", () => {
    const keepsakeWords = Object.values(DISCOVERIES).map(d => d.name.toLowerCase());
    for (const { name } of SYMBOLS) expect(keepsakeWords.some(words => words.includes(name.toLowerCase())), name).toBe(false);
  });
});

describe('picking cards', () => {
  const round = newRound(seededRandom(7));

  it('a matching pair stays face up as matched', () => {
    const [a, b] = pairOf(round, 'moon');
    const next = play(round, a, b);
    expect(next.cards[a].matched && next.cards[b].matched).toBe(true);
    expect(next).toMatchObject({ faceUp: [], status: 'playing' });
    expect(isFaceUp(next, a) && isFaceUp(next, b)).toBe(true);
    expect(pairsFound(next)).toBe(1);
  });

  it('a mismatch shows both cards until they turn back, and matches nothing', () => {
    const [a, b] = mismatchIn(round);
    const next = play(round, a, b);
    expect(next).toMatchObject({ faceUp: [a, b], status: 'mismatch' });
    expect(pairsFound(next)).toBe(0);
    const back = turnBack(next);
    expect(back).toMatchObject({ faceUp: [], status: 'playing' });
    expect(back.cards).toEqual(round.cards);
  });

  it('picking the same card twice (a double tap) never counts as a match', () => {
    const [a, b] = pairOf(round, 'sun');
    const once = pick(round, a);
    expect(pick(once, a)).toBe(once);
    expect(pairsFound(play(round, a, a, a))).toBe(0);
    expect(play(round, a, a, b).cards[b].matched).toBe(true);
  });

  it('matched cards, and positions that are not cards, are ignored', () => {
    const [a, b] = pairOf(round, 'leaf');
    const matched = play(round, a, b);
    expect(pick(matched, a)).toBe(matched);
    expect(pick(matched, b)).toBe(matched);
    for (const bad of [-1, 12, 1.5, NaN]) expect(pick(round, bad)).toBe(round);
  });

  it('nothing can be picked while a mismatch is showing', () => {
    const [a, b] = mismatchIn(round);
    const showing = play(round, a, b);
    for (let i = 0; i < 12; i++) expect(pick(showing, i)).toBe(showing);
  });

  it('finding all six pairs wins the round; after that, picks are ignored', () => {
    let next = round;
    SYMBOLS.forEach(({ id }, n) => {
      expect(next.status).toBe('playing');
      next = play(next, ...pairOf(round, id));
      expect(pairsFound(next)).toBe(n + 1);
    });
    expect(next.status).toBe('won');
    expect(next.cards.every(card => card.matched)).toBe(true);
    for (let i = 0; i < 12; i++) expect(pick(next, i)).toBe(next);
  });

  it('turning back leaves anything but a mismatch alone', () => {
    const one = pick(round, 0);
    expect(turnBack(round)).toBe(round);
    expect(turnBack(one)).toBe(one);
  });
});

describe('a game for the page session', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a mismatch turns back after the brief delay, not before', () => {
    const game = createMemoryMatch({ random: seededRandom(3) });
    const [a, b] = mismatchIn(game.round());
    game.pick(a);
    game.pick(b);
    expect(game.round().status).toBe('mismatch');
    vi.advanceTimersByTime(MISMATCH_MS - 1);
    expect(game.round().faceUp).toEqual([a, b]);
    vi.advanceTimersByTime(1);
    expect(game.round()).toMatchObject({ faceUp: [], status: 'playing' });
  });

  it('taps while a mismatch is showing are ignored, and start no extra timers', () => {
    const game = createMemoryMatch({ random: seededRandom(3) });
    const [a, b] = mismatchIn(game.round());
    game.pick(a);
    game.pick(b);
    const showing = game.round();
    for (let i = 0; i < 12; i++) game.pick(i);
    expect(game.round()).toBe(showing);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(MISMATCH_MS);
    expect(game.round().status).toBe('playing');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rapid repeated taps on one card turn it over once', () => {
    const game = createMemoryMatch({ random: seededRandom(3) });
    const listener = vi.fn();
    game.subscribe(listener);
    for (let i = 0; i < 5; i++) game.pick(4);
    expect(game.round().faceUp).toEqual([4]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Play Again deals a fresh, shuffled round and cancels a pending turn-back', () => {
    const game = createMemoryMatch({ random: seededRandom(5) });
    const first = game.round();
    const [a, b] = mismatchIn(first);
    game.pick(a);
    game.pick(b);
    game.playAgain();
    const fresh = game.round();
    expect(fresh).toMatchObject({ faceUp: [], status: 'playing' });
    expect(fresh.cards.every(card => !card.matched)).toBe(true);
    expect(fresh.cards.map(c => c.symbol)).not.toEqual(first.cards.map(c => c.symbol));
    expect(vi.getTimerCount()).toBe(0);
    game.pick(0);
    vi.advanceTimersByTime(MISMATCH_MS * 2);
    expect(game.round().faceUp).toEqual([0]);
  });

  it('Play Again after a win starts over', () => {
    const game = createMemoryMatch({ random: seededRandom(9) });
    const deal = game.round();
    for (const { id } of SYMBOLS) pairOf(deal, id).forEach(i => game.pick(i));
    expect(game.round().status).toBe('won');
    game.playAgain();
    expect(game.round().status).toBe('playing');
    expect(pairsFound(game.round())).toBe(0);
  });

  it('closing the dialog turns a pending mismatch back at once, and the old timer never fires', () => {
    const game = createMemoryMatch({ random: seededRandom(11) });
    const deal = game.round();
    const [m1, m2] = pairOf(deal, 'heart');
    game.pick(m1);
    game.pick(m2);
    const firstUnmatched = deal.cards.findIndex((_, i) => i !== m1 && i !== m2);
    const other = deal.cards.findIndex((card, i) => i !== m1 && i !== m2 && card.symbol !== deal.cards[firstUnmatched].symbol);
    game.pick(firstUnmatched);
    game.pick(other);
    expect(game.round().status).toBe('mismatch');
    game.pause();
    const paused = game.round();
    expect(paused).toMatchObject({ faceUp: [], status: 'playing' });
    expect(pairsFound(paused)).toBe(1); // the unfinished round is kept
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(MISMATCH_MS * 2);
    expect(game.round()).toBe(paused);
  });

  it('closing with one card face up keeps it face up for when the dialog reopens', () => {
    const game = createMemoryMatch({ random: seededRandom(11) });
    game.pick(2);
    game.pause();
    expect(game.round().faceUp).toEqual([2]);
  });

  it('listeners hear each change once, and can unsubscribe', () => {
    const game = createMemoryMatch({ random: seededRandom(13) });
    const listener = vi.fn();
    const stop = game.subscribe(listener);
    game.pick(0);
    game.pause(); // nothing to turn back: no change
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    game.playAgain();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('randomness', () => {
  afterEach(() => {
    delete (globalThis as { __emberMemoryMatchSeed?: unknown }).__emberMemoryMatchSeed;
  });

  it('a seed gives the same deals every time (for browser tests)', () => {
    const deal = (random: () => number) => [newRound(random), newRound(random)].map(r => r.cards.map(c => c.symbol).join());
    expect(deal(seededRandom(99))).toEqual(deal(seededRandom(99)));
    expect(deal(seededRandom(99))).not.toEqual(deal(seededRandom(100)));
  });

  it('players get Math.random; only a numeric test seed changes that', () => {
    expect(gameRandom()).toBe(Math.random);
    (globalThis as { __emberMemoryMatchSeed?: unknown }).__emberMemoryMatchSeed = 'nope';
    expect(gameRandom()).toBe(Math.random);
    (globalThis as { __emberMemoryMatchSeed?: unknown }).__emberMemoryMatchSeed = 99;
    expect(gameRandom()()).toBe(seededRandom(99)());
  });
});
