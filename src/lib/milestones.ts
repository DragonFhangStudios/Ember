import { DragonStage, UserState } from '../types';
import { STAGE_ORDER, higherStage } from './evolution';
import { LIBRARY, Line } from './dialogue/library';

// Evolution reveals: reaching a new stage is kept as a pending reveal in the
// save until the player chooses to see it, then stays replayable from
// Milestones. Seeing or replaying a reveal never grants anything.

const order = (stage: DragonStage) => STAGE_ORDER.indexOf(stage);

/** The stage whose reveal is waiting to be seen, if any (always the stage reached). */
export function pendingEvolution(state: UserState): DragonStage | null {
  const seen = state.stageSeen ?? state.stage;
  return order(state.stage) > order(seen) ? state.stage : null;
}

/**
 * Marks the reveal of `stage` (and every stage before it) as seen. Only ever
 * moves forward and never past the stage reached, so two tabs agree whatever
 * order they finish in. Changes nothing else.
 */
export function seeEvolution(state: UserState, stage: DragonStage): UserState {
  const seen = higherStage(state.stageSeen ?? state.stage, order(stage) <= order(state.stage) ? stage : state.stage);
  return seen === state.stageSeen ? state : { ...state, stageSeen: seen };
}

/** A reveal being shown: the first time, or a replay from Milestones. */
export interface RevealView {
  stage: DragonStage;
  replay: boolean;
}

/** How a reveal closed: Finish, or set aside for now (Escape, the backdrop). */
export type RevealEnd = 'finished' | 'dismissed';

/**
 * The save after a reveal closes. Only Finish on a first reveal marks it
 * seen; setting it aside keeps it waiting (in Milestones), and a replay
 * changes nothing.
 */
export function afterReveal(state: UserState, view: RevealView, end: RevealEnd): UserState {
  return !view.replay && end === 'finished' ? seeEvolution(state, view.stage) : state;
}

/** Every stage reached so far, first to current. */
export function stagesReached(state: UserState): DragonStage[] {
  return STAGE_ORDER.slice(0, order(state.stage) + 1);
}

/** What the dragon says on reaching `stage` (the egg has no evolution line). */
export function evolutionLine(stage: DragonStage): Line | undefined {
  return LIBRARY.evolution.find(line => line.stages?.includes(stage));
}
