import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../../types';
import { advanceQuest, createInitialState, feedDragon, logCheckIn, petDragon } from '../progression';
import { settle, startFocus, pauseFocus } from '../focusSession';
import { DialogueContext, LIBRARY } from './library';
import { FOUNDER_CAUGHT_MS, candidates, createSpeaker, render, tapContext, timeOfDay } from './select';
import { LONG_AWAY_DAYS, isSoftDay, momentFor, openingMoment } from './events';

const { EGG, HATCHLING, FLEDGLING, DRAKE, ANCIENT } = DragonStage;
const STAGES = [EGG, HATCHLING, FLEDGLING, DRAKE, ANCIENT];
const HATCHED = [HATCHLING, FLEDGLING, DRAKE, ANCIENT];
const NOW = new Date(2026, 9, 21, 9, 30);
const CONTEXTS = Object.keys(LIBRARY) as DialogueContext[];

/** A seeded random number generator, so tests are repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const as = (stage: DragonStage, extra: Partial<{ soft: boolean; playerName: string; level: number }> = {}) => ({
  stage,
  dragonName: 'Ember',
  ...extra,
});

describe('dialogue library', () => {
  const everyStage: DialogueContext[] = [
    'greeting.morning', 'greeting.afternoon', 'greeting.evening', 'greeting.lateNight',
    'return.oneDay', 'return.napping', 'return.wake', 'return.longAway',
    'quest.first', 'quest.more', 'quest.allDone', 'quest.hydration',
    'focus.start', 'focus.paused', 'focus.finished', 'focus.finishedAway', 'focus.bondComplete',
    'checkIn.good', 'checkIn.middle', 'checkIn.low', 'checkIn.updated',
    'care.pet', 'care.alreadyPetted', 'bond.levelUp', 'idle', 'support',
  ];

  it('has something to say in every context at every stage that can reach it', () => {
    for (const context of everyStage) {
      for (const stage of STAGES) expect(candidates(context, as(stage)).length, `${context} @ ${stage}`).toBeGreaterThan(0);
    }
    for (const stage of HATCHED) {
      for (const context of ['care.feed', 'care.full', 'founder', 'founder.caught'] as const) {
        expect(candidates(context, as(stage)).length, `${context} @ ${stage}`).toBeGreaterThan(0);
      }
      expect(candidates('evolution', as(stage)), `one evolution line for ${stage}`).toHaveLength(1);
    }
    expect(candidates('care.incubate', as(EGG)).length).toBeGreaterThan(0);
  });

  it('on a hard day, every context is gentle at every stage', () => {
    for (const context of CONTEXTS.filter(c => !c.startsWith('founder'))) {
      for (const stage of STAGES) {
        for (const line of candidates(context, as(stage, { soft: true }))) expect(line.gentle, `${line.id} in ${context}`).toBe(true);
      }
    }
  });

  it('gives each line one id and one text', () => {
    const texts = new Map<string, string>();
    for (const context of CONTEXTS) {
      const ids = LIBRARY[context].map(l => l.id);
      expect(new Set(ids).size, `duplicate ids in ${context}`).toBe(ids.length);
      for (const line of LIBRARY[context]) {
        expect(texts.get(line.id) ?? line.text, line.id).toBe(line.text);
        texts.set(line.id, line.text);
      }
    }
  });

  it('keeps the egg wordless (narration only)', () => {
    const approvedSpeech = ['incubate-wiggles']; // v0.2: "*the egg wiggles* Someone in here likes that."
    for (const context of CONTEXTS) {
      for (const line of LIBRARY[context].filter(l => l.stages?.length === 1 && l.stages[0] === EGG)) {
        if (approvedSpeech.includes(line.id)) continue;
        expect(line.text.replace(/\*[^*]*\*/g, '').trim(), line.id).toMatch(/^[\s.…]*$/);
      }
    }
  });

  it('never uses guilt, pressure, or medical phrasing', () => {
    const BANNED = [
      /\bmiss(ed)? you\b/i, /\bwhere were you\b/i, /\byou (forgot|failed|abandoned|left me)\b/i,
      /\b(don'?t|do not) lose\b/i, /\byou (should|must|need to|have to|ought to)\b/i,
      /\bdisappoint/i, /\blonely\b/i, /\bsad\b/i, /\bguilt/i, /\bhurry\b/i, /\blast chance\b/i, /\btoo late\b/i,
      /\bstreak\b/i, /\bwhy didn'?t you\b/i, /\bcure|heal|diagnos|therap|treatment|prescri|symptom/i,
    ];
    for (const context of CONTEXTS) {
      for (const line of LIBRARY[context]) {
        for (const pattern of BANNED) expect(line.text, `${line.id} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('renders placeholders: with a name, without one, and the Bond level', () => {
    expect(render('Good morning, {playerName}! Hi.', as(HATCHLING))).toBe('Good morning! Hi.');
    expect(render('Hello, {playerName}. Today', as(HATCHLING))).toBe('Hello. Today');
    expect(render('Good morning, {playerName}!', as(HATCHLING, { playerName: 'Andrew' }))).toBe('Good morning, Andrew!');
    expect(render('Bond level {level}! {dragonName}', as(HATCHLING, { level: 4 }))).toBe('Bond level 4! Ember');
    for (const context of CONTEXTS) {
      for (const line of LIBRARY[context]) expect(render(line.text, as(HATCHLING, { level: 2 })), line.id).not.toMatch(/[{}]|\s,|\s{2}/);
    }
  });
});

describe('choosing lines', () => {
  it('uses the local time of day', () => {
    const at = (h: number, m = 0) => timeOfDay(new Date(2026, 9, 21, h, m));
    expect([at(4, 59), at(5), at(11, 59), at(12), at(16, 59), at(17), at(20, 59), at(21), at(0)]).toEqual([
      'lateNight', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'lateNight', 'lateNight',
    ]);
  });

  it('never says the same line twice in a row, and says every line once per round', () => {
    for (const seed of [1, 2, 3, 42]) {
      const speaker = createSpeaker(seeded(seed));
      const pool = candidates('idle', as(DRAKE));
      let last = '';
      for (let round = 0; round < 5; round++) {
        const seen = new Set<string>();
        for (let i = 0; i < pool.length; i++) {
          const line = speaker.say('idle', as(DRAKE))!;
          expect(line.text).not.toBe(last);
          last = line.text;
          seen.add(line.id);
        }
        expect(seen.size, `round ${round} covers the pool`).toBe(pool.length);
      }
    }
  });

  it('never repeats the same text across contexts either', () => {
    const speaker = createSpeaker(seeded(7));
    let last = '';
    for (let i = 0; i < 300; i++) {
      const context = (['idle', 'support', 'quest.first'] as const)[i % 3];
      const line = speaker.say(context, as(HATCHLING, { soft: true }))!;
      expect(line.text).not.toBe(last);
      last = line.text;
    }
  });

  it('speaks for the stage: wordless egg, stage-specific petting and evolution', () => {
    const speaker = createSpeaker(seeded(3));
    expect(speaker.say('care.pet', as(EGG))!.text).toBe('*the shell glows warm under your hand*');
    expect(speaker.say('care.pet', as(ANCIENT))!.text).toMatch(/You still do it just right/);
    expect(speaker.say('evolution', as(ANCIENT))!.text).toBe(
      "Look how far we've come together. And guess what? Our adventure's only beginning!",
    );
    for (let i = 0; i < 20; i++) expect(speaker.say('idle', as(EGG))!.text.startsWith('*')).toBe(true);
  });

  it('is soft on a hard day', () => {
    const speaker = createSpeaker(seeded(9));
    for (let i = 0; i < 40; i++) {
      const line = speaker.say('quest.more', as(FLEDGLING, { soft: true }))!;
      expect(LIBRARY.support.some(l => l.id === line.id), line.id).toBe(true);
    }
  });

  it('keeps the founder Easter egg to developer builds (and gets caught if tapped again)', () => {
    const base = { napping: false, soft: false, msSinceFounderLine: null, stage: HATCHLING };
    expect(tapContext({ ...base, developerBuild: false, random: 0 })).toBe('idle');
    expect(tapContext({ ...base, developerBuild: true, random: 0 })).toBe('founder');
    expect(tapContext({ ...base, developerBuild: true, random: 0.5 })).toBe('idle');
    expect(tapContext({ ...base, developerBuild: true, random: 0.5, msSinceFounderLine: FOUNDER_CAUGHT_MS })).toBe('founder.caught');
    expect(tapContext({ ...base, developerBuild: true, random: 0.5, msSinceFounderLine: FOUNDER_CAUGHT_MS + 1 })).toBe('idle');
    expect(tapContext({ ...base, developerBuild: true, random: 0, stage: EGG })).toBe('idle');
    expect(tapContext({ ...base, developerBuild: true, random: 0, napping: true })).toBe('return.napping');
    expect(tapContext({ ...base, developerBuild: true, random: 0, soft: true }), 'not on a hard day').toBe('idle');
  });
});

describe('moments', () => {
  const fresh = (stage = HATCHLING): UserState => ({ ...createInitialState(NOW), stage });
  const moment = (before: UserState, after: UserState, intent?: Parameters<typeof momentFor>[2], away = 0) =>
    momentFor(before, after, intent, NOW, away)?.context ?? null;

  it('reacts to quests: first, more, hydration, all done', () => {
    let s = fresh();
    const step = (id: string) => {
      const next = advanceQuest(s, id, NOW).state;
      const m = moment(s, next, 'quest');
      s = next;
      return m;
    };
    expect(step('q1')).toBe('quest.first');
    expect(step('q5')).toBe('quest.hydration'); // a step toward the hydration goal
    expect(step('q2')).toBe('quest.more');
    expect(step('q1')).toBeNull(); // already done: nothing changed
  });

  it('celebrates when every daily quest is done', () => {
    let s = fresh();
    const ids = s.quests.filter(q => q.isDaily).flatMap(q => Array(q.target).fill(q.id));
    let last: string | null = null;
    for (const id of ids) {
      const next = advanceQuest(s, id, NOW).state;
      last = moment(s, next, 'quest');
      s = next;
    }
    expect(last).toBe('quest.allDone');
  });

  it('answers check-ins by mood, and notices an updated one', () => {
    const s = fresh();
    expect(moment(s, logCheckIn(s, 3, 5, NOW).state, 'checkIn')).toBe('checkIn.good');
    expect(moment(s, logCheckIn(s, 3, 3, NOW).state, 'checkIn')).toBe('checkIn.middle');
    const low = logCheckIn(s, 3, 2, NOW).state;
    expect(moment(s, low, 'checkIn')).toBe('checkIn.low');
    expect(isSoftDay(low, NOW)).toBe(true);
    expect(isSoftDay(low, new Date(2026, 9, 22, 9))).toBe(false); // a new day starts fresh
    expect(moment(low, logCheckIn(low, 3, 4, NOW).state, 'checkIn')).toBe('checkIn.updated');
  });

  it('reacts to care: petting, already petted, feeding, full, incubating', () => {
    const s = fresh();
    const petted = petDragon(s, NOW).state;
    expect(moment(s, petted, 'pet')).toBe('care.pet');
    expect(moment(petted, petDragon(petted, NOW).state, 'pet')).toBe('care.alreadyPetted');
    let fed = s;
    for (let i = 0; i < 3; i++) fed = feedDragon(fed, NOW).state;
    expect(moment(s, feedDragon(s, NOW).state, 'feed')).toBe('care.feed');
    expect(moment(fed, feedDragon(fed, NOW).state, 'feed')).toBe('care.full');
    const egg = fresh(EGG);
    expect(moment(egg, feedDragon(egg, NOW).state, 'feed')).toBe('care.incubate');
  });

  it('reacts to focus: start, pause, finished now or while away', () => {
    const s = fresh();
    const running = startFocus(s, 'f1', NOW);
    expect(moment(s, running, 'focusStart')).toBe('focus.start');
    expect(moment(running, pauseFocus(running, 'f1', new Date(NOW.getTime() + 1000)), 'focusPause')).toBe('focus.paused');
    const done = settle(running, new Date(NOW.getTime() + 11 * 60_000)).state;
    expect(moment(running, done, undefined)).toBe('focus.finished');
    expect(moment(running, done, 'open')).toBe('focus.finishedAway');
  });

  it('puts evolution and Bond level-ups first', () => {
    const s = fresh(EGG);
    expect(moment(s, { ...s, stage: HATCHLING }, 'quest')).toBe('evolution');
    const m = momentFor(s, { ...s, bond: { local: 25 } }, 'quest', NOW, 0);
    expect(m).toEqual({ context: 'bond.levelUp', level: 2 });
  });

  it('wakes gently from a nap, sleepier after a long time away', () => {
    const napping = { ...fresh(), isNapping: true };
    const awake = { ...napping, isNapping: false };
    expect(moment(napping, awake, 'pet', 3)).toBe('return.wake');
    expect(moment(napping, awake, 'pet', LONG_AWAY_DAYS)).toBe('return.longAway');
  });

  it('opens with a nap, a welcome back, or a greeting for the time of day', () => {
    expect(openingMoment({ ...fresh(), isNapping: true }, 5, NOW).context).toBe('return.napping');
    expect(openingMoment(fresh(), 1, NOW).context).toBe('return.oneDay');
    expect(openingMoment(fresh(), 0, NOW).context).toBe('greeting.morning');
    expect(openingMoment(fresh(), 0, new Date(2026, 9, 21, 23)).context).toBe('greeting.lateNight');
  });
});
