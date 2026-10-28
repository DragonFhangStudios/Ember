import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GAP_MS, PADS, PadId, PatternGame, ROUNDS, ROUND_LENGTHS, STEP_MS, createPatternChallenge, finishShowing, light, newGame, newPattern, nextRound,
  patternInWords, press, roundPattern, startShowing, stopShowing,
} from './patternChallenge';
import { randomFor, seededRandom } from './seededRandom';
import { DISCOVERIES } from './expeditions';

/** Ready for the player's turn in the current round. */
const yourTurn = (game: PatternGame) => finishShowing(startShowing(game));
const enter = (game: PatternGame, pads: readonly PadId[]) => pads.reduce(press, game);
/** A symbol that isn't the next one wanted. */
const wrongAfter = (game: PatternGame) => PADS.map(p => p.id).find(id => id !== roundPattern(game)[game.entered.length] && id !== game.entered[game.entered.length - 1])!;
/** Plays one round perfectly, from 'ready'. */
const playRound = (game: PatternGame) => enter(yourTurn(game), roundPattern(game));

describe('patterns', () => {
  it('has four distinct symbols, each with a name', () => {
    expect(PADS).toHaveLength(4);
    expect(new Set(PADS.map(p => p.id)).size).toBe(4);
    expect(new Set(PADS.map(p => p.name)).size).toBe(4);
  });

  it('three rounds ask for two, three, then four symbols, one pattern growing', () => {
    expect(ROUND_LENGTHS).toEqual([2, 3, 4]);
    let game = newGame(seededRandom(1));
    const lengths: number[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      lengths.push(roundPattern(game).length);
      expect(roundPattern(game)).toEqual(game.pattern.slice(0, ROUND_LENGTHS[round]));
      game = nextRound(playRound(game));
    }
    expect(lengths).toEqual([2, 3, 4]);
  });

  it('every pattern uses known symbols and never repeats one back to back', () => {
    const random = seededRandom(5);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const pattern = newPattern(random);
      expect(pattern).toHaveLength(4);
      pattern.forEach((pad, j) => {
        expect(PADS.map(p => p.id)).toContain(pad);
        if (j > 0) expect(pad).not.toBe(pattern[j - 1]);
      });
      seen.add(pattern.join());
    }
    expect(seen.size, 'many different patterns').toBeGreaterThan(80); // 4 × 3 × 3 × 3 = 108 possible
  });

  it('copes with a random source at its upper edge', () => {
    const pattern = newPattern(() => 0.9999999999999999);
    pattern.forEach((pad, j) => j > 0 && expect(pad).not.toBe(pattern[j - 1]));
  });

  it('a seed gives the same patterns every time (for browser tests); players get Math.random', () => {
    const deal = (random: () => number) => [newPattern(random), newPattern(random)];
    expect(deal(seededRandom(3))).toEqual(deal(seededRandom(3)));
    expect(deal(seededRandom(3))).not.toEqual(deal(seededRandom(4)));
    expect(randomFor('__emberPatternSeed')).toBe(Math.random);
    (globalThis as Record<string, unknown>).__emberPatternSeed = 3;
    expect(randomFor('__emberPatternSeed')()).toBe(seededRandom(3)());
    delete (globalThis as Record<string, unknown>).__emberPatternSeed;
  });

  it('reads as words, for anyone who would rather not rely on watching', () => {
    const game: PatternGame = { ...newGame(), pattern: ['flower', 'paw', 'raindrop', 'snowflake'] };
    expect(patternInWords(game)).toBe('Flower, then Paw print');
    expect(patternInWords({ ...game, round: 2 })).toBe('Flower, then Paw print, then Raindrop, then Snowflake');
  });

  it("uses no expedition keepsake as a symbol", () => {
    const keepsakes = Object.values(DISCOVERIES).map(d => d.name.toLowerCase());
    for (const { name } of PADS) expect(keepsakes.some(k => k.includes(name.toLowerCase())), name).toBe(false);
  });
});

