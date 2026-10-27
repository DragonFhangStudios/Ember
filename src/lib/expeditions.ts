import { DragonStage, UserState } from '../types';
import { Expression } from './dialogue/library';
import { isoDay } from './evolution';

// Little Expeditions: short, optional adventures with Ember once he has
// hatched. The player picks a place and one of two choices; every choice
// finds something. Each choice keeps one keepsake the first time (six in
// all); revisits can turn up an alternate little story instead, which keeps
// nothing. Nothing here earns Energy, Bond or Golden Scales, counts as an
// active day, or can go wrong. Keepsakes are kept forever in the save
// (`discoveries`), once each.

export type DiscoveryId =
  | 'mushroom-crystal'
  | 'shimmering-feather'
  | 'river-pebble'
  | 'treasure-stone'
  | 'star-fragment'
  | 'tiny-bell';

export interface Discovery {
  id: DiscoveryId;
  name: string;
  /** A short line about it, in Ember's world. */
  description: string;
  /** Decorative (the name carries the meaning). */
  icon: string;
}

/** A short story: 1 to 3 sentences. `{dragonName}` is filled in. */
export interface Story {
  story: string;
  /** Ember's reaction. */
  expression: Expression;
}

export interface Choice {
  id: string;
  label: string;
  /** The first visit: the keepsake this path keeps. */
  find: Story & { discovery: DiscoveryId };
  /** A revisit can turn up this instead: a lovely moment, nothing kept. */
  alternate: Story;
}

export type LocationId = 'glowcap-grove' | 'pebblebrook-crossing' | 'starfall-clearing';

export interface Expedition {
  id: LocationId;
  name: string;
  /** One line on the map. */
  blurb: string;
  icon: string;
  /** The situation Ember finds there. */
  scene: string;
  choices: [Choice, Choice];
}

export const DISCOVERIES: Record<DiscoveryId, Discovery> = {
  'mushroom-crystal': { id: 'mushroom-crystal', name: 'Mushroom-shaped crystal', description: 'It hums very quietly, like it knows a song.', icon: '🍄' },
  'shimmering-feather': { id: 'shimmering-feather', name: 'Shimmering feather', description: 'It changes color when you tilt it. Ember tilts it a lot.', icon: '🪶' },
  'river-pebble': { id: 'river-pebble', name: 'Glowing river pebble', description: 'Smooth and cool, with a soft light inside.', icon: '🪨' },
  'treasure-stone': { id: 'treasure-stone', name: 'A very important stone', description: 'Ember insists this is treasure. Ember is the expert.', icon: '💎' },
  'star-fragment': { id: 'star-fragment', name: 'Fallen star fragment', description: 'Still a little warm, and it twinkles when you smile at it.', icon: '⭐' },
  'tiny-bell': { id: 'tiny-bell', name: 'Tiny bell', description: 'Found near an old trail. It rings the friendliest little ring.', icon: '🔔' },
};

export const EXPEDITIONS: Expedition[] = [
  {
    id: 'glowcap-grove',
    name: 'Glowcap Grove',
    blurb: 'A magical woodland full of glowing mushrooms.',
    icon: '🍄',
    scene: 'A ring of glowcap mushrooms glows soft blue between the trees. One of them seems to be humming.',
    choices: [
      {
        id: 'listen',
        label: 'Listen closely',
        find: { discovery: 'mushroom-crystal', story: '{dragonName} presses an ear to the moss. The humming comes from a tiny crystal shaped like a mushroom, tucked between the roots.', expression: 'curiosity' },
        alternate: { story: 'This time the humming is just the breeze. {dragonName} finds a curl of glowing moss, admires it, and tucks it back where it grows, so it can keep glowing.', expression: 'affection' },
      },
      {
        id: 'follow-glow',
        label: 'Follow the glowing trail',
        find: { discovery: 'shimmering-feather', story: 'The glowing caps lead to a hollow log. Inside, a shimmering feather changes color as {dragonName} turns it this way and that.', expression: 'surprise' },
        alternate: { story: 'The trail ends at a tiny acorn cap, perfect for a very small tea party. {dragonName} leaves it right where it is, for whoever lives here.', expression: 'mischief' },
      },
    ],
  },
  {
    id: 'pebblebrook-crossing',
    name: 'Pebblebrook Crossing',
    blurb: 'A peaceful stream with curious little discoveries.',
    icon: '💧',
    scene: 'A little stream babbles over smooth stones. Something sparkles under the water, and a path of stepping stones leads across.',
    choices: [
      {
        id: 'peek',
        label: 'Peek into the water',
        find: { discovery: 'river-pebble', story: '{dragonName} leans over the edge and spots it: a smooth river pebble with a soft glow inside, right in the shallows.', expression: 'surprise' },
        alternate: { story: 'The sparkle was a parade of tiny minnows! {dragonName} watches them zip past and tries to count them. It is a lot of minnows.', expression: 'curiosity' },
      },
      {
        id: 'hop-stones',
        label: 'Hop across the stepping stones',
        find: { discovery: 'treasure-stone', story: 'Hop, hop, hop! On the far bank, {dragonName} picks up a perfectly ordinary stone and declares it treasure. It is now treasure.', expression: 'celebration' },
        alternate: { story: '{dragonName} counts the stepping stones on the way across. Seven! Or eight. {dragonName} hops back to count again, just to be sure.', expression: 'mischief' },
      },
    ],
  },
  {
    id: 'starfall-clearing',
    name: 'Starfall Clearing',
    blurb: 'A quiet place where fallen stars supposedly hide.',
    icon: '✨',
    scene: 'A quiet clearing under a sky full of stars. They say fallen stars hide here, if you know where to look.',
    choices: [
      {
        id: 'wish',
        label: 'Look up and make a wish',
        find: { discovery: 'star-fragment', story: 'You both make a wish. A tiny light drifts down and lands right by {dragonName}: a fallen star fragment, still a little warm.', expression: 'celebration' },
        alternate: { story: 'No star falls tonight, but a fluffy wishing seed floats by. {dragonName} blows it gently onward, to carry the wish a little farther.', expression: 'affection' },
      },
      {
        id: 'search-grass',
        label: 'Search the soft grass',
        find: { discovery: 'tiny-bell', story: '{dragonName} pads through the grass to where an old trail begins. Half hidden by a fern is a tiny bell that rings the friendliest ring.', expression: 'curiosity' },
        alternate: { story: 'Under the grass is a leaf with a little tail, like a comet that decided to be a leaf. {dragonName} admires it, then lets the breeze have it back.', expression: 'mischief' },
      },
    ],
  },
];

