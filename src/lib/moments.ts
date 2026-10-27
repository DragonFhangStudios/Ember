import { DialogueContext } from './dialogue/library';

// Dragon Moments: Boop, Play and Rest Together. Just for fun: they never
// change the save, earn nothing, and don't count as an active day.

export type MomentKind = 'boop' | 'play' | 'rest';

export const MOMENT_KINDS: readonly MomentKind[] = ['boop', 'play', 'rest'];

/** A few quick boops in a row find the hidden sparkle sneeze. */
export const SNEEZE_BOOPS = 3;
export const SNEEZE_WINDOW_MS = 4000;
/** How often a Boop or Play turns up a surprising line instead. */
export const SURPRISE_CHANCE = 1 / 12;
/** How long Rest Together keeps Ember resting quietly. */
export const REST_MS = 8000;

const CONTEXT: Record<MomentKind, DialogueContext> = {
  boop: 'moment.boop',
  play: 'moment.play',
  rest: 'moment.rest',
};

/**
 * Which kind of line a moment gets. Keeps the last few boop times, so
 * SNEEZE_BOOPS boops within SNEEZE_WINDOW_MS give the hidden sneeze (then it
 * starts counting again). Rest Together is always calm, never a surprise.
 */
export function createMoments() {
  let boops: number[] = [];
  return {
    contextFor(kind: MomentKind, now: number, random: number): DialogueContext {
      if (kind === 'boop') {
        boops = [...boops.filter(t => now - t < SNEEZE_WINDOW_MS), now];
        if (boops.length >= SNEEZE_BOOPS) {
          boops = [];
          return 'moment.sneeze';
        }
      }
      if (kind !== 'rest' && random < SURPRISE_CHANCE) return 'moment.surprise';
      return CONTEXT[kind];
    },
  };
}