describe('repeating a pattern', () => {
  const game = newGame(seededRandom(8));

  it('presses only count on the player\'s turn: not before the pattern is shown, nor while it is showing', () => {
    expect(press(game, game.pattern[0])).toBe(game);
    const showing = light(startShowing(game), 0);
    for (const { id } of PADS) expect(press(showing, id)).toBe(showing);
  });

  it('the right symbols in order finish the round', () => {
    const turn = yourTurn(game);
    const half = press(turn, game.pattern[0]);
    expect(half).toMatchObject({ phase: 'repeat', entered: [game.pattern[0]], missed: false });
    expect(press(half, game.pattern[1])).toMatchObject({ phase: 'roundDone', entered: game.pattern.slice(0, 2) });
  });

  it('a wrong symbol starts the attempt over, gently: same round, same pattern, nothing lost', () => {
    const turn = press(yourTurn(game), game.pattern[0]);
    const missed = press(turn, wrongAfter(turn));
    expect(missed).toMatchObject({ phase: 'repeat', round: 0, entered: [], missed: true, pattern: game.pattern });
    const again = enter(missed, roundPattern(game));
    expect(again).toMatchObject({ phase: 'roundDone', missed: false });
  });

  it('retrying is unlimited', () => {
    let turn = yourTurn(game);
    for (let i = 0; i < 25; i++) turn = press(turn, wrongAfter(turn));
    expect(turn).toMatchObject({ phase: 'repeat', round: 0, missed: true });
    expect(enter(turn, roundPattern(game)).phase).toBe('roundDone');
  });

  it('a double tap on the same symbol counts once', () => {
    const once = press(yourTurn(game), game.pattern[0]);
    expect(press(once, game.pattern[0])).toBe(once);
  });

  it('unknown symbols are ignored', () => {
    const turn = yourTurn(game);
    expect(press(turn, 'dragon' as PadId)).toBe(turn);
  });

  it('the pattern can be shown again any number of times, which starts the attempt afresh', () => {
    let turn = press(yourTurn(game), game.pattern[0]);
    for (let i = 0; i < 10; i++) {
      turn = startShowing(turn);
      expect(turn).toMatchObject({ phase: 'showing', entered: [], missed: false });
      turn = finishShowing(turn);
    }
    expect(enter(turn, roundPattern(game)).phase).toBe('roundDone');
  });

  it('a finished round waits for the player; presses and replays are ignored until then', () => {
    const done = playRound(game);
    expect(startShowing(done)).toBe(done);
    for (const { id } of PADS) expect(press(done, id)).toBe(done);
    expect(nextRound(done)).toMatchObject({ round: 1, phase: 'ready', entered: [] });
    expect(nextRound(yourTurn(game))).toMatchObject({ round: 0 });
  });

  it('all three rounds win the game; after that, presses are ignored', () => {
    let g = game;
    for (let round = 0; round < ROUNDS - 1; round++) g = nextRound(playRound(g));
    const won = playRound(g);
    expect(won.phase).toBe('won');
    expect(startShowing(won)).toBe(won);
    for (const { id } of PADS) expect(press(won, id)).toBe(won);
    expect(nextRound(won)).toBe(won);
  });

  it('counts the steps shown, holding the count between steps', () => {
    let showing = startShowing(game);
    expect(showing.shown).toBe(0);
    showing = light(showing, 0);
    expect(showing).toMatchObject({ lit: 0, shown: 1 });
    showing = light(showing, null);
    expect(showing).toMatchObject({ lit: null, shown: 1 });
    expect(light(showing, 1).shown).toBe(2);
    expect(startShowing(finishShowing(light(showing, 1))).shown).toBe(0);
  });

  it('stopping a showing goes back to ready; nothing else is touched', () => {
    const showing = light(startShowing(game), 1);
    expect(stopShowing(showing)).toMatchObject({ phase: 'ready', lit: null, round: 0 });
    const turn = press(yourTurn(game), game.pattern[0]);
    expect(stopShowing(turn)).toBe(turn);
  });
});

describe('a game for the page session', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Which step is lit at each moment of a showing. */
  const timeline = (challenge: ReturnType<typeof createPatternChallenge>) => {
    const seen: (number | null)[] = [];
    const stop = challenge.subscribe(() => seen.push(challenge.game().lit));
    return { seen, stop };
  };

  it('shows each step in turn, lit then rested, then hands over to the player', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    const { seen } = timeline(challenge);
    challenge.show();
    expect(challenge.game().phase).toBe('showing');
    vi.advanceTimersByTime(GAP_MS);
    expect(challenge.game().lit).toBe(0);
    vi.advanceTimersByTime(STEP_MS - 1);
    expect(challenge.game().lit).toBe(0);
    vi.advanceTimersByTime(1);
    expect(challenge.game().lit).toBeNull();
    vi.advanceTimersByTime(GAP_MS + STEP_MS + GAP_MS);
    expect(challenge.game()).toMatchObject({ phase: 'repeat', lit: null });
    expect(seen).toEqual([null, 0, null, 1, null, null]);
    expect(challenge.game().shown).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('presses during a showing are ignored', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    challenge.show();
    vi.advanceTimersByTime(GAP_MS);
    const showing = challenge.game();
    for (const { id } of PADS) challenge.press(id);
    expect(challenge.game()).toBe(showing);
  });

  it('a whole game, then Play Again: a fresh pattern back at round one', () => {
    const challenge = createPatternChallenge({ random: seededRandom(6) });
    const first = challenge.game().pattern;
    for (let round = 0; round < ROUNDS; round++) {
      challenge.show();
      vi.runAllTimers();
      roundPattern(challenge.game()).forEach(pad => challenge.press(pad));
      if (round < ROUNDS - 1) challenge.nextRound();
    }
    expect(challenge.game().phase).toBe('won');
    challenge.playAgain();
    expect(challenge.game()).toMatchObject({ round: 0, phase: 'ready', entered: [], missed: false });
    expect(challenge.game().pattern).not.toEqual(first);
  });

  it('showing again mid-showing is ignored; once it ends, it can be shown again', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    challenge.show();
    vi.advanceTimersByTime(GAP_MS + 10);
    challenge.show();
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    challenge.show();
    expect(challenge.game().phase).toBe('showing');
  });

  it('closing mid-showing stops it at once and leaves no timer behind', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    challenge.show();
    vi.advanceTimersByTime(GAP_MS + 100);
    challenge.pause();
    const paused = challenge.game();
    expect(paused).toMatchObject({ phase: 'ready', lit: null });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(challenge.game()).toBe(paused);
  });

  it('Play Again mid-showing cancels it', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    challenge.show();
    vi.advanceTimersByTime(GAP_MS);
    challenge.playAgain();
    expect(vi.getTimerCount()).toBe(0);
    expect(challenge.game()).toMatchObject({ phase: 'ready', lit: null });
  });

  it('closing on the player\'s turn keeps their progress for when the dialog reopens', () => {
    const challenge = createPatternChallenge({ random: seededRandom(2) });
    challenge.show();
    vi.runAllTimers();
    challenge.press(challenge.game().pattern[0]);
    challenge.pause();
    expect(challenge.game()).toMatchObject({ phase: 'repeat', entered: [challenge.game().pattern[0]] });
  });
});
