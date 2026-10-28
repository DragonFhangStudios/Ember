import { DragonStage } from '../types';

// Trick Time: invite Ember to do a little trick and see how it goes, told
// as a tiny story in words (there's no trick animation). Just for fun: no
// failing, no practice, no mastery, nothing saved, repeat as often as you like.

export type TrickId = 'wave' | 'twirl';

export interface TrickChoice {
  id: string;
  label: string;
  /** How it goes. */
  story: string;
  /** Now and then it goes a little sillier. */
  silly: string;
}

export interface Trick {
  id: TrickId;
  name: string;
  icon: string;
  blurb: string;
  /** The scene before the player invites the trick. */
  scene: string;
  /** The player's invitation (a button). */
  invite: string;
  /** What happens next. */
  response: string;
  /** Something Ember says, one picked each time. */
  lines: string[];
  question: string;
  choices: [TrickChoice, TrickChoice];
  /** Ember's happy words at the end, one picked each time. */
  cheers: string[];
}

/** How often a trick goes the silly way. */
export const SILLY_CHANCE = 1 / 5;

export const TRICKS: Record<TrickId, Trick> = {
  wave: {
    id: 'wave',
    name: 'Little Wave',
    icon: '👋',
    blurb: 'Say hello, the dragon way.',
    scene: '{dragonName} is curled up nearby, watching you with bright, curious eyes.',
    invite: 'Wave hello',
    response: 'You give a little wave. {dragonName} tilts a curious head, then lifts one small claw, very slowly.',
    lines: ['Is this how it goes?', 'Hello? Hello!', 'A wave! I know this one. I think.'],
    question: 'How do you wave back?',
    choices: [
      {
        id: 'big',
        label: 'A great big wave',
        story: 'You wave with your whole arm. {dragonName} waves back with both front claws, wobbles, and sits down with a happy thump.',
        silly: '{dragonName} waves back so hard that the tail joins in. Then the wings. A full-dragon wave!',
      },
      {
        id: 'tiny',
        label: 'A tiny wave',
        story: 'You wiggle just your fingers. {dragonName} answers with the smallest claw-wiggle, like a secret hello just for you.',
        silly: '{dragonName} wiggles one claw back, then stares at it, amazed it knew how.',
      },
    ],
    cheers: ['Hello, friend!', "We're waving buddies now.", 'That was a really good wave.'],
  },
  twirl: {
    id: 'twirl',
    name: 'Tiny Twirl',
    icon: '💫',
    blurb: 'A playful little spin.',
    scene: '{dragonName} is full of wiggles and looks ready for something silly.',
    invite: 'Twirl a finger in the air',
    response: 'You draw a slow circle in the air. {dragonName} follows your finger with wide eyes, round and round…',
    lines: ['Round and round… like this?', "Ooh, I'm getting ideas.", 'Wait, which way is round?'],
    question: 'Which way should the twirl go?',
    choices: [
      {
        id: 'left',
        label: 'Twirl to the left',
        story: "{dragonName} spins to the left, tail swishing behind, and finishes with a proud little 'ta-da!'",
        silly: '{dragonName} spins to the left, keeps going a little too long, and wobbles to a happy stop. Still counts!',
      },
      {
        id: 'right',
        label: 'Twirl to the right',
        story: '{dragonName} turns to the right, tail first, then remembers to bring the rest of the dragon along. Ta-da!',
        silly: '{dragonName} spins to the right, then to the left to undo it, and looks very pleased with the double twirl.',
      },
    ],
    cheers: ['Ta-da!', 'Did you see? I did a twirl!', "I'm a little dizzy. The good kind."],
  },
};

export const TRICK_IDS: readonly TrickId[] = ['wave', 'twirl'];

/** Tricks begin once Ember hatches; the egg gets a gentle note instead. */
export const tricksOpen = (stage: DragonStage) => stage !== DragonStage.EGG;

export const fillName = (text: string, dragonName: string) => text.replace(/\{dragonName\}/g, dragonName);

const pick = <T,>(items: readonly T[], random: () => number) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/** Where a trick is up to. Lives only while the dialog is open. */
export type TrickView =
  | { step: 'pick' }
  | { step: 'invite'; trick: TrickId }
  | { step: 'response'; trick: TrickId; line: string }
  | { step: 'finale'; trick: TrickId; choice: string; story: string; silly: boolean; cheer: string };

export const START: TrickView = { step: 'pick' };

/** Starts a trick, from the list or again after one ends. */
export function begin(view: TrickView, trick: TrickId): TrickView {
  return (view.step === 'pick' || view.step === 'finale') && trick in TRICKS ? { step: 'invite', trick } : view;
}

/** The player invites the trick; Ember responds. */
export function invite(view: TrickView, random: () => number = Math.random): TrickView {
  return view.step === 'invite' ? { step: 'response', trick: view.trick, line: pick(TRICKS[view.trick].lines, random) } : view;
}

/** The player picks how; the trick happens (now and then, sillier). */
export function finish(view: TrickView, choiceId: string, random: () => number = Math.random): TrickView {
  if (view.step !== 'response') return view;
  const choice = TRICKS[view.trick].choices.find(c => c.id === choiceId);
  if (!choice) return view;
  const silly = random() < SILLY_CHANCE;
  return { step: 'finale', trick: view.trick, choice: choice.id, story: silly ? choice.silly : choice.story, silly, cheer: pick(TRICKS[view.trick].cheers, random) };
}
