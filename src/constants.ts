import { DragonStage, Quest, CosmeticItem, Badge } from './types';
// Temporary local placeholders (no third-party image requests; see
// src/assets/placeholders/README.md). Original art replaces them via #20.
import stageEgg from './assets/placeholders/stage-egg.svg';
import stageHatchling from './assets/placeholders/stage-hatchling.svg';
import stageFledgling from './assets/placeholders/stage-fledgling.svg';
import stageDrake from './assets/placeholders/stage-drake.svg';
import stageAncient from './assets/placeholders/stage-ancient.svg';
import hatWizard from './assets/placeholders/cosmetic-hat-wizard.svg';
import hatCrown from './assets/placeholders/cosmetic-hat-crown.svg';
import scarfRed from './assets/placeholders/cosmetic-scarf-red.svg';
import nestMoss from './assets/placeholders/cosmetic-nest-moss.svg';
import nestCloud from './assets/placeholders/cosmetic-nest-cloud.svg';

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'q1',
    title: 'Morning Routine',
    description: 'Get out of bed and drink a glass of water.',
    type: 'routine',
    completed: false,
    points: 10,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q2',
    title: 'Daily Vitality',
    description: 'Log your daily health routine or medication.',
    type: 'medication',
    completed: false,
    points: 25,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q3',
    title: 'Focus Meditation',
    description: 'Complete a 10-minute focus quest with Ember.',
    type: 'focus',
    completed: false,
    points: 15,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q4',
    title: 'Symptom Check-in',
    description: 'How are you feeling today?',
    type: 'symptom',
    completed: false,
    points: 5,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q5',
    title: 'Hydration Goal',
    description: 'Drink 4 glasses of water throughout the day.',
    type: 'routine',
    completed: false,
    points: 20,
    isDaily: true,
    progress: 0,
    target: 4,
  }
];

export const COSMETICS: CosmeticItem[] = [
  { id: 'hat_wizard', name: 'Tiny Wizard Hat', price: 50, category: 'hat', image: hatWizard },
  { id: 'hat_crown', name: 'Golden Crown', price: 150, category: 'hat', image: hatCrown },
  { id: 'scarf_red', name: 'Red Cozy Scarf', price: 30, category: 'scarf', image: scarfRed },
  { id: 'nest_moss', name: 'Soft Moss Nest', price: 100, category: 'nest', image: nestMoss },
  { id: 'nest_cloud', name: 'Cloud Bed', price: 200, category: 'nest', image: nestCloud },
];

export const BADGES: Badge[] = [
  { id: 'badge_hatch', name: 'First Hatch', description: 'Your dragon egg has hatched!', icon: '🥚' },
  { id: 'badge_streak_3', name: 'Consistent Companion', description: 'Do one meaningful activity (a quest, focus session, or check-in) 3 days in a row.', icon: '✨' },
  { id: 'badge_streak_7', name: 'Week Warrior', description: 'Do one meaningful activity (a quest, focus session, or check-in) 7 days in a row.', icon: '🔥' },
  { id: 'badge_pet_10', name: 'Dragon Bonder', description: 'Pet your dragon 10 times.', icon: '❤️' },
  { id: 'badge_focus_5', name: 'Zen Master', description: 'Complete 5 focus sessions.', icon: '🧘' },
  { id: 'badge_days_100', name: 'Hundred Days Together', description: 'Share 100 active days with your dragon.', icon: '🌱' },
  { id: 'badge_days_200', name: 'Two Hundred Days Together', description: 'Share 200 active days with your dragon.', icon: '🌳' },
  { id: 'badge_days_365', name: 'A Year Together', description: 'Share 365 active days with your dragon.', icon: '🌟' },
];

export const DRAGON_STAGES_DATA = {
  [DragonStage.EGG]: {
    description: "A mysterious egg pulsing with a faint, warm light. Take care of yourself for a couple of days, and it will hatch.",
    image: stageEgg
  },
  [DragonStage.HATCHLING]: {
    description: "Tiny, big eyes, wobbles when it walks. Fits on a single UI card. Ember glows when you stay hydrated!",
    image: stageHatchling
  },
  [DragonStage.FLEDGLING]: {
    description: "Grows small nubs for horns and wings. Ember is starting to ask questions about the world.",
    image: stageFledgling
  },
  [DragonStage.DRAKE]: {
    description: "Lean and athletic. Wings are functional. Ember can now go on scavenging runs while you focus.",
    image: stageDrake
  },
  [DragonStage.ANCIENT]: {
    description: "Majestic, glowing scales and ornate horns. Ember is now a permanent guardian of your health legacy.",
    image: stageAncient
  }
};
