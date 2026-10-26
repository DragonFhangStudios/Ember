import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
import { advanceQuest, createInitialState, migrateState, rollOverDay } from './progression';
import { evolutionLine, pendingEvolution, seeEvolution, stagesReached } from './milestones';

const { EGG, HATCHLING, FLEDGLING, DRAKE } = DragonStage;
const day = (d: number, hour = 10) => new Date(2026, 9, d, hour);
const reload = (state: UserState, now: Date) => migrateState(JSON.parse(JSON.stringify(state)), now);
/** One quest step on day `d` (a meaningful activity, so an active day). */
const questOn = (state: UserState, d: number, id = 'q1') => advanceQuest(rollOverDay(state, day(d)), id, day(d)).state;
/** A new player whose second active day (Oct 21) makes Ember a Hatchling. */
const hatchingDay = () => questOn(questOn(createInitialState(day(20, 9)), 20), 21);

describe('evolution reveals: a new stage waits until the player sees it', () => {
  it('reaching a stage leaves a pending reveal that more quest taps and a reload never erase (the missed milestone)', () => {
    let state = hatchingDay();
    expect(state.stage).toBe(HATCHLING);
    expect(pendingEvolution(state)).toBe(HATCHLING);
    for (const id of ['q2', 'q3', 'q4']) state = questOn(state, 21, id);
    state = reload(state, day(21, 18));
    expect(pendingEvolution(state)).toBe(HATCHLING);
    expect(pendingEvolution(reload(rollOverDay(state, day(25)), day(25))), 'days later').toBe(HATCHLING);
  });

  it('records the day each stage was reached', () => {
    expect(hatchingDay().stageReachedOn).toEqual({ [HATCHLING]: '2026-10-21' });
  });

  it('seeing the reveal clears it for good and changes nothing else', () => {
    const before = hatchingDay();
    const seen = seeEvolution(before, HATCHLING);
    expect(pendingEvolution(seen)).toBeNull();
    expect({ ...seen, stageSeen: before.stageSeen }).toEqual(before);
    expect(pendingEvolution(reload(seen, day(22)))).toBeNull();
    // Seeing it again (a replay, or another tab) changes nothing at all.
    expect(seeEvolution(seen, HATCHLING)).toBe(seen);
    expect(seeEvolution(seen, EGG)).toBe(seen);
  });

  it('two tabs finishing in any order agree, and nothing past the reached stage is marked seen', () => {
    const state = { ...hatchingDay(), stage: FLEDGLING, stageSeen: EGG };
    const ab = seeEvolution(seeEvolution(state, FLEDGLING), HATCHLING);
    const ba = seeEvolution(seeEvolution(state, HATCHLING), FLEDGLING);
    expect(ab.stageSeen).toBe(FLEDGLING);
    expect(ba.stageSeen).toBe(FLEDGLING);
    expect(seeEvolution(state, DRAKE).stageSeen, 'never beyond the stage reached').toBe(FLEDGLING);
  });

  it('a new game starts with nothing pending; starting over does too', () => {
    const fresh = createInitialState(day(20));
    expect(fresh.stageSeen).toBe(EGG);
    expect(pendingEvolution(fresh)).toBeNull();
  });

  it('an existing advanced save (upgraded, imported or restored) never announces stages it reached before', () => {
    const { stageSeen: _s, stageReachedOn: _r, ...old } = { ...createInitialState(day(1)), stage: DRAKE };
    const upgraded = reload(old as UserState, day(20));
    expect(upgraded.stageSeen).toBe(DRAKE);
    expect(pendingEvolution(upgraded)).toBeNull();
    expect(upgraded.stageReachedOn, 'no invented dates').toEqual({});
  });

  it('a save exported with a reveal still waiting keeps it waiting, with its real date', () => {
    const exported = hatchingDay();
    const imported = reload(exported, day(30));
    expect(pendingEvolution(imported)).toBe(HATCHLING);
    expect(imported.stageReachedOn).toEqual({ [HATCHLING]: '2026-10-21' });
  });

  it('ignores invalid saved values', () => {
    const base = hatchingDay();
    const odd = reload({ ...base, stageSeen: 'Dragonlord' as DragonStage, stageReachedOn: { Hatchling: 'yesterday', Bogus: '2026-10-01', Egg: '2026-10-20' } as never }, day(22));
    expect(odd.stageSeen, 'unreadable = already seen').toBe(HATCHLING);
    expect(odd.stageReachedOn).toEqual({ [EGG]: '2026-10-20' });
    expect(reload({ ...base, stageSeen: DRAKE }, day(22)).stageSeen, 'never beyond the stage reached').toBe(HATCHLING);
  });

  it('every stage after the egg has its own reveal line, and the journey lists stages reached', () => {
    expect(evolutionLine(EGG)).toBeUndefined();
    expect(evolutionLine(HATCHLING)?.text).toMatch(/crack… crack/);
    for (const stage of [FLEDGLING, DRAKE, DragonStage.ANCIENT]) expect(evolutionLine(stage)).toBeDefined();
    expect(stagesReached(hatchingDay())).toEqual([EGG, HATCHLING]);
  });
});