/** Expeditions start once Ember has hatched; the egg has its moments at home. */
export const expeditionsOpen = (stage: DragonStage) => stage !== DragonStage.EGG;

/** How Ember sets out, by stage. */
export function setOff(stage: DragonStage, dragonName: string): string {
  if (stage === DragonStage.HATCHLING) return `${dragonName} toddles along beside you, tail wagging.`;
  if (stage === DragonStage.FLEDGLING) return `${dragonName} hops and flutters ahead, then waits for you.`;
  return `${dragonName} glides low over the path, keeping close.`;
}

/** Ember's excitement on choosing a place (a little different every time). */
export const EXCITED: string[] = [
  'An adventure! *bounces on the spot*',
  "Ooh, I've always wanted to go there. Well, since just now.",
  "*tail wags so hard it's mostly a blur* Let's go!",
  'Adventure time! I packed a snack. I ate the snack. Still ready!',
];

/** Ember's reaction on finding a new keepsake. */
export const TREASURE_REACTIONS: string[] = [
  'Treasure! For the shelf! Our shelf.',
  '*holds it up to show you* Look what we found!',
  "I'm going to keep this forever. And show everyone. Mostly you.",
];

/** Ember's reaction to a revisit: a lovely moment, or a keepsake found again. */
export const AGAIN_REACTIONS: string[] = [
  'Not everything goes on the shelf. Some things are just for remembering.',
  'Same place, brand-new adventure. I love it here.',
];

export const discoveryCount = (state: UserState) => Object.keys(state.discoveries ?? {}).length;
export const hasFound = (state: UserState, id: DiscoveryId) => !!state.discoveries?.[id];

/** What a visit turned up: the keepsake (new or found again), or the alternate story. */
export type Visit =
  | { kind: 'new'; story: Story; discovery: DiscoveryId }
  | { kind: 'again'; story: Story; discovery: DiscoveryId }
  | { kind: 'alternate'; story: Story };

/**
 * What a choice turns up. The first visit always finds its keepsake. Once it's
 * on the shelf, a revisit is the alternate story or the keepsake found again,
 * by `random` (neither keeps anything new).
 */
export function visit(state: UserState, choice: Choice, random: number): Visit {
  const { discovery, ...story } = choice.find;
  if (!hasFound(state, discovery)) return { kind: 'new', story, discovery };
  return random < 0.5 ? { kind: 'alternate', story: choice.alternate } : { kind: 'again', story, discovery };
}

/**
 * Keeps a keepsake, once: finding it again never adds a second one or changes
 * when it was first found. Nothing else in the save changes.
 */
export function recordDiscovery(state: UserState, id: DiscoveryId, now: Date): UserState {
  if (!(id in DISCOVERIES) || hasFound(state, id)) return state;
  return { ...state, discoveries: { ...state.discoveries, [id]: isoDay(now) } };
}

/** Keepsakes found, in the order of the map (where they come from). */
export function foundInOrder(state: UserState): { discovery: Discovery; foundOn: string; place: string }[] {
  return EXPEDITIONS.flatMap(expedition =>
    expedition.choices
      .filter(choice => hasFound(state, choice.find.discovery))
      .map(choice => ({ discovery: DISCOVERIES[choice.find.discovery], foundOn: state.discoveries![choice.find.discovery]!, place: expedition.name })),
  );
}

export const fillName = (text: string, dragonName: string) => text.replace(/\{dragonName\}/g, dragonName);
