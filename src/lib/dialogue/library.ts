// Ember's dialogue library (#18). Data only: the selection rules live in
// select.ts, so lines can be edited here without touching logic.
//
// Creative direction (approved in #18): Ember is he/him; he speaks in first
// person, and *asterisks* mark narrated actions. The egg is wordless (only
// narration). Lines come from dialogue library v0.2; lines marked "new" were
// written for this implementation in the same voice (egg narration and a few
// stage-flavored musings) and are listed in the PR for creative review.
//
// Placeholders: {dragonName}, {level}, and {playerName}. There's no player
// name setting yet (#23), so ", {playerName}" is removed and the line still
// reads naturally.

import { DragonStage } from '../../types';

/** The eight expressions from DFS Jr. Dot's reference sheet (#18, #20). */
export type Expression =
  | 'affection'
  | 'curiosity'
  | 'mischief'
  | 'celebration'
  | 'focus'
  | 'sleepiness'
  | 'reassurance'
  | 'surprise';

export interface Line {
  /** Stable id (tests, repeat prevention). */
  id: string;
  text: string;
  expression: Expression;
  /** Which stages can say it. Default: every hatched stage (not the egg). */
  stages?: DragonStage[];
  /** Suits a hard day (after a low-mood check-in): soft, never hyped. */
  gentle?: boolean;
}

export type DialogueContext =
  | 'greeting.morning'
  | 'greeting.afternoon'
  | 'greeting.evening'
  | 'greeting.lateNight'
  | 'return.oneDay'
  | 'return.napping'
  | 'return.wake'
  | 'return.longAway'
  | 'quest.first'
  | 'quest.more'
  | 'quest.allDone'
  | 'quest.hydration'
  | 'focus.start'
  | 'focus.paused'
  | 'focus.finished'
  | 'focus.finishedAway'
  | 'focus.bondComplete'
  | 'checkIn.good'
  | 'checkIn.middle'
  | 'checkIn.low'
  | 'checkIn.updated'
  | 'care.pet'
  | 'care.alreadyPetted'
  | 'care.feed'
  | 'care.full'
  | 'care.incubate'
  | 'evolution'
  | 'bond.levelUp'
  | 'idle'
  /** Soft, supportive lines used on a hard day when a context has no gentle line. */
  | 'support'
  /** Developer builds only (see select.ts): a founder Easter egg. */
  | 'founder'
  | 'founder.caught';

const { EGG, HATCHLING, FLEDGLING, DRAKE, ANCIENT } = DragonStage;
const egg = [EGG];

// The egg greets the same way at any hour (new).
const EGG_GREETINGS: Line[] = [
  { id: 'egg-greet-warm', text: '*the egg glows a little warmer when you arrive*', expression: 'affection', stages: egg, gentle: true },
  { id: 'egg-greet-tap', text: '*a soft tap-tap from inside the shell*', expression: 'curiosity', stages: egg, gentle: true },
  { id: 'egg-greet-rock', text: "*the egg rocks gently, like it's saying hello*", expression: 'affection', stages: egg, gentle: true },
];

// Egg reactions to progress (new).
const EGG_PROGRESS: Line[] = [
  { id: 'egg-progress-glow', text: '*the egg glows brighter*', expression: 'celebration', stages: egg, gentle: true },
  { id: 'egg-progress-wiggle', text: '*a happy wiggle from inside the shell*', expression: 'celebration', stages: egg, gentle: true },
];

