import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DragonStage } from '../types';
import { seededRandom } from './seededRandom';
import { SILLY_CHANCE, START, TRICKS, TRICK_IDS, TrickView, begin, fillName, finish, invite, tricksOpen } from './tricks';

const always = (value: number) => () => value;
/** Plays a trick start to finish. */
const perform = (trick: (typeof TRICK_IDS)[number], choice: string, random: () => number, from: TrickView = START) =>
  finish(invite(begin(from, trick), random), choice, random);

describe('the two tricks', () => {
  it('are exactly Little Wave and Tiny Twirl, each with two ways to go', () => {
    expect(TRICK_IDS).toEqual(['wave', 'twirl']);
    expect(Object.keys(TRICKS)).toEqual(['wave', 'twirl']);
    expect(TRICKS.wave.name).toBe('Little Wave');
    expect(TRICKS.twirl.name).toBe('Tiny Twirl');
    for (const id of TRICK_IDS) {
      const { choices, lines, cheers } = TRICKS[id];
      expect(choices).toHaveLength(2);
      expect(new Set(choices.map(c => c.id)).size).toBe(2);
      expect(lines.length).toBeGreaterThan(1);
      expect(cheers.length).toBeGreaterThan(1);
    }
  });

  it('are gentle and silly, never pressuring, with nothing to fail, practise or master', () => {
    const BANNED = [
      /\b(fail|failed|lost|hurt|injur|danger|scary|afraid|dead|die|sad|cry|punish|wrong|bad|mistake)\b/i,
      /\b(practi[cs]e|train|training|level|master|mastery|skill|unlock|score|points?|reward|streak|try harder)\b/i,
      /\byou (should|must|need to|have to)\b/i, /\bhurry\b/i, /\bmiss(ed)? you\b/i,
    ];
    const texts = TRICK_IDS.flatMap(id => {
      const t = TRICKS[id];
      return [t.name, t.blurb, t.scene, t.invite, t.response, t.question, ...t.lines, ...t.cheers, ...t.choices.flatMap(c => [c.label, c.story, c.silly])];
    });
    for (const text of texts) for (const pattern of BANNED) expect(text, `${text} matches ${pattern}`).not.toMatch(pattern);
    for (const text of texts) expect(text.split(/\s+/).length, text).toBeLessThan(35);
  });

  it("fill in the dragon's name everywhere and leave no placeholders", () => {
    for (const id of TRICK_IDS) {
      const t = TRICKS[id];
      for (const text of [t.scene, t.response, ...t.choices.flatMap(c => [c.story, c.silly])]) {
        const filled = fillName(text, 'Pip');
        expect(filled).not.toMatch(/[{}]/);
        if (text.includes('{dragonName}')) expect(filled).toContain('Pip');
      }
    }
  });
});

describe('doing a trick', () => {
  it('goes pick → invite → response → finale, for both tricks and every choice', () => {
    for (const id of TRICK_IDS) {
      for (const choice of TRICKS[id].choices) {
        const invited = begin(START, id);
        expect(invited).toEqual({ step: 'invite', trick: id });
        const responded = invite(invited, always(0));
        expect(responded).toEqual({ step: 'response', trick: id, line: TRICKS[id].lines[0] });
        const done = finish(responded, choice.id, always(0.99));
        expect(done).toEqual({ step: 'finale', trick: id, choice: choice.id, story: choice.story, silly: false, cheer: TRICKS[id].cheers[TRICKS[id].cheers.length - 1] });
      }
    }
  });

  it('now and then goes the silly way', () => {
    const done = perform('twirl', 'left', always(SILLY_CHANCE / 2));
    expect(done).toMatchObject({ step: 'finale', silly: true, story: TRICKS.twirl.choices[0].silly });
    const random = seededRandom(1);
    let silly = 0;
    for (let i = 0; i < 1000; i++) if ((perform('wave', 'big', random) as { silly: boolean }).silly) silly++;
    expect(silly).toBeGreaterThan(130);
    expect(silly).toBeLessThan(270);
  });

  it('can be repeated forever, and switched to the other trick, with nothing building up', () => {
    let view: TrickView = START;
    const random = seededRandom(9);
    for (let i = 0; i < 50; i++) {
      const trick = TRICK_IDS[i % 2];
      view = perform(trick, TRICKS[trick].choices[i % 2].id, random, view);
      expect(view.step).toBe('finale');
      expect(Object.keys(view).sort()).toEqual(['cheer', 'choice', 'silly', 'step', 'story', 'trick']);
    }
  });

  it('ignores steps out of order and unknown choices or tricks', () => {
    expect(invite(START)).toBe(START);
    expect(finish(START, 'big')).toBe(START);
    const invited = begin(START, 'wave');
    expect(begin(invited, 'twirl')).toBe(invited);
    expect(finish(invited, 'big')).toBe(invited);
    const responded = invite(invited);
    expect(finish(responded, 'left')).toBe(responded); // a twirl choice, not a wave one
    expect(invite(responded)).toBe(responded);
    expect(begin(START, 'backflip' as never)).toBe(START);
  });

  it('a new visit starts from the list again', () => {
    expect(START).toEqual({ step: 'pick' });
  });
});

describe('the egg', () => {
  it('gets tricks only once hatched', () => {
    expect(tricksOpen(DragonStage.EGG)).toBe(false);
    for (const stage of Object.values(DragonStage).filter(s => s !== DragonStage.EGG)) expect(tricksOpen(stage)).toBe(true);
  });
});

describe('nothing is saved or earned', () => {
  it('trick logic never touches the save: it imports no save code and takes no player state', () => {
    const source = readFileSync(new URL('./tricks.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    expect(imports).toEqual(['../types']);
    expect(source).not.toMatch(/UserState|progression|store|localStorage|indexedDB/);
  });
});