export const LIBRARY: Record<DialogueContext, Line[]> = {
  // 1. Greetings (by time of day)
  'greeting.morning': [
    { id: 'morning-nest', text: 'Good morning, {playerName}! I kept the nest warm for you.', expression: 'affection', gentle: true },
    { id: 'morning-stretch', text: "*stretches wings* Oh! You're up! Me too. Mostly.", expression: 'sleepiness' },
    { id: 'morning-sunbeams', text: 'Morning! I counted the sunbeams. There were a lot.', expression: 'curiosity' },
    ...EGG_GREETINGS,
  ],
  'greeting.afternoon': [
    { id: 'afternoon-snacks', text: 'Hi again, {playerName}! I was just thinking about you. And snacks. Mostly you.', expression: 'mischief' },
    { id: 'afternoon-checkin', text: "Afternoon check-in! How's your day treating you?", expression: 'curiosity', gentle: true },
    ...EGG_GREETINGS,
  ],
  'greeting.evening': [
    { id: 'evening-orange', text: "The sky's going all orange. My favorite color, obviously. 🔥", expression: 'curiosity' },
    { id: 'evening-made-it', text: 'Evening! Whatever today was, you made it here.', expression: 'reassurance', gentle: true },
    ...EGG_GREETINGS,
  ],
  'greeting.lateNight': [
    { id: 'night-rest', text: "*yawns* It's late. Rest counts as taking care of yourself too.", expression: 'sleepiness', gentle: true },
    { id: 'night-stars', text: "Shh, the stars are out. We can just sit for a bit.", expression: 'reassurance', gentle: true },
    { id: 'egg-night-light', text: "*the egg glows softly, like a night-light*", expression: 'sleepiness', stages: egg, gentle: true }, // new
  ],

  // 2. Welcome back (never mentions the absence as a problem)
  'return.oneDay': [
    { id: 'back-warm-spot', text: "You're back, {playerName}! I saved you the warm spot.", expression: 'affection', gentle: true },
    { id: 'back-trick', text: 'Hi hi hi! I practiced a new trick while you were gone. …It was napping.', expression: 'mischief' },
    { id: 'egg-back-remembers', text: '*the egg wobbles happily. It remembers you.*', expression: 'affection', stages: egg, gentle: true }, // new
  ],
  'return.napping': [
    { id: 'nap-treasure', text: '*zzz… mumbles about treasure…*', expression: 'sleepiness', gentle: true },
    { id: 'egg-nap-resting', text: '*the egg is resting quietly, warm and safe*', expression: 'sleepiness', stages: egg, gentle: true }, // new
  ],
  'return.wake': [
    { id: 'wake-coziest-nap', text: 'There you are! I had the coziest nap. Ready for a fresh start?', expression: 'affection', gentle: true },
    { id: 'wake-begin-again', text: "*happy wiggle* Hello, {playerName}. Today's a good day to begin again.", expression: 'affection', gentle: true },
    { id: 'wake-from-now', text: "I'm so glad you're here. No catching up needed: we start from right now.", expression: 'reassurance', gentle: true },
    { id: 'wake-giant-snack', text: '*yawns* Oh! Hi! I was dreaming about you. You were holding a giant snack.', expression: 'sleepiness' },
    { id: 'egg-wake-stirs', text: '*the egg stirs and glows awake*', expression: 'surprise', stages: egg, gentle: true }, // new
  ],
  'return.longAway': [
    {
      id: 'long-away-patient',
      text: "*blinks sleepily* Oh! It's you! I dreamed about you. Want to see how much I've grown? Same as before, I'm patient like that.",
      expression: 'surprise',
      gentle: true,
    },
    { id: 'egg-long-away-wobble', text: '*the egg wakes with a happy little wobble*', expression: 'surprise', stages: egg, gentle: true }, // new
  ],

  // 3. Quests
  'quest.first': [
    { id: 'first-strong', text: 'Look at you, starting the day strong!', expression: 'celebration' },
    { id: 'first-hoard', text: "One down! That's how dragons build hoards: one shiny thing at a time.", expression: 'celebration' },
    ...EGG_PROGRESS,
  ],
  'quest.more': [
    { id: 'more-rolling', text: "Another one! You're on a roll. I'm rolling too. 🐉", expression: 'mischief' },
    { id: 'more-sparkly', text: 'Ooh, sparkly progress.', expression: 'curiosity' },
    ...EGG_PROGRESS,
  ],
  'quest.allDone': [
    { id: 'all-victory-lap', text: "ALL of them?! I'm doing a victory lap. *trips* Still counts.", expression: 'celebration' },
    { id: 'all-proud', text: "Every quest today. I'm so proud of you.", expression: 'celebration', gentle: true },
    { id: 'egg-all-shimmer', text: '*the egg shimmers with warm light*', expression: 'celebration', stages: egg, gentle: true }, // new
  ],
  'quest.hydration': [
    { id: 'hydration-buddies', text: "Water! *sips from a tiny cup* We're hydration buddies now.", expression: 'affection', gentle: true },
    ...EGG_PROGRESS,
  ],

  // 4. Focus sessions
  'focus.start': [
    { id: 'focus-still', text: "Focus mode! I'll sit very, very still. …Starting now.", expression: 'focus' },
    { id: 'focus-together', text: "Let's do this together. I'll meditate. You do the thing.", expression: 'focus', gentle: true },
    { id: 'egg-focus-settles', text: '*the egg settles in, calm and still*', expression: 'focus', stages: egg, gentle: true }, // new
  ],
  'focus.paused': [
    { id: 'focus-breather', text: "Taking a breather is allowed. I'll hold our spot.", expression: 'reassurance', gentle: true },
    { id: 'egg-focus-waits', text: '*the egg waits patiently*', expression: 'reassurance', stages: egg, gentle: true }, // new
  ],
  'focus.finished': [
    { id: 'focus-peeked', text: 'We did it! I only peeked at you twice.', expression: 'mischief' },
    { id: 'focus-snack', text: 'Ten whole minutes. Your brain deserves a snack. So do I.', expression: 'celebration' },
    { id: 'egg-focus-proud', text: '*the egg glows, proud of you*', expression: 'celebration', stages: egg, gentle: true }, // new
  ],
  'focus.finishedAway': [
    { id: 'focus-kept-counting', text: 'Our focus session finished while you were gone. I kept counting for us! 🎉', expression: 'celebration', gentle: true },
    { id: 'egg-focus-away', text: '*the egg glows, proud of you*', expression: 'celebration', stages: egg, gentle: true }, // new
  ],
  'focus.bondComplete': [
    { id: 'focus-bond-maxed', text: "More focus? You're amazing. The Bond's maxed for today, but I love doing this with you.", expression: 'affection', gentle: true },
    { id: 'egg-focus-hums', text: '*the egg hums contentedly*', expression: 'affection', stages: egg, gentle: true }, // new
  ],

  // 5. Check-ins (answers the mood the player logs)
  'checkIn.good': [
    { id: 'good-tail-swish', text: 'That makes me so happy! *tail swish*', expression: 'affection' },
    { id: 'good-noticing', text: 'Good days are worth noticing. Thanks for telling me.', expression: 'reassurance', gentle: true },
    { id: 'egg-good-gold', text: '*the egg glows a happy gold*', expression: 'affection', stages: egg, gentle: true }, // new
  ],
  'checkIn.middle': [
    { id: 'middle-in-between', text: 'An in-between day. Those count too.', expression: 'reassurance', gentle: true },
    { id: 'egg-middle-warm', text: '*the egg stays warm beside you*', expression: 'reassurance', stages: egg, gentle: true }, // new
  ],
  // Low moods: soft. No fixing, no cheering at them.
  'checkIn.low': [
    { id: 'low-right-here', text: "Thank you for telling me. I'm right here.", expression: 'reassurance', gentle: true },
    { id: 'low-allowed', text: "Hard days are allowed. You don't have to do anything else for me today.", expression: 'reassurance', gentle: true },
    { id: 'low-quiet', text: '*curls up next to you* We can just be quiet together.', expression: 'reassurance', gentle: true },
    { id: 'egg-low-nestles', text: '*the egg nestles close and glows softly*', expression: 'reassurance', stages: egg, gentle: true }, // new
  ],
  'checkIn.updated': [
    { id: 'updated-thanks', text: 'Got it. Thanks for letting me know how things changed.', expression: 'reassurance', gentle: true },
    { id: 'egg-updated-listening', text: '*the egg glows a little, listening*', expression: 'reassurance', stages: egg, gentle: true }, // new
  ],

  // 6. Care actions
  'care.pet': [
    { id: 'pet-egg', text: '*the shell glows warm under your hand*', expression: 'affection', stages: egg, gentle: true },
    { id: 'pet-hatchling', text: '*squeaks and nuzzles your fingers*', expression: 'affection', stages: [HATCHLING], gentle: true },
    { id: 'pet-fledgling', text: 'Hehe, that tickles! Do the wings next!', expression: 'mischief', stages: [FLEDGLING], gentle: true },
    { id: 'pet-drake', text: '*leans in and rumbles happily*', expression: 'affection', stages: [DRAKE], gentle: true },
    { id: 'pet-ancient', text: '*closes eyes, a deep contented rumble* You still do it just right.', expression: 'affection', stages: [ANCIENT], gentle: true },
  ],
  'care.alreadyPetted': [
    { id: 'petted-glowing', text: "*purrs* I'm still glowing from earlier.", expression: 'affection', gentle: true },
    { id: 'egg-petted-warm', text: '*the shell is still warm from earlier*', expression: 'affection', stages: egg, gentle: true }, // new
  ],
  'care.feed': [
    { id: 'feed-dragonfruit', text: 'Nom! Was that a dragonfruit? Did you name it after me?', expression: 'mischief' },
    { id: 'feed-five-stars', text: '*crunch* Delicious. Five stars. Would hoard.', expression: 'mischief' },
  ],
  'care.full': [
    { id: 'full-float', text: "I'm so full I might float. Tomorrow's snack, though… 😼", expression: 'mischief' },
  ],
  'care.incubate': [
    { id: 'incubate-wiggles', text: '*the egg wiggles* Someone in here likes that.', expression: 'surprise', stages: egg, gentle: true },
  ],

  // 8. Evolution moments (said by the stage just reached)
  evolution: [
    { id: 'evolve-hatchling', text: "*crack… crack…* Hi! I'm here! You're even nicer in person!", expression: 'surprise', stages: [HATCHLING], gentle: true },
    { id: 'evolve-fledgling', text: 'Look! Tiny horns! Do I look fierce? Be honest. Be nice.', expression: 'mischief', stages: [FLEDGLING], gentle: true },
    { id: 'evolve-drake', text: "My wings work! I'm going to fly to the kitchen. For research.", expression: 'mischief', stages: [DRAKE], gentle: true },
    {
      id: 'evolve-ancient',
      text: "Look how far we've come together. And guess what? Our adventure's only beginning!",
      expression: 'celebration',
      stages: [ANCIENT],
      gentle: true,
    },
  ],

  // 9. Bond level-ups
  'bond.levelUp': [
    { id: 'bond-scales', text: 'Our Bond grew! I feel it all the way in my scales.', expression: 'affection', gentle: true },
    { id: 'bond-counted', text: "Bond level {level}! That's a lot of friendship, {playerName}. I counted.", expression: 'celebration' },
    { id: 'egg-bond-pulse', text: '*the egg pulses with a warm, steady glow*', expression: 'affection', stages: egg, gentle: true }, // new
  ],

  // 10. Idle musings (tap Ember)
  idle: [
    { id: 'idle-clouds', text: 'Why do clouds float but I have to flap? Rude.', expression: 'curiosity' },
    { id: 'idle-color', text: "What's your favorite color? Mine's ember. Obviously.", expression: 'curiosity' },
    { id: 'idle-buttons', text: 'If I collect enough buttons, is that a hoard? Asking for me.', expression: 'curiosity' },
    { id: 'idle-stare', text: 'Bet I can stare longer than you. …Okay, you win.', expression: 'mischief' },
    { id: 'idle-tail', text: '*chases own tail* I almost had it!', expression: 'mischief' },
    { id: 'idle-cookie', text: 'I definitely did not hide a cookie in the nest. What cookie?', expression: 'mischief' },
    { id: 'idle-shiny', text: 'If something shiny goes missing, I have no idea. None.', expression: 'mischief' },
    { id: 'idle-better', text: "You're doing better than you think.", expression: 'reassurance', gentle: true },
    { id: 'idle-tiny-legs', text: "Small steps still move you forward. I'd know: I have tiny legs.", expression: 'reassurance', gentle: true },
    // Stage-flavored (new): he matures, but keeps his mischief.
    { id: 'idle-hatchling-tiny', text: 'Me! Tiny! Dragon! *flops over* …Still tiny.', expression: 'mischief', stages: [HATCHLING] },
    { id: 'idle-fledgling-sky', text: 'Why is the sky up? Who decided? Can I ask them?', expression: 'curiosity', stages: [FLEDGLING] },
    { id: 'idle-drake-guard', text: 'I could guard the whole kitchen. Mostly the snack shelf.', expression: 'mischief', stages: [DRAKE] },
    { id: 'idle-ancient-sunrises', text: "I've seen a lot of sunrises. My favorite ones had you in them.", expression: 'affection', stages: [ANCIENT], gentle: true },
    { id: 'idle-ancient-tip', text: 'Wise dragon tip: always keep one snack hidden. Two, if you are very wise.', expression: 'mischief', stages: [ANCIENT] },
    // The egg (new)
    { id: 'egg-idle-tap', text: '*tap tap* …*tap*', expression: 'curiosity', stages: egg, gentle: true },
    { id: 'egg-idle-pretend', text: "*the egg wobbles, then pretends it didn't*", expression: 'mischief', stages: egg },
    { id: 'egg-idle-smile', text: '*the egg glows a little, like a smile*', expression: 'affection', stages: egg, gentle: true },
  ],

  support: [
    { id: 'support-better', text: "You're doing better than you think.", expression: 'reassurance', gentle: true },
    { id: 'support-tiny-legs', text: "Small steps still move you forward. I'd know: I have tiny legs.", expression: 'reassurance', gentle: true },
    { id: 'support-here', text: "I'm right here with you.", expression: 'reassurance', gentle: true }, // new
    { id: 'egg-support-glow', text: '*the egg glows softly beside you*', expression: 'reassurance', stages: egg, gentle: true }, // new
  ],

  // Founder Easter egg (developer builds only): Ember "helping" build himself.
  founder: [
    { id: 'founder-helping', text: "*typing on a tiny keyboard* Dad went to work, so I'm helping build myself!", expression: 'mischief' },
  ],
  'founder.caught': [
    { id: 'founder-caught', text: '*hides the keyboard behind his back* I WAS JUST LOOKING!!!', expression: 'surprise' },
  ],
};
